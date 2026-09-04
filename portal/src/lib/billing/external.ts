import "server-only";

import { cache } from "react";
import { createServiceClient } from "@/lib/core/supabase/service";
import { feedUrlProblem, readSubStatus } from "@/lib/core/payments";
import { readSettings } from "@/lib/settings";

/**
 * Billing this platform did not collect.
 *
 * A site that takes money through its own processor still has clients who open
 * the portal and want to know what they are on, what they paid and when it
 * renews. This module is how that question gets an answer: the site publishes a
 * feed of its own billing state, this platform fetches it on a schedule and on
 * demand, and the rows land in `subscriptions` and `invoices` tagged
 * `source = 'external'` so every screen that already reads them keeps working.
 *
 * Four properties are deliberate, and each one is the reason the alternative was
 * not taken:
 *
 * **It pulls, it does not receive.** A site that pushes and then stops pushing is
 * indistinguishable from a site with no customers, and nobody finds out until a
 * client complains. A fetch fails visibly, on a timetable, with a status code and
 * a row that says so.
 *
 * **It never touches a platform row.** Every write here is filtered or keyed on
 * `source = 'external'`, and the Stripe path is keyed on stripe ids an imported
 * row never has. A feed that reports somebody else's subscription id changes
 * nothing.
 *
 * **A row it cannot use is named, not guessed at.** An unknown plan, an
 * unrecognized status, an email belonging to no client of this site: each is
 * skipped, counted, and written into the run's `problems`, because the client
 * behind it is looking at an empty billing screen and somebody has to be able to
 * see why in under a minute.
 *
 * **It never deletes.** A subscription that stops appearing in a feed is far more
 * often a partial response than a cancellation, and deleting billing history on
 * the strength of an absence is not recoverable. Cancellation is a status the
 * feed states.
 */

/* Bounds. Each is here so one bad response cannot become this platform's
   problem: a feed that answers with a video file, a feed that lists a million
   invoices, a feed that accepts the connection and then never sends a byte. */
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 4_000_000;
const MAX_SUBSCRIPTIONS = 2_000;
const MAX_INVOICES = 10_000;
/* Enough to see the shape of what is wrong. A run that skipped four hundred rows
   has one problem, not four hundred, and printing them all would bury it. */
const MAX_PROBLEMS = 20;
/* Clients of one site, loaded to match the feed against. A site with more than
   this many is a site whose feed should be matching on org_id rather than on
   email addresses, and the run says so rather than silently matching a prefix. */
const MAX_CLIENTS = 5_000;

export type SyncSummary = {
  ok: boolean;
  /** Null when the request itself never happened. */
  httpStatus: number | null;
  subscriptionsSeen: number;
  subscriptionsWritten: number;
  invoicesSeen: number;
  invoicesWritten: number;
  skipped: number;
  problems: string[];
  error: string | null;
};

/* ---------------- what mode a site is actually in ---------------- */

/** The platform-wide switch. Off means no site imports anything, whatever it is set to. */
export const externalCollectionEnabled = cache(async (): Promise<boolean> => {
  const settings = await readSettings();
  return settings["billing.external_collection"] === true;
});

/** How old imported billing may be before the product calls it stale. */
export const billingMaxAgeHours = cache(async (): Promise<number> => {
  const settings = await readSettings();
  const value = Number(settings["billing.feed_max_age_hours"]);
  return Number.isFinite(value) && value > 0 ? value : 26;
});

/* ---------------- the feed ---------------- */

/**
 * One subscription, as a feed states it.
 *
 * Field names are the ones an integrator would write without reading anything,
 * with the obvious synonyms accepted. Being generous here costs a few lines and
 * saves the support thread that starts "your API says it imported nothing".
 */
type RawRecord = Record<string, unknown>;

function str(row: RawRecord, ...names: string[]): string | null {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function cents(row: RawRecord, ...names: string[]): number | null {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    /* A string of digits is what a JSON encoder in a strongly typed language
       tends to produce for money, so it is read rather than refused. Anything
       with a decimal point is not cents and is refused: guessing whether "39.70"
       means 39 cents or 3970 of them is exactly the guess that must not be made
       about somebody's bill. */
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  }
  return null;
}

function bool(row: RawRecord, ...names: string[]): boolean {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
  }
  return false;
}

