import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "./supabase/service";
import type { WebhookEvent } from "./webhook-events";

/**
 * Telling a site that something happened.
 *
 * A website integrated with this platform cannot poll for the things it actually
 * cares about, because the things it cares about are decided elsewhere: a batch
 * gets approved in the portal, a subscription lapses in Stripe, a content entry
 * is edited by an operator. Webhooks are the half of the integration that runs
 * in the other direction, and without them "integrable" means "pollable", which
 * is not the same product.
 *
 * The whole system is two verbs. `emit` writes what is owed. `drain` pays it.
 * They are separate on purpose: emit is called on a request path and must be a
 * single fast insert, while delivery is a network call to somebody else's server
 * that may be slow, down, or hostile, and must never be able to fail the action
 * that caused the event.
 */

/* The vocabulary lives in webhook-events.ts, which carries no server-only guard
   so the console can render it. Re-exported here because everything else about an
   event comes from this file and splitting the import would be a trap. */
export {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_NAMES,
  isWebhookEvent,
  type WebhookEvent,
} from "./webhook-events";

/**
 * Retry schedule, in minutes after each failed attempt.
 *
 * Five retries over roughly twelve hours, widening fast. The shape is chosen for
 * the two failures that actually happen: a deploy, which is over in a minute,
 * and an outage, which is not over in an hour. A flat one-minute retry serves the
 * first and hammers a struggling server through the second.
 *
 * Running off the end of this array is what "dead" means. There is no infinite
 * retry, because an endpoint that has not answered in twelve hours is not going
 * to be fixed by this platform continuing to shout at it, and the delivery row
 * stays for a redelivery somebody chooses.
 */
const BACKOFF_MINUTES = [1, 5, 25, 120, 600];

/** Consecutive failures before the platform turns an endpoint off itself. */
const FAILURE_LIMIT = 20;

/** How long to wait on somebody else's server before calling it a failure. */
const TIMEOUT_MS = 10_000;

/* A payload is not a file transfer. This ceiling is far above any event here and
   exists so a pathological record cannot turn one emit into a queue of megabyte
   POSTs retried five times each. */
const MAX_PAYLOAD_BYTES = 256 * 1024;

/** A fresh signing secret. Shown in full in the console, and stored, because signing needs it. */
export function mintWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/**
 * The signature a receiver checks.
 *
 * Signed over `${timestamp}.${body}` rather than over the body alone, and the
 * timestamp is what makes that worth doing: a signature over the body is valid
 * forever, so anybody who captures one delivery can replay it at will. Binding
 * the time into the signed string means a receiver can refuse anything older
 * than its own tolerance and the signature cannot be lifted onto a fresh
 * timestamp.
 *
 * Scheme is `t=<unix seconds>,v1=<hex hmac-sha256>`, which is the shape most
 * integrators have already implemented once for another vendor. Being
 * unimaginative here is a feature.
 */
export function signPayload(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/**
 * Verifies a signature the way a receiver should.
 *
 * Exported because it is the reference implementation the integration guide
 * points at, and because the console's own test tooling checks against it. A
 * copy of this in six languages in a document goes stale; this one cannot.
 */
export function verifySignature(
  secret: string,
  header: string,
  body: string,
  toleranceSeconds = 300
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const i = piece.indexOf("=");
      return i === -1 ? [piece.trim(), ""] : [piece.slice(0, i).trim(), piece.slice(i + 1).trim()];
    })
  );

  const timestamp = Number(parts.t);
  const presented = parts.v1;
  if (!Number.isFinite(timestamp) || !presented) return false;

  const age = Math.abs(Date.now() / 1000 - timestamp);
  if (age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  if (expected.length !== presented.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(presented, "utf8"));
}

export type EmitResult = { queued: number };

/**
 * Records that an event happened, for every endpoint of a site that wants it.
 *
 * Returns rather than throws on every failure path, including the database being
 * unreachable. This is called from inside actions whose real job is something
 * else, and a webhook that cannot be queued must not roll back an approval or a
 * content save. What that costs is a lost event, which is the lesser failure and
 * is visible in the delivery log by its absence.
 *
 * An endpoint with an empty `events` array receives everything. That is the
 * default a new endpoint is created with, so wiring one up and immediately seeing
 * traffic is the first-run experience rather than a filter somebody has to
 * discover.
 */
