-- Portal :: R3 :: rate limits
--
-- Until now nothing on this platform counted requests. Every endpoint answered
-- as fast as it was asked, which is the same thing as saying a script with a
-- valid key, or no key at all, could read the entire public surface in a loop
-- for as long as it liked. Authorization said who may read a row. Nothing said
-- how many times.
--
-- This is the counter. One row per (bucket, window), incremented on the way in,
-- and the increment is the read: the function returns the count it just wrote,
-- so there is no read-then-write gap for two concurrent requests to slip
-- through. That is the whole reason this is a function and not two statements in
-- the application.
--
-- Fixed window rather than sliding, deliberately. A sliding window needs either
-- a row per request or a sorted set, and the honest version of that on Postgres
-- is more machinery than the problem needs. The known weakness of a fixed window
-- is the boundary: a caller can spend its budget at the end of one window and
-- again at the start of the next, so the real worst case is twice the stated
-- limit across two adjacent windows. Every limit below is set with that doubling
-- already assumed, which is cheaper than pretending otherwise.
--
-- Why in Postgres at all, when the application could hold a Map. Because the
-- application is serverless and there is no "the application": each instance
-- would hold its own count, and a caller spread across ten cold starts would get
-- ten times the budget. In-process counting is still worth doing as a free first
-- pass, and packages/core/src/ratelimit.ts does exactly that in front of this,
-- but it cannot be the only pass. This table is the one that is actually true.

create table rate_limit_counters (
  /* Identity plus window start, so a new window is a new row rather than an
     update racing a reset. The old rows are garbage, swept below. */
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

comment on table rate_limit_counters is
  'Fixed-window request counts. Written only by rate_limit_hit(); see packages/core/src/ratelimit.ts.';

/* The sweep index. Deleting expired rows is a range scan over window_start and
   nothing else, so the primary key is the wrong shape for it. */
create index rate_limit_counters_window_idx on rate_limit_counters (window_start);

-- No policies, on purpose ----------------------------------------------------
--
-- RLS on with no policy means no role reaches this table through PostgREST at
-- all. The function below is security definer, so it writes regardless, and that
-- is exactly the split wanted here: a caller may spend its budget and may not
-- read, reset, or delete the record of having spent it. A signed-in user who
-- could update this table could grant themselves an unlimited one.
alter table rate_limit_counters enable row level security;

/**
 * Spend one unit against a bucket.
 *
 * Returns the count after this request and the instant the window resets, so the
 * caller can answer with Retry-After without a second query. The comparison
 * against p_limit is left to the caller for one reason: the same bucket is read
 * at two limits in places (a soft threshold that logs, a hard one that refuses),
 * and a function that returned a boolean would have to be called twice.
 *
 * `on conflict do update` is what makes this safe under concurrency. Two
 * requests landing in the same millisecond both take a row lock on the same
 * primary key, so they serialize, and each sees a count the other has already
 * contributed to. Neither can read a stale value, because the returning clause
 * reads the row this statement wrote.
 */
create or replace function rate_limit_hit(
  p_bucket text,
  p_window_seconds integer
)
returns table (hits integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  w_start timestamptz;
begin
  if p_bucket is null or p_bucket = '' or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'rate_limit_hit needs a bucket and a positive window';
  end if;

  /* Floor the clock to the window, so every caller in the same window agrees on
     the same row without passing a start time in and being trusted about it. */
  w_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into rate_limit_counters (bucket, window_start, count)
  values (p_bucket, w_start, 1)
  on conflict (bucket, window_start)
    do update set count = rate_limit_counters.count + 1
  returning rate_limit_counters.count into hits;

  resets_at := w_start + make_interval(secs => p_window_seconds);
  return next;
end;
$$;

comment on function rate_limit_hit is
  'Atomically increments and returns a fixed-window counter. Callers compare against their own limit.';

/* Execute for signed-in users and for the anonymous role alike. The endpoints
   that need limiting most are the ones with no session on them: an unauthorized
   caller has to be countable, or the limit protects only the people who logged
   in. The function cannot leak anything, since it returns only the caller's own
   count for a bucket the caller already named. */
revoke all on function rate_limit_hit(text, integer) from public;
grant execute on function rate_limit_hit(text, integer) to anon, authenticated, service_role;

/**
 * Sweep. Anything older than a day is a window nobody can still be inside.
 *
 * Not scheduled here, because pg_cron is a platform extension and this file has
 * to apply on a plain Postgres too. Point the same scheduler that drains
 * webhooks at it, or let it ride: the table is small and the index makes the
 * delete cheap whenever it does run.
 */
create or replace function rate_limit_sweep()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from rate_limit_counters where window_start < now() - interval '1 day';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function rate_limit_sweep() from public;
grant execute on function rate_limit_sweep() to service_role;
