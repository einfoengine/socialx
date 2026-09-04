-- Portal :: bootstrap :: make the rest of these migrations apply anywhere
--
-- Numbered 0000 so it sorts before everything. It is new, but it belongs at the
-- front rather than the back, and the migration runner sorts by filename and
-- skips what the ledger already records, so an existing database picks it up as
-- a no-op whenever it next migrates and a fresh one runs it first.
--
-- The problem it solves is small and completely blocking. Migration 0002 writes:
--
--     id uuid primary key references auth.users(id) on delete cascade
--
-- On Supabase that resolves, because GoTrue owns an `auth` schema with a `users`
-- table in it. On a plain Postgres from DigitalOcean, RDS, or a container on the
-- same host, there is no such schema, the foreign key cannot be created, and the
-- install dies at the second migration out of thirty. Every later claim about
-- this product running on any Postgres is false until that is fixed.
--
-- Three ways to fix it, and the choice matters:
--
--   Edit 0002 to drop the reference. Rewrites a migration that has already
--   applied on a live database, so the file on disk stops describing what is
--   actually deployed. That is how migration ledgers start lying.
--
--   Make every later migration conditional. Spreads the vendor assumption
--   across thirty files instead of removing it from one.
--
--   Provide the thing that is missing, once, here. A four column table in a
--   schema nobody else claims. Later migrations stay exactly as written, they
--   apply identically on both kinds of database, and 0031 moves identity onto a
--   table this project actually owns, after which this shim is vestigial and
--   carries no rows.
--
-- The guard is the whole file. On Supabase, `auth.users` already exists, nothing
-- below fires, and GoTrue is untouched. Creating a table into a schema owned by
-- another service would be a genuinely bad idea, so the condition is checked on
-- the table rather than on the schema.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    raise notice 'auth.users already exists; leaving it alone.';
    return;
  end if;

  execute 'create schema if not exists auth';

  /*
   * Deliberately the smallest shape the existing migrations actually read, not
   * an imitation of GoTrue's table. 0002's trigger reads id, email and
   * raw_user_meta_data; 0017's function reads encrypted_password. Nothing else
   * in this project has ever touched it, and inventing the other thirty columns
   * would suggest this is a place to store things. It is not: after 0031,
   * identity lives in portal_users and this stays empty on a fresh install.
   */
  execute $ddl$
    create table auth.users (
      id                 uuid primary key default gen_random_uuid(),
      email              text,
      encrypted_password text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at         timestamptz not null default now(),
      last_sign_in_at    timestamptz
    )
  $ddl$;

  raise notice 'Created a minimal auth.users so the existing migrations apply. Identity moves to portal_users in 0031.';
end $$;

-- The rest of the compatibility surface -------------------------------------
--
-- `auth.users` was the first thing missing, not the only one. The migrations
-- written against Supabase also call auth.uid(), and grant to and revoke from
-- the three roles PostgREST defines. None of those exist on a stock Postgres,
-- and each one stops the install at a different file.
--
-- Providing them here is what keeps every migration from 0002 to 0029 exactly as
-- it was written and already deployed. The alternative was thirty conditional
-- files, or a rewrite of history, and both are worse than sixty lines that say
-- plainly what is being stood in for.

do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    /*
     * The same thing Supabase's function does: read the verified claims that the
     * request layer put on this session. Written to also read portal.actor, so
     * that on a plain Postgres the policies in 0008 work from the moment they are
     * created rather than only after 0030 replaces them. On Supabase this branch
     * never runs and GoTrue's own function is left alone.
     */
    execute $fn$
      create function auth.uid() returns uuid
      language plpgsql stable
      as $body$
      declare raw text;
      begin
        raw := nullif(current_setting('portal.actor', true), '');
        if raw is not null then
          begin return raw::uuid; exception when others then return null; end;
        end if;
        begin
          raw := nullif(current_setting('request.jwt.claims', true), '');
          if raw is not null then return (raw::json ->> 'sub')::uuid; end if;
        exception when others then return null;
        end;
        return null;
      end
      $body$;
    $fn$;
    raise notice 'Created a stand-in auth.uid(). Migration 0031 supersedes it with current_actor().';
  end if;
end $$;

/*
 * PostgREST's three roles.
 *
 * `authenticated` is the one every policy in 0008 is written `to`, so without it
 * the policies apply to nobody and the application reads nothing. `anon` and
 * `service_role` appear only in grants and revokes, but a revoke against a role
 * that does not exist is an error, and an error is a failed migration.
 *
 * Created NOLOGIN. They are grant targets here, not accounts: the application
 * connects as portal_app, which is granted `authenticated` in 0030.
 */
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role']
  loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
      raise notice 'Created role % for policy and grant compatibility.', r;
    end if;
  end loop;
exception
  when insufficient_privilege then
    raise notice 'Not permitted to create roles here. Create anon, authenticated and service_role by hand.';
end $$;

/*
 * pgcrypto, for gen_random_uuid().
 *
 * Supabase enables it on every project. A stock Postgres does not, and every
 * `default gen_random_uuid()` in the migrations that follow would fail without
 * it. Postgres 13 and later provide the function in core, so this is only doing
 * anything on older servers, but it costs nothing and turns a confusing failure
 * on an old box into a working install.
 */
create extension if not exists pgcrypto;