export async function emit(
  siteId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<EmitResult> {
  try {
    const db = createServiceClient();

    const { data: hooks, error } = await db
      .from("site_webhooks")
      .select("id, events")
      .eq("site_id", siteId)
      .eq("active", true);

    if (error || !hooks?.length) return { queued: 0 };

    const wanted = hooks.filter((hook) => {
      const events = (hook.events as string[] | null) ?? [];
      return events.length === 0 || events.includes(event);
    });
    if (!wanted.length) return { queued: 0 };

    /* The envelope is built once and stored per endpoint, so two endpoints
       receiving the same event receive byte-identical bodies with different
       signatures. `id` is added at delivery time, since it is the delivery's
       identity rather than the event's. */
    const payload = {
      event,
      created_at: new Date().toISOString(),
      site_id: siteId,
      data,
    };

    const size = Buffer.byteLength(JSON.stringify(payload), "utf8");
    if (size > MAX_PAYLOAD_BYTES) {
      return { queued: 0 };
    }

    const { error: insertError } = await db.from("webhook_deliveries").insert(
      wanted.map((hook) => ({
        webhook_id: hook.id as string,
        site_id: siteId,
        event,
        payload,
      }))
    );

    return { queued: insertError ? 0 : wanted.length };
  } catch {
    /* Emitting is best effort by design. See the note above. */
    return { queued: 0 };
  }
}

export type DrainResult = {
  attempted: number;
  delivered: number;
  failed: number;
  dead: number;
};

type DueRow = {
  id: string;
  webhook_id: string;
  event: string;
  payload: unknown;
  attempts: number;
  site_webhooks: { url: string; secret: string; active: boolean } | null;
};

/**
 * Delivers what is owed.
 *
 * Called three ways, all of which are the same code: from `after()` on the
 * request that emitted, so a healthy endpoint sees the event in under a second;
 * from the scheduled drain, which is what actually makes retries happen; and by
 * hand from the console for one delivery.
 *
 * Deliveries run in sequence rather than in parallel. The batch is small, the
 * bound that matters is somebody else's server, and hitting one endpoint with
 * fifty concurrent POSTs after it recovers from an outage is how a retry storm
 * becomes a second outage.
 */
export async function drain(options: { siteId?: string; limit?: number } = {}): Promise<DrainResult> {
  const result: DrainResult = { attempted: 0, delivered: 0, failed: 0, dead: 0 };

  let rows: DueRow[];
  try {
    const db = createServiceClient();
    let query = db
      /* cross-site: the scheduled drain is the platform retrying on behalf of
         every site at once, so a run with no siteId is meant to span all of
         them. The per-site narrowing below is for the call that emits an event
         and wants only its own backlog. */
      .from("webhook_deliveries")
      .select("id, webhook_id, event, payload, attempts, site_webhooks(url, secret, active)")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(options.limit ?? 25);

    if (options.siteId) query = query.eq("site_id", options.siteId);

    const { data, error } = await query;
    if (error || !data) return result;
    rows = data as unknown as DueRow[];
  } catch {
    return result;
  }

  for (const row of rows) {
    /* PostgREST returns an embedded one-to-one as an object or, on some client
       versions, a single-element array. Normalizing here rather than trusting
       either shape has been the difference between working and silently
       skipping every row before. */
    const hook = Array.isArray(row.site_webhooks) ? row.site_webhooks[0] : row.site_webhooks;
    if (!hook || !hook.active) {
      await settle(row.id, "dead", row.attempts, null, "The endpoint was removed or switched off.");
      result.dead++;
      continue;
    }

    result.attempted++;
    const outcome = await attempt(row, hook.url, hook.secret);

    if (outcome.ok) {
      await settle(row.id, "delivered", row.attempts + 1, outcome.status, null);
      await recordHealth(row.webhook_id, true);
      result.delivered++;
      continue;
    }

    const nextAttempt = row.attempts + 1;
    const exhausted = nextAttempt > BACKOFF_MINUTES.length;
    await settle(
      row.id,
      exhausted ? "dead" : "failed",
      nextAttempt,
      outcome.status,
      outcome.error,
      exhausted ? null : BACKOFF_MINUTES[nextAttempt - 1]
    );
    await recordHealth(row.webhook_id, false);
    if (exhausted) result.dead++;
    else result.failed++;
  }

  return result;
}

/** One POST. Never throws: a transport failure is a result, not an exception. */
async function attempt(
  row: DueRow,
  url: string,
  secret: string
): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const body = JSON.stringify({ id: row.id, ...(row.payload as Record<string, unknown>) });
  const timestamp = Math.floor(Date.now() / 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        /* Neutral header names. An integrator should not have to paste a
           vendor's brand into their own request handling to use their portal. */
        "X-Webhook-Id": row.id,
        "X-Webhook-Event": row.event,
        "X-Webhook-Timestamp": String(timestamp),
        "X-Webhook-Signature": signPayload(secret, timestamp, body),
        "User-Agent": "Portal-Webhooks/1",
      },
      body,
      /* No redirects. A 302 on a webhook endpoint is either a misconfiguration
         or somebody else's server deciding where this platform's signed payload
         should go next, and neither is worth following. */
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status, error: null };
    }

    /* A little of the body, because "500" alone never tells anybody why. Capped
       hard: this is stored and rendered in the console. */
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 400);
    } catch {
      /* A body that cannot be read is not worth a second failure. */
    }

    return {
      ok: false,
      status: response.status,
      error: detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return {
      ok: false,
      status: null,
      error: message.includes("timed out") || message.includes("aborted")
        ? `No response within ${TIMEOUT_MS / 1000}s.`
        : message,
    };
  }
}