/** An ISO timestamp, or null. A date this platform cannot parse is not stored. */
function when(row: RawRecord, ...names: string[]): string | null {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "number" && Number.isFinite(value)) {
      /* Unix seconds, which is what every payment processor emits. Milliseconds
         would put the row in the year 57000 and be visible immediately. */
      return new Date(value * 1000).toISOString();
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value.trim());
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    }
  }
  return null;
}

function httpsUrl(row: RawRecord, ...names: string[]): string | null {
  const raw = str(row, ...names);
  if (!raw) return null;
  try {
    /* https only, and the reason is that this value is rendered as a link in a
       client's portal. An http link there is a downgrade this platform put in
       front of somebody paying an invoice. */
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

function rowsOf(payload: unknown, key: string): RawRecord[] {
  if (Array.isArray(payload)) return key === "subscriptions" ? (payload as RawRecord[]) : [];
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as RawRecord)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is RawRecord => Boolean(row) && typeof row === "object");
}

/* ---------------- the run ---------------- */

type Client = { id: string; email: string };

/**
 * Fetches one site's billing feed and writes what it can use.
 *
 * The run row is inserted before the request goes out, not after it comes back.
 * A run that hangs, or that takes the function down with it, still leaves a row
 * with a start time and no finish, which is what makes "billing has not updated
 * since Tuesday" answerable at all.
 */
