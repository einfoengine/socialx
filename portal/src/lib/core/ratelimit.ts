import "server-only";

import { createServiceClient } from "./supabase/service";

/**
 * How many times, and how fast.
 *
 * Every other guard on this platform answers "may this caller read this row".
 * None of them answer "may this caller read every row, once a second, forever",
 * and those are different questions. A credential that is allowed to read a
 * site's content is allowed to read all of it; what stops that from becoming a
 * copy of the database is a budget, and this is where the budget lives.
 *
 * Two layers, and the split is the whole design.
 *
 *   The burst layer is a Map in this process. It costs nothing, it answers in
 *   microseconds, and it catches the thing that actually happens: a loop hammering
 *   one endpoint, which lands on one warm instance and is refused there before any
 *   database is touched. What it cannot do is be true, because a serverless deploy
 *   is many processes and a caller spread across them gets a budget per process.
 *
 *   The durable layer is a row in Postgres, shared by every instance, and it is
 *   the one that actually holds. It costs a round trip, so it is not spent on
 *   every request of every kind: it guards the endpoints where being wrong is
 *   expensive, and the burst layer runs in front of it so a caller already over
 *   its per-process budget never reaches it at all.
 *
 * On failure this fails open, and that is a deliberate and arguable choice worth
 * stating rather than burying. A rate limiter is not an authorization boundary.
 * Everything reachable behind one of these calls has already been authorized by
 * something that fails closed, so an unreachable counter costs abuse resistance
 * for as long as it is down, while failing closed would cost the product itself.
 * The burst layer keeps working through it either way, because it depends on
 * nothing.
 */

export type Budget = {
  /** Requests permitted in one window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type Verdict = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. Only meaningful when ok is false. */
  retryAfter: number;
};

/* ---------------- the burst layer ---------------- */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/*
 * The cap is a memory bound, not a policy. Without it a limiter keyed by IP is
 * itself the memory leak: every distinct caller allocates an entry and nothing
 * ever removes it. When the map is full the oldest windows are dropped, which
 * loses their counts. That is acceptable in a layer that is explicitly an
 * optimistic pre-filter, and it is the reason the durable layer exists.
 */
const MAX_WINDOWS = 20_000;

function sweep(now: number): void {
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
  if (windows.size <= MAX_WINDOWS) return;
  /* Still over after expiry. Drop in insertion order, which for a Map is the
     oldest first. */
  const excess = windows.size - MAX_WINDOWS;
  let dropped = 0;
  for (const key of windows.keys()) {
    windows.delete(key);
    if (++dropped >= excess) break;
  }
}

/**
 * Spend one unit against this process's own counter.
 *
 * Synchronous and allocation-light on the hot path: a caller inside its budget
 * costs one Map lookup and one integer increment.
 */
export function burst(bucket: string, budget: Budget): Verdict {
  const now = Date.now();
  const windowMs = budget.windowSeconds * 1000;

  /* Sweeping on every call would make this O(n). Sweeping on a fraction of calls
     keeps the amortized cost flat and the map bounded, which is all it needs. */
  if (Math.random() < 0.01) sweep(now);

  const existing = windows.get(bucket);
  if (!existing || existing.resetAt <= now) {
    windows.set(bucket, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit: budget.limit, remaining: budget.limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(budget.limit - existing.count, 0);
  return {
    ok: existing.count <= budget.limit,
    limit: budget.limit,
    remaining,
    retryAfter: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
  };
}

/* ---------------- the durable layer ---------------- */

/**
 * Spend one unit against the shared counter, behind this process's own.
 *
 * The burst budget defaults to the same limit, which is the right default: a
 * single instance has no business letting a caller past the whole platform's
 * budget on its own. Pass a wider `burstBudget` only where a legitimate caller is
 * expected to be spread thin across instances and the per-process view would
 * refuse it unfairly.
 */
export async function spend(
  bucket: string,
  budget: Budget,
  burstBudget: Budget = budget
): Promise<Verdict> {
  const local = burst(bucket, burstBudget);
  if (!local.ok) return { ...local, limit: budget.limit };

  try {
    const db = createServiceClient();
    const { data, error } = await db.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_window_seconds: budget.windowSeconds,
    });

    if (error || !data) return allowed(budget);

    /* The function returns a set, so PostgREST hands back an array of one. */
    const row = (Array.isArray(data) ? data[0] : data) as
      | { hits: number; resets_at: string }
      | undefined;
    if (!row) return allowed(budget);

    const hits = Number(row.hits) || 0;
    const resetsAt = new Date(row.resets_at).getTime();
    const retryAfter = Math.max(Math.ceil((resetsAt - Date.now()) / 1000), 1);

    return {
      ok: hits <= budget.limit,
      limit: budget.limit,
      remaining: Math.max(budget.limit - hits, 0),
      retryAfter,
    };
  } catch {
    /* Fails open by contract; see the header. The burst layer above already
       applied, so this is not the only thing standing there. */
    return allowed(budget);
  }
}

function allowed(budget: Budget): Verdict {
  return { ok: true, limit: budget.limit, remaining: budget.limit, retryAfter: 0 };
}

/* ---------------- identity ---------------- */

/**
 * Who to count, when there is no credential to count.
 *
 * X-Forwarded-For is a client-settable header everywhere except behind a proxy
 * that overwrites it, and this platform is deployed behind one. The leftmost
 * entry is the originating client as the proxy saw it; anything a caller
 * appended itself lands to the right of that and is ignored here.
 *
 * Worth being honest about the limit of this: a caller behind a large NAT shares
 * a bucket with everyone else behind it, and a caller with a pool of addresses
 * gets a bucket per address. IP is the weakest identity in the file, which is why
 * it is the fallback rather than the primary. Anything holding a credential is
 * counted by the credential.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

/**
 * The headers that tell a well-behaved caller what its budget is.
 *
 * Worth setting even on a success, because the integrator who reads these is the
 * one who will back off on their own and never hit the refusal. The naming is the
 * IETF draft's, which is what most HTTP clients already understand.
 */
export function limitHeaders(verdict: Verdict): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(verdict.limit),
    "RateLimit-Remaining": String(verdict.remaining),
  };
  if (!verdict.ok) headers["Retry-After"] = String(verdict.retryAfter);
  return headers;
}
