-- Portal :: R4 :: portable row level security
--
-- This migration removes the last thing tying this schema to one vendor, and it
-- does it by deleting a dependency rather than by adding an abstraction.
--
-- The story worth recording, because the obvious conclusion was wrong.
--
-- Moving off PostgREST onto a direct Postgres connection looked like it meant
-- giving up row level security, and therefore rewriting authorization for three
-- hundred queries into application code. Every policy in 0008 keys off
-- auth.uid(), auth.uid() is a Supabase function, so leaving Supabase appeared to
-- take the whole security model with it.
--
-- It does not, because auth.uid() is not doing anything privileged. It reads a
-- session variable:
--
--     current_setting('request.jwt.claims')::json ->> 'sub'
--
-- PostgREST sets that variable at the start of each request from the verified
-- JWT. That is the entire mechanism. Any client that can issue `set_config` can
-- do the same thing, and `set_config` is plain Postgres. So RLS is not a
-- Supabase feature this schema depends on; it is a Postgres feature that
-- Supabase happens to wire up for you.
--
-- What this migration does is take over that wiring. `current_actor()` reads the
-- application's own session variable first and falls back to the JWT claim, so
-- both paths resolve to the same person and the same policies apply to both.
--
-- The consequence that matters: the application can migrate one query at a time
-- from PostgREST to SQL, on the database it is already running, with policies
-- holding continuously across the move. There is no window where a table is
-- reachable but unprotected, which is exactly the window a rewrite-authorization
-- -into-code plan would have opened for as long as it took.
--
-- ---
--
-- Two things the deployment has to get right for any of this to be true, and
-- they are stated here because the schema cannot enforce either of them.
--
--   1. The application must connect as a role that does NOT bypass RLS.
--      Postgres exempts superusers and table owners from every policy, silently.
--      A connection string authenticating as `postgres` therefore reads every
--      row on the system no matter what is written below. See the role section
--      at the end of this file.
--
--   2. The actor must be set transaction-locally, never on the connection.
--      Connections are pooled and reused across requests. A variable set with
--      set_config(..., false) outlives the request that set it, and the next
--      request to check out that connection inherits somebody else's identity.
--      packages/core/src/db/actor.ts sets it with `is_local => true` inside a
--      transaction for this reason, and that is the single most important line
--      in this whole design.
--
-- The failure mode when the actor is not set at all is worth knowing, because it
-- is the good one: current_actor() returns null, every client policy evaluates
-- against a null user and matches nothing, and the query returns zero rows. A
-- forgotten wrapper produces an empty screen, which somebody reports in an hour.
-- It does not produce another tenant's data.

-- The actor ------------------------------------------------------------------

/**
 * Who this transaction is running as.
 *
 * Written as plpgsql rather than sql because the JWT fallback has to tolerate a
 * claims blob that is absent, empty, or not valid JSON, and an expression form
 * would fail the whole query instead of falling through to null.
 *
 * `true` as the second argument to current_setting is "missing_ok": without it,
 * reading an unset variable raises rather than returning null, and unset is the
 * normal state on a connection doing system work.
 */
create or replace function current_actor()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  raw text;
begin
  /* The application's own variable, set per transaction by asActor(). */
  raw := nullif(current_setting('portal.actor', true), '');
  if raw is not null then
    begin
      return raw::uuid;
    exception when others then
      /* A malformed value is not an identity. Refusing here rather than raising
         keeps a corrupted variable from taking down every query on the
         connection. */
      return null;
    end;
  end if;

  /* PostgREST, including Supabase, sets this from the verified token. Kept so
     the two access paths agree while queries are still being migrated, and
     harmless afterwards: on a database nothing sets it on, it is always null. */
  begin
    raw := nullif(current_setting('request.jwt.claims', true), '');
    if raw is not null then
      return (raw::json ->> 'sub')::uuid;
    end if;
  exception when others then
    return null;
  end;

  return null;
end;
$$;

