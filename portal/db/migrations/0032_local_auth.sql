-- Portal :: R4 :: identity this project owns
--
-- The last piece of the product that only worked on one vendor's infrastructure.
--
-- Row level security turned out to be portable in 0031, because auth.uid() was
-- only ever reading a session variable. Authentication is genuinely not: GoTrue
-- is a separate service that stores password hashes in a schema this project
-- does not own and cannot write to, mints its own tokens, and sends its own
-- emails. There is nothing to rewire. It has to be replaced.
--
-- So: two tables, both in the public schema, both owned by this project.
--
-- What is deliberately NOT here:
--
--   Email delivery. Magic links and password resets need an SMTP configuration
--   that a fresh install does not have, and an install whose only administrator
--   can be locked out by a missing mail server is a bad install. Password sign
--   in works with no external service at all; recovery arrives with SMTP
--   settings and is a separate change.
--
--   Anything about roles. Whether somebody is staff, an owner, or a member of an
--   organization is already answered by staff_roles and memberships, and those
--   answers are read live by the policies from 0008. An identity table that also
--   stored a role would be a second, drifting source of truth for the question
--   authorization actually asks.

-- Identity --------------------------------------------------------------------

create table portal_users (
  id uuid primary key default gen_random_uuid(),

  /*
   * Stored lowercased, with a unique index rather than a unique constraint on a
   * raw column, because "Ana@example.com" and "ana@example.com" are one person
   * and a case sensitive unique index would let both exist. Normalising on the
   * way in and comparing lowercased is the portable version of citext, which is
   * an extension a managed provider may not offer.
   */
  email text not null,

  /*
   * Null means this account cannot sign in with a password. That is a real
   * state, not a broken row: an account created by an administrator before its
   * owner has set one, and every account that will later use SSO or a link.
   * Nullable is what stops the application inventing a placeholder hash that
   * something eventually compares against.
   */
  password_hash text,

  /*
   * The forced rotation flag.
   *
   * Set on any account whose password was chosen by somebody other than its
   * owner: the one the installer creates, and any password an administrator sets
   * on a colleague's behalf. While it is true the session is real but every
   * screen except "change your password" refuses, which is the distinction that
   * matters. Blocking the sign in instead would mean the person cannot
   * authenticate in order to prove they may change it.
   */
  must_change_password boolean not null default false,

  /* Set rather than deleted. Deleting an identity orphans everything that
     references it, and an account that must not sign in is a different thing
     from an account that never existed. */
  disabled_at timestamptz,

  password_changed_at timestamptz,
  last_sign_in_at     timestamptz,
  created_at          timestamptz not null default now()
);

create unique index portal_users_email_key on portal_users (lower(email));

comment on table portal_users is
  'Everyone who can sign in. Replaces auth.users; see 0000_bootstrap.sql for why that table still exists.';

-- Sessions --------------------------------------------------------------------

create table portal_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_users(id) on delete cascade,

  /*
   * The hash of the cookie value, never the value.
   *
   * A session token in a database is a credential in a database: anybody who can
   * read the table, or a backup of it, can sign in as any user who has an open
   * session. Storing SHA-256 of the token makes the table useless for that,
   * costs one hash per request, and is the same reasoning already applied to API
   * keys in lib/api/keys.ts.
   *
   * SHA-256 rather than a slow hash, for the same reason as there: this value is
   * 256 bits from the system CSPRNG, so there is no dictionary to run against
   * it, and a slow hash would only add latency to every authenticated request.
   */
  token_hash text not null unique,

  expires_at timestamptz not null,

  /*
   * Set on sign out and on password change. The reason this column exists at all
   * rather than the row simply being deleted: "this session was revoked" and
   * "this session was never created" want to be distinguishable while anything
   * is still being debugged.
   */
  revoked_at timestamptz,

  /* Recorded for the account activity screen, so somebody can recognise a
     session they do not remember starting. Not used for authorization: an IP
     that changes mid-session is a phone leaving wifi far more often than it is
     a stolen cookie. */
  ip         text,
  user_agent text,

  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index portal_sessions_user_idx on portal_sessions (user_id);
create index portal_sessions_expiry_idx on portal_sessions (expires_at) where revoked_at is null;

comment on table portal_sessions is
  'Live sign-ins. Holds a hash of each cookie value, never the value itself.';

/**
 * Removes sessions nobody can be inside any more.
 *
 * Expired sessions are already refused on every request, so this is hygiene
 * rather than enforcement: without it the table grows forever and the account
 * activity screen fills with rows from last year.
 */
create or replace function portal_sessions_sweep()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare removed integer;
begin
  delete from portal_sessions
   where expires_at < now() - interval '7 days'
      or (revoked_at is not null and revoked_at < now() - interval '7 days');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Move profiles onto it -------------------------------------------------------