async function settle(
  id: string,
  status: "delivered" | "failed" | "dead",
  attempts: number,
  responseStatus: number | null,
  error: string | null,
  retryInMinutes: number | null = null
): Promise<void> {
  try {
    const db = createServiceClient();
    await db
      .from("webhook_deliveries")
      .update({
        status,
        attempts,
        response_status: responseStatus,
        error,
        delivered_at: status === "delivered" ? new Date().toISOString() : null,
        next_attempt_at:
          retryInMinutes === null
            ? new Date().toISOString()
            : new Date(Date.now() + retryInMinutes * 60_000).toISOString(),
      })
      .eq("id", id);
  } catch {
    /* The delivery happened or did not; failing to write that down must not
       throw out of the drain and abandon the rest of the batch. */
  }
}

/**
 * Keeps the endpoint's own health in step, and switches it off when it has been
 * broken long enough to be somebody's forgotten test URL.
 *
 * Auto-disabling is deliberate and it is not a punishment. An endpoint that has
 * failed twenty times in a row is generating retries forever at this platform's
 * expense and telling nobody anything; turning it off makes the state visible in
 * the console, where it says why, and re-enabling is one click once it is fixed.
 */
async function recordHealth(webhookId: string, success: boolean): Promise<void> {
  try {
    const db = createServiceClient();
    const now = new Date().toISOString();

    if (success) {
      await db
        .from("site_webhooks")
        .update({ last_success_at: now, consecutive_failures: 0 })
        .eq("id", webhookId);
      return;
    }

    const { data } = await db
      .from("site_webhooks")
      .select("consecutive_failures")
      .eq("id", webhookId)
      .maybeSingle();

    const failures = ((data?.consecutive_failures as number | null) ?? 0) + 1;
    const disable = failures >= FAILURE_LIMIT;

    await db
      .from("site_webhooks")
      .update({
        last_failure_at: now,
        consecutive_failures: failures,
        ...(disable
          ? {
              active: false,
              disabled_reason: `Switched off automatically after ${failures} consecutive failures.`,
            }
          : {}),
      })
      .eq("id", webhookId);
  } catch {
    /* Health is telemetry. Losing a count is not worth failing a delivery over. */
  }
}

/**
 * Queues one delivery again, as a new row.
 *
 * A new row rather than resetting the old one, because the delivery log is the
 * evidence of what this platform did and when. Rewriting a failed attempt into a
 * successful one erases the outage it recorded.
 */
export async function redeliver(deliveryId: string): Promise<boolean> {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("webhook_deliveries")
      .select("webhook_id, site_id, event, payload")
      .eq("id", deliveryId)
      .maybeSingle();

    if (!data) return false;

    const { error } = await db.from("webhook_deliveries").insert({
      webhook_id: data.webhook_id,
      site_id: data.site_id,
      event: data.event,
      payload: data.payload,
    });

    return !error;
  } catch {
    return false;
  }
}