comment on function current_actor is
  'The signed-in user for this transaction. Reads portal.actor, falling back to the PostgREST JWT claim. Null when neither is set, which every client policy treats as "no rows".';

/**
 * Deliberate, audited work with no user behind it.
 *
 * Webhook handlers, the scheduled drain, provisioning after a payment, and the
 * migration runner all act on rows belonging to people who are not making the
 * request. Under PostgREST that was the service role key, which bypassed RLS
 * wholesale and was the reason the last security review could point at "any
 * staff credential reads every table".
 *
 * This is the narrower replacement: a transaction-local flag, set only by
 * asSystem() in the data layer, which takes a written reason. It is greppable,
 * it is scoped to one transaction, and it cannot be set by a query that came in
 * from outside, because the only way to compose SQL in this application is a
 * tagged template that binds every interpolation as a parameter.
 *
 * A deployment that wants a harder guarantee than that can give system work its
 * own connection as the table owner and leave this always false. The trade is a
 * second pool, which on a small managed plan is a real cost in connections.
 */
create or replace function is_system()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(current_setting('portal.system', true), '') = 'on';
$$;

comment on function is_system is
  'True inside asSystem(). Grants the escape hatch that the service role key used to be, scoped to one transaction and one named reason.';

-- Rebind the helpers ----------------------------------------------------------
--
-- These three took auth.uid() as a default argument, which is the cheap seam:
-- every policy calling is_staff() with no argument picks up the new source
-- without the policy itself being touched.

create or replace function is_staff(uid uuid default current_actor())
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_system() or exists (select 1 from profiles where id = uid and is_staff = true);
$$;

create or replace function current_org_ids(uid uuid default current_actor())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select org_id from memberships where user_id = uid;
$$;

create or replace function is_staff_owner(uid uuid default current_actor())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from staff_roles where user_id = uid and role = 'owner');
$$;

/* is_member keeps its explicit signature; what changes is that every caller now
   passes current_actor() instead of auth.uid(). The system flag is honoured here
   too, so provisioning can write an organization's first rows before anybody is
   a member of it. */