--
-- profiles has always been the application-facing half of an identity, with
-- auth.users holding the credential half. The credential half is now
-- portal_users, so the foreign key follows.
--
-- Ids are preserved rather than reissued. On an existing Supabase install every
-- profile, membership, staff role, comment author and activity log entry already
-- points at the id GoTrue minted, and changing it would mean rewriting a dozen
-- tables to no benefit. The backfill below copies those exact ids across, so
-- nothing else in the schema notices this happened.

do $$
declare
  fk_name text;
begin
  select conname into fk_name
    from pg_constraint
   where conrelid = 'public.profiles'::regclass
     and contype = 'f'
     and confrelid = to_regclass('auth.users');

  if fk_name is not null then
    execute format('alter table profiles drop constraint %I', fk_name);
    raise notice 'Dropped profiles -> auth.users foreign key (%).', fk_name;
  end if;
end $$;

/* Backfill from whatever identity store this database already had. Empty on a
   fresh install, and every existing account on a Supabase one.

   The password hash is deliberately NOT copied. GoTrue stores bcrypt and this
   project stores scrypt, the two are not interchangeable, and inventing a
   migration path between them would mean either keeping a bcrypt verifier
   forever or silently locking people out. Existing accounts arrive here with a
   null hash, which reads as "cannot sign in with a password yet" and is resolved
   by the same reset flow a forgotten password uses. */
insert into portal_users (id, email, created_at, last_sign_in_at)
select u.id,
       coalesce(u.email, p.email, u.id::text),
       coalesce(u.created_at, now()),
       u.last_sign_in_at
  from auth.users u
  left join profiles p on p.id = u.id
 where not exists (select 1 from portal_users pu where pu.id = u.id)
on conflict do nothing;

/* Any profile with no matching identity, which is only possible on a database
   where profiles was written directly. Keeps the foreign key below appliable. */
insert into portal_users (id, email, created_at)
select p.id, coalesce(p.email, p.id::text), p.created_at
  from profiles p
 where not exists (select 1 from portal_users pu where pu.id = p.id)
on conflict do nothing;

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references portal_users(id) on delete cascade;

/* The trigger from 0002 mirrored auth.users into profiles. Identity is created
   by the application now, in one transaction, so the mirror is replaced by the
   same guarantee written the other way round. */
create or replace function handle_new_portal_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_portal_user_created on portal_users;
create trigger on_portal_user_created
  after insert on portal_users
  for each row execute function handle_new_portal_user();

-- Access ----------------------------------------------------------------------
--
-- Both tables carry RLS with no policy for reading credentials or other people's
-- sessions. Authentication happens before there is an actor to check, so it runs
-- through asSystem() in the data layer; everything after that is a signed-in
-- person reading their own row.

alter table portal_users enable row level security;
alter table portal_sessions enable row level security;

/* Your own identity, minus the hash: a select of specific columns is what the
   application does, and the policy does not need to enumerate them. Staff read
   the roster for the People screen, which is what they already did through
   listUsers. */
create policy self_read on portal_users for select to authenticated
  using (id = current_actor() or is_staff());

/* Nobody updates this table directly. Changing a password, disabling an account
   and clearing the rotation flag all have consequences beyond the row, so they
   are transactions in the application rather than an update a screen can issue. */

/*
 * Creating an identity, writing a session, and rotating a password all happen
 * before there is an actor, or on behalf of somebody who is not the subject.
 * Signing in is the clearest case: working out who somebody is has to finish
 * before the database can be told who they are, so the lookup and the session
 * insert both run with no actor at all.
 *
 * That work goes through asSystem() in the data layer, which sets portal.system
 * for exactly one transaction and requires a written reason at the call site.
 * These are the policies that make it possible, and they are the reason the flag
 * exists rather than the application simply connecting as a second, unrestricted
 * role for authentication.
 */
create policy system_writes on portal_users for all to authenticated
  using (is_system()) with check (is_system());

create policy system_writes on portal_sessions for all to authenticated
  using (is_system()) with check (is_system());

create policy own_sessions on portal_sessions for select to authenticated
  using (user_id = current_actor());

/* Signing out of one device from the account activity screen. Revoking is the
   only thing a person may do to a session row, and only to their own. */
create policy revoke_own_sessions on portal_sessions for update to authenticated
  using (user_id = current_actor()) with check (user_id = current_actor());

/*
 * The credential column must never be reachable through PostgREST, on the
 * installs that still have it. The self_read policy above would happily return
 * password_hash to the account it belongs to, and while a hash of your own
 * password is not much of a prize, it is not something an API should hand out.
 */
revoke select (password_hash) on portal_users from authenticated;