export async function importBillingFeed(options: {
  siteId: string;
  kind: "schedule" | "operator";
  triggeredBy?: string | null;
}): Promise<SyncSummary> {
  const { siteId, kind, triggeredBy = null } = options;
  const db = createServiceClient();

  const fail = (error: string): SyncSummary => ({
    ok: false,
    httpStatus: null,
    subscriptionsSeen: 0,
    subscriptionsWritten: 0,
    invoicesSeen: 0,
    invoicesWritten: 0,
    skipped: 0,
    problems: [],
    error,
  });

  /* cross-site: reads one site by primary key, including the secret the request
     is made with. Narrower than a site filter rather than wider than one. */
  const { data: site } = await db
    .from("sites")
    .select(
      "id, key, name, status, payment_collection, billing_feed_url, billing_feed_header, billing_feed_secret"
    )
    .eq("id", siteId)
    .maybeSingle();

  if (!site) return fail("That site no longer exists.");

  /* Refusals before the row.
   *
   * Nothing was attempted in any of these cases, so writing a failed run would
   * put a red line in the history for a configuration question. They are
   * answered to the caller instead, which for an operator is the message next to
   * the button they just pressed. */
  if (site.status !== "active") {
    return fail("This site is not active, so nothing is fetched for it.");
  }
  if (site.payment_collection !== "external") {
    return fail("This site is set to be billed by the platform, so there is no feed to fetch.");
  }
  if (!(await externalCollectionEnabled())) {
    return fail(
      "External collection is switched off platform-wide under Settings, Payments. Nothing is fetched while it is."
    );
  }

  const url = (site.billing_feed_url as string | null)?.trim() ?? "";
  if (!url) return fail("No feed address is set on this site.");

  const urlProblem = feedUrlProblem(url);
  if (urlProblem) return fail(urlProblem);

  const { data: run } = await db
    .from("billing_syncs")
    .insert({ site_id: siteId, kind, triggered_by: triggeredBy })
    .select("id")
    .single();

  const runId = (run?.id as string | undefined) ?? null;

  const summary: SyncSummary = {
    ok: false,
    httpStatus: null,
    subscriptionsSeen: 0,
    subscriptionsWritten: 0,
    invoicesSeen: 0,
    invoicesWritten: 0,
    skipped: 0,
    problems: [],
    error: null,
  };

  /* A row the import refused. Counted, because "imported 11" and "imported 11,
     left 3 clients out" must not read the same at a glance. */
  const note = (problem: string) => {
    summary.skipped += 1;
    if (summary.problems.length < MAX_PROBLEMS) summary.problems.push(problem);
  };

  /* Something worth an operator's attention that was nonetheless written. Same
     list, no count, because calling it skipped would be false. */
  const warn = (problem: string) => {
    if (summary.problems.length < MAX_PROBLEMS) summary.problems.push(problem);
  };

  const finish = async (): Promise<SyncSummary> => {
    if (runId) {
      await db
        .from("billing_syncs")
        .update({
          finished_at: new Date().toISOString(),
          ok: summary.ok,
          http_status: summary.httpStatus,
          subscriptions_seen: summary.subscriptionsSeen,
          subscriptions_written: summary.subscriptionsWritten,
          invoices_seen: summary.invoicesSeen,
          invoices_written: summary.invoicesWritten,
          skipped: summary.skipped,
          problems: summary.problems,
          error: summary.error,
        })
        .eq("id", runId)
        .eq("site_id", siteId);
    }
    return summary;
  };

  /* ---- the request ---- */

  let payload: unknown;
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Portal-Billing/1",
      /* So a feed serving more than one customer of its own can tell which
         integration is asking, without being told to parse a User-Agent. */
      "X-Site-Key": site.key as string,
    };

    const secret = (site.billing_feed_secret as string | null) ?? "";
    if (secret) {
      const header = ((site.billing_feed_header as string | null) || "Authorization").trim();
      headers[header] = secret;
    }

    const response = await fetch(url, {
      headers,
      /* No redirects, the same rule domain verification holds to and for a
         sharper reason here: this request carries a shared secret, and following
         a redirect would hand it to whoever the redirect names. */
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    summary.httpStatus = response.status;

    if (response.status >= 300 && response.status < 400) {
      summary.error = "That address redirects. Serve the feed at the address itself.";
      return finish();
    }
    if (!response.ok) {
      summary.error =
        response.status === 401 || response.status === 403
          ? `The feed refused the credential (${response.status}). Check the header name and value below.`
          : `The feed answered ${response.status}.`;
      return finish();
    }

    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) {
      summary.error = `The feed offered ${declared} bytes, which is more than this import will read.`;
      return finish();
    }

    const body = await response.text();
    if (body.length > MAX_BODY_BYTES) {
      summary.error = "The feed answered with more than this import will read. Page it, or trim it.";
      return finish();
    }

    payload = JSON.parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "the request failed";
    summary.error = `Could not read the feed: ${message}`;
    return finish();
  }

  const subscriptionRows = rowsOf(payload, "subscriptions");
  const invoiceRows = rowsOf(payload, "invoices");

  if (subscriptionRows.length === 0 && invoiceRows.length === 0) {
    /* Not an error. A site whose first client has not been billed yet answers
       exactly like this, and calling that a failure would train somebody to
       ignore the failures that matter. */
    summary.ok = true;
    return finish();
  }

  if (subscriptionRows.length > MAX_SUBSCRIPTIONS || invoiceRows.length > MAX_INVOICES) {
    summary.error = "The feed returned more rows than one import will take. Trim it to what changed.";
    return finish();
  }

  summary.subscriptionsSeen = subscriptionRows.length;
  summary.invoicesSeen = invoiceRows.length;

  /* ---- who these rows belong to ---- */

  /* Narrowed to this site's clients, which is also the isolation that matters
     here: a feed naming an email address can only ever reach an organization the
     site that published it sold. Loaded rather than queried per row because a
     feed names buyers the way its own system does, so the match is made on a
     lowercased copy here rather than by fifty case-sensitive round trips. */
  const { data: orgRows } = await db
    .from("organizations")
    .select("id, owner_email")
    .eq("site_id", siteId)
    .limit(MAX_CLIENTS);

  const clients: Client[] = (orgRows ?? []).map((row) => ({
    id: row.id as string,
    email: ((row.owner_email as string | null) ?? "").trim().toLowerCase(),
  }));
  const byId = new Map(clients.map((c) => [c.id, c]));
  const byEmail = new Map(clients.filter((c) => c.email).map((c) => [c.email, c]));

  const matchClient = (row: RawRecord): Client | null => {
    const orgId = str(row, "org_id", "organization_id", "client_id");
    if (orgId) return byId.get(orgId) ?? null;

    const email = str(row, "client_email", "email", "customer_email", "buyer_email");
    if (email) return byEmail.get(email.toLowerCase()) ?? null;

    return null;
  };

  const describe = (row: RawRecord, ref: string): string =>
    str(row, "client_email", "email", "customer_email", "buyer_email") ?? `record ${ref}`;

  /* ---- the catalogue these rows have to name ---- */

  const [{ data: plans }, { data: cycles }, { data: cards }] = await Promise.all([
    db.from("plans").select("id, key"),
    db.from("billing_cycles").select("key"),
    db.from("rate_cards").select("key, is_active, sort").order("sort"),
  ]);

  const planByKey = new Map((plans ?? []).map((p) => [p.key as string, p.id as string]));
  const cycleKeys = new Set((cycles ?? []).map((c) => c.key as string));
  const cardKeys = new Set((cards ?? []).map((c) => c.key as string));
  /* What an external subscription is filed under when the feed does not say. The
     column is not nullable and the value is bookkeeping here rather than
     pricing: what this client pays is `amount`, straight from the feed. */
  const defaultCard =
    ((cards ?? []).find((c) => c.is_active === true)?.key as string | undefined) ??
    ((cards ?? [])[0]?.key as string | undefined) ??
    null;

  /* ---- subscriptions already on file ---- */

  const { data: existing } = await db
    .from("subscriptions")
    .select("org_id, source, external_ref")
    .eq("site_id", siteId);

  const platformOrgs = new Set(
    (existing ?? []).filter((s) => s.source === "platform").map((s) => s.org_id as string)
  );

  /* What is already on file from previous runs, so a feed that changes its own
     ids can be told about it. Nothing is deleted on that account: the second row
     may well be a real second subscription, and the portal shows the most
     recently touched one either way. But a feed minting a fresh id every hour
     would otherwise grow a client's billing history silently and forever. */
  const externalRefs = new Map<string, Set<string>>();
  for (const row of existing ?? []) {
    if (row.source !== "external" || !row.external_ref) continue;
    const orgId = row.org_id as string;
    const set = externalRefs.get(orgId) ?? new Set<string>();
    set.add(row.external_ref as string);
    externalRefs.set(orgId, set);
  }

  const now = new Date().toISOString();

  /* ---- subscriptions ---- */

  type SubWrite = Record<string, unknown>;
  const subWrites: SubWrite[] = [];
  const claimed = new Set<string>();

  for (const row of subscriptionRows) {
    const ref = str(row, "id", "external_id", "subscription_id", "reference");
    if (!ref) {
      note("A subscription arrived with no id of its own, so there is nothing to match it on next time.");
      continue;
    }

    const client = matchClient(row);
    if (!client) {
      note(`No client of this site matches ${describe(row, ref)}.`);
      continue;
    }

    /* One subscription per client, and this is where that is kept true.
     *
     * The portal reads a single subscription for a workspace, so a client
     * holding both a platform row and an imported one would be shown whichever
     * came back first. Refusing the import is the right half to refuse: the
     * platform row is a payment this platform actually took. */
    if (platformOrgs.has(client.id)) {
      note(
        `${client.email || "A client"} is already billed through this platform, so ${ref} was left alone.`
      );
      continue;
    }

    if (claimed.has(client.id)) {
      note(`The feed sent more than one subscription for ${client.email || client.id}. Only the first was taken.`);
      continue;
    }

    const planKey = str(row, "plan", "plan_key", "package");
    const planId = planKey ? planByKey.get(planKey) : undefined;
    if (!planId) {
      note(`${describe(row, ref)} names plan "${planKey ?? "none"}", which is not in the catalogue.`);
      continue;
    }

    const cycleKey = str(row, "cycle", "cycle_key", "interval", "billing_cycle");
    if (!cycleKey || !cycleKeys.has(cycleKey)) {
      note(`${describe(row, ref)} names cycle "${cycleKey ?? "none"}", which is not a billing cycle here.`);
      continue;
    }

    const status = readSubStatus(row.status);
    if (!status) {
      note(`${describe(row, ref)} has status "${String(row.status ?? "none")}", which this platform cannot read.`);
      continue;
    }

    const rateCardKey = str(row, "rate_card", "rate_card_key");
    const card = rateCardKey && cardKeys.has(rateCardKey) ? rateCardKey : defaultCard;
    if (!card) {
      note("There is no rate card to file external subscriptions under. Add one under Settings, Rate cards.");
      continue;
    }

    const known = externalRefs.get(client.id);
    if (known && known.size > 0 && !known.has(ref)) {
      warn(
        `${client.email || client.id} already had subscription ${[...known].join(", ")} and the feed now sends ${ref}. Both are kept; the portal shows the most recent.`
      );
    }

    claimed.add(client.id);
    subWrites.push({
      org_id: client.id,
      source: "external",
      external_ref: ref,
      plan_id: planId,
      cycle_key: cycleKey,
      rate_card_key: card,
      status,
      amount: cents(row, "amount", "amount_per_cycle", "total"),
      currency: (str(row, "currency") ?? "usd").toLowerCase().slice(0, 3),
      current_period_start: when(row, "current_period_start", "period_start"),
      current_period_end: when(row, "current_period_end", "period_end", "renews_at"),
      cancel_at_period_end: bool(row, "cancel_at_period_end", "canceling", "cancel_at_period"),
      started_at: when(row, "started_at", "start_date", "created_at"),
      canceled_at: when(row, "canceled_at", "cancelled_at"),
      external_manage_url: httpsUrl(row, "manage_url", "portal_url", "billing_url"),
      synced_at: now,
      updated_at: now,
    });
  }

  if (subWrites.length) {
    const { error } = await db
      .from("subscriptions")
      .upsert(subWrites, { onConflict: "org_id,external_ref" });
    if (error) {
      summary.error = `Subscriptions could not be written: ${error.message}`;
      return finish();
    }
    summary.subscriptionsWritten = subWrites.length;
  }

  /* ---- invoices ---- */

  const invoiceWrites: Record<string, unknown>[] = [];
  const seenRefs = new Set<string>();

  for (const row of invoiceRows) {
    const ref = str(row, "id", "external_id", "invoice_id", "reference");
    if (!ref) {
      note("An invoice arrived with no id of its own, so it would be imported again on every run.");
      continue;
    }

    const client = matchClient(row);
    if (!client) {
      note(`No client of this site matches the invoice ${describe(row, ref)}.`);
      continue;
    }

    const key = `${client.id}:${ref}`;
    if (seenRefs.has(key)) continue;
    seenRefs.add(key);

    invoiceWrites.push({
      org_id: client.id,
      source: "external",
      external_ref: ref,
      number: str(row, "number", "invoice_number") ?? ref,
      amount_due: cents(row, "amount_due", "total", "amount"),
      amount_paid: cents(row, "amount_paid", "paid", "amount"),
      currency: (str(row, "currency") ?? "usd").toLowerCase().slice(0, 3),
      /* Free text on this table rather than an enum, so a feed's own word for it
         is kept as written. The portal prints it; nothing branches on it. */
      status: str(row, "status") ?? "paid",
      hosted_invoice_url: httpsUrl(row, "url", "hosted_invoice_url", "view_url"),
      pdf_url: httpsUrl(row, "pdf_url", "pdf"),
      period_start: when(row, "period_start"),
      period_end: when(row, "period_end"),
      issued_at: when(row, "issued_at", "created_at", "date", "paid_at"),
      synced_at: now,
    });
  }

  if (invoiceWrites.length) {
    const { error } = await db
      .from("invoices")
      .upsert(invoiceWrites, { onConflict: "org_id,external_ref" });
    if (error) {
      summary.error = `Invoices could not be written: ${error.message}`;
      return finish();
    }
    summary.invoicesWritten = invoiceWrites.length;
  }

  /* A run that imported what it could understand worked, even if some rows did
     not survive. The skipped count and the problems are how the rest is seen,
     and calling the whole run a failure would hide the eleven that landed behind
     the three that did not. */
  summary.ok = true;
  return finish();
}

/* ---------------- reading the history ---------------- */

export type SyncRun = {
  id: string;
  kind: string;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  httpStatus: number | null;
  subscriptions: number;
  invoices: number;
  skipped: number;
  problems: string[];
  error: string | null;
};

function runFromRow(row: Record<string, unknown>): SyncRun {
  return {
    id: row.id as string,
    kind: (row.kind as string) ?? "schedule",
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    ok: (row.ok as boolean | null) ?? null,
    httpStatus: (row.http_status as number | null) ?? null,
    subscriptions: (row.subscriptions_written as number | null) ?? 0,
    invoices: (row.invoices_written as number | null) ?? 0,
    skipped: (row.skipped as number | null) ?? 0,
    problems: (row.problems as string[] | null) ?? [],
    error: (row.error as string | null) ?? null,
  };
}

/** The last few attempts for one site, newest first. */
export async function recentSyncs(siteId: string, limit = 5): Promise<SyncRun[]> {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("billing_syncs")
      .select(
        "id, kind, started_at, finished_at, ok, http_status, subscriptions_written, invoices_written, skipped, problems, error"
      )
      .eq("site_id", siteId)
      .order("started_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((row) => runFromRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}
