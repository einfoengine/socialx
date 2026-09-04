-- socialX portal :: R0 :: cross-org isolation test
--
-- R0 is not done until this passes. It proves the claim the whole security model
-- rests on: a client session cannot read another organization's data, and cannot
-- read the library at all, regardless of what the application layer does.
--
-- Run in the Supabase SQL editor against a non-production project.
-- It creates two orgs, asserts isolation, and rolls everything back.

begin;

do $$
declare
  org_a   uuid;
  org_b   uuid;
  user_a  uuid := gen_random_uuid();
  batch_a uuid;
  batch_b uuid;
  seen    int;
begin
  -- Fixtures ---------------------------------------------------------------
  insert into organizations (name, slug, status)
    values ('Org A','org-a','active') returning id into org_a;
  insert into organizations (name, slug, status)
    values ('Org B','org-b','active') returning id into org_b;

  -- profiles.id references auth.users, so create a real auth user. This also
  -- exercises the on_auth_user_created trigger: the profile should appear by itself.
  insert into auth.users (id, email) values (user_a, 'rls-test@example.invalid');

  if not exists (select 1 from profiles where id = user_a) then
    raise exception 'FAIL: the on_auth_user_created trigger did not create a profile.';
  end if;

  insert into memberships (org_id, user_id, role) values (org_a, user_a, 'owner');

  insert into batches (org_id, period_start, period_end, quota_posts, quota_platforms, revision_rounds_allowed)
    values (org_a, date '2026-09-01', date '2026-09-30', 16, 3, 2) returning id into batch_a;
  insert into batches (org_id, period_start, period_end, quota_posts, quota_platforms, revision_rounds_allowed)
    values (org_b, date '2026-09-01', date '2026-09-30', 16, 3, 2) returning id into batch_b;

  -- A real template, so the library assertion below is not vacuously true. Without
  -- this the "client sees 0 templates" check would pass even with RLS disabled.
  insert into templates (code, title, pillar_key, status)
    values ('RLS-TEST-1', 'Isolation fixture', 'education', 'published');

  -- Same for hl_connections.
  insert into hl_connections (org_id, location_id, status)
    values (org_b, 'loc_test', 'connected');

  -- Act as user A ----------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role','authenticated')::text, true);

  -- 1. Sees its own batch.
  select count(*) into seen from batches where org_id = org_a;
  if seen <> 1 then
    raise exception 'FAIL: user A should see 1 batch in its own org, saw %', seen;
  end if;

  -- 2. Cannot see org B's batch, even asking for it directly by id.
  select count(*) into seen from batches where id = batch_b;
  if seen <> 0 then
    raise exception 'FAIL: user A read org B''s batch. RLS is not holding.';
  end if;

  -- 3. Cannot see org B at all.
  select count(*) into seen from organizations where id = org_b;
  if seen <> 0 then
    raise exception 'FAIL: user A read org B''s organization row.';
  end if;

  -- 4. Cannot read the library. It is socialX IP; clients see their batch only.
  select count(*) into seen from templates;
  if seen <> 0 then
    raise exception 'FAIL: a client session read % template rows. A fixture template exists, so the library is leaking.', seen;
  end if;

  -- 5. Cannot read HighLevel tokens.
  select count(*) into seen from hl_connections;
  if seen <> 0 then
    raise exception 'FAIL: a client session read hl_connections.';
  end if;

  -- 6. Can read the price catalog, which is public to signed-in users.
  select count(*) into seen from plan_prices;
  if seen = 0 then
    raise exception 'FAIL: catalog should be readable by any signed-in user.';
  end if;

  perform set_config('role', 'postgres', true);
  raise notice 'PASS: cross-org isolation holds on all six checks.';
end $$;

rollback;