create or replace function is_member(uid uuid, target_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_system() or exists (
    select 1 from memberships
    where user_id = uid and org_id = target_org
  );
$$;

-- Repoint the policies --------------------------------------------------------
--
-- Only the ones that named auth.uid() in their own expression. Everything
-- calling is_staff() or current_org_ids() with no argument was already fixed by
-- the rebinding above.
--
-- Dropped and recreated rather than altered, because Postgres has no
-- ALTER POLICY that can rewrite a USING clause in place across versions worth
-- supporting.

drop policy if exists self_read on profiles;
create policy self_read on profiles for select to authenticated
  using (id = current_actor() or is_staff());

drop policy if exists self_update on profiles;
create policy self_update on profiles for update to authenticated
  using (id = current_actor()) with check (id = current_actor());

drop policy if exists own_memberships on memberships;
create policy own_memberships on memberships for select to authenticated
  using (user_id = current_actor());

drop policy if exists own_notifications on notifications;
create policy own_notifications on notifications for select to authenticated
  using (user_id = current_actor());

drop policy if exists own_notifications_update on notifications;
create policy own_notifications_update on notifications for update to authenticated
  using (user_id = current_actor()) with check (user_id = current_actor());

drop policy if exists client_read on organizations;
create policy client_read on organizations for select to authenticated
  using (is_member(current_actor(), id));

do $$
declare t text;
begin
  foreach t in array array[
    'subscriptions','invoices','brand_profiles','brand_platforms',
    'batches','posts','activity_log'
  ]
  loop
    execute format('drop policy if exists client_read on %I', t);
    execute format(
      'create policy client_read on %I for select to authenticated using (is_member(current_actor(), org_id))', t
    );
  end loop;
end $$;

drop policy if exists client_read on post_platform_copy;
create policy client_read on post_platform_copy for select to authenticated
  using (exists (
    select 1 from posts p
    where p.id = post_platform_copy.post_id
      and is_member(current_actor(), p.org_id)
  ));

drop policy if exists client_read on revisions;
create policy client_read on revisions for select to authenticated
  using (is_member(current_actor(), org_id_of_batch(batch_id)));

drop policy if exists client_read on assets;
create policy client_read on assets for select to authenticated
  using (
    (org_id is not null and is_member(current_actor(), org_id))
    or exists (
      select 1 from posts p
      where is_member(current_actor(), p.org_id)
        and (p.design_asset_id = assets.id)
    )
  );

drop policy if exists client_read on comments;
create policy client_read on comments for select to authenticated
  using (
    is_internal = false
    and exists (
      select 1 from posts p
      where p.id = comments.post_id and is_member(current_actor(), p.org_id)
    )
  );

drop policy if exists client_comment on comments;
create policy client_comment on comments for insert to authenticated
  with check (
    is_internal = false
    and author_id = current_actor()
    and exists (
      select 1 from posts p
      where p.id = comments.post_id and is_member(current_actor(), p.org_id)
    )
  );

drop policy if exists client_request_revision on revisions;
create policy client_request_revision on revisions for insert to authenticated
  with check (
    requested_by = current_actor()
    and is_member(current_actor(), org_id_of_batch(batch_id))
  );

/* Orders, added in 0028 after the original RLS pass. */
do $$
begin
  if to_regclass('public.orders') is not null then
    drop policy if exists client_read on orders;
    create policy client_read on orders for select to authenticated
      using (org_id is not null and is_member(current_actor(), org_id));
  end if;
end $$;

-- The application role --------------------------------------------------------
--
-- Everything above is decoration unless the application connects as a role that
-- policies actually apply to. Postgres exempts superusers and table owners from
-- RLS silently: no error, no warning, just every row.
--
-- This creates `portal_app` with exactly the rights the running application
-- needs and none of the ones that would exempt it. The connection string given
-- to the app at /setup should authenticate as this role. The migration runner
-- keeps using the owner connection, because creating tables is not something the
-- application does.
--
-- Guarded, because a managed provider may not permit role creation from a
-- migration, and that must degrade to an instruction rather than a failed
-- deploy.

do $$
declare
  app_password text;
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_app') then
    /* No password set here on purpose. A password written in a migration is a
       password in version control and in every backup of this database. The
       operator sets it once, out of band:
         alter role portal_app with login password '...'; */
    create role portal_app nologin;
    raise notice 'Created role portal_app. Set a password and enable login before using it: ALTER ROLE portal_app WITH LOGIN PASSWORD ''...'';';
  end if;

  /* Schema and sequence access, then table privileges. No DDL, no ownership. */
  execute 'grant usage on schema public to portal_app';
  execute 'grant select, insert, update, delete on all tables in schema public to portal_app';
  execute 'grant usage, select on all sequences in schema public to portal_app';
  execute 'grant execute on all functions in schema public to portal_app';

  /* Anything a later migration creates, too. Without this every new table is
     invisible to the application until somebody remembers to grant it. */
  execute 'alter default privileges in schema public grant select, insert, update, delete on tables to portal_app';
  execute 'alter default privileges in schema public grant usage, select on sequences to portal_app';
  execute 'alter default privileges in schema public grant execute on functions to portal_app';

exception
  when insufficient_privilege then
    raise notice 'Not permitted to create roles here. Create portal_app by hand with the grants listed in this migration.';
end $$;

/*
 * The policies above are written `to authenticated`, which is Supabase's role
 * name. On a plain Postgres that role does not exist, so the policies would
 * apply to nobody and every query through portal_app would return nothing.
 *
 * Creating the role rather than rewriting twenty policies keeps one definition
 * of each policy across both kinds of deployment, and `authenticated` is a
 * reasonable name for "a connection acting on behalf of a signed-in person"
 * regardless of who invented it.
 */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
    raise notice 'Created role authenticated for policy compatibility.';
  end if;

  execute 'grant authenticated to portal_app';
exception
  when insufficient_privilege then
    raise notice 'Could not grant authenticated to portal_app. Do this by hand.';
end $$;
