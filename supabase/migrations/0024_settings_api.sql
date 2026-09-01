-- socialX portal :: R1 :: editable settings and the content API
--
-- Three things arrive together because they are one feature: Settings stops
-- being a read-only wall chart, and the two rows of it that need storage of
-- their own get tables.
--
--   app_settings   named values the app reads at runtime. The console edits
--                  them, so changing the support address is no longer a deploy.
--   api_keys       how a machine authenticates to /api/v1. Hashed at rest, with
--                  an origin allowlist, so a key can be handed to one domain
--                  rather than to the whole internet.
--   site_content.is_public
--                  which content entries the API serves with no key at all.
--
-- The security posture matches site_content in 0023 and coupons before it. Staff
-- read through their own session under RLS; every write goes through a server
-- action with the service role after requirePermission('settings','full'). There
-- is deliberately no anon policy on any of these, because the API reads with the
-- service role from route handlers that have already authenticated the caller
-- themselves. Nothing in a browser talks to these tables directly.

-- App settings ---------------------------------------------------------------
--
-- The value is jsonb rather than text so a boolean stays a boolean and a list
-- stays a list. What keys exist, what type each holds, and what it falls back to
-- when the row is missing all live in the app (lib/settings.ts), for the same
-- reason section keys do: a setting is a thing the code reads, not a business
-- record. A row for a key the app no longer knows is ignored.

create table app_settings (
  key        text primary key
             check (key ~ '^[a-z0-9][a-z0-9_.-]{1,62}$'),
  value      jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table app_settings is
  'Runtime configuration edited at /admin/settings. Keys and defaults are declared in apps/console/lib/settings.ts.';

alter table app_settings enable row level security;

create policy staff_read_app_settings on app_settings
  for select to authenticated using (is_staff());

-- API keys -------------------------------------------------------------------
--
-- The secret is never stored. What is stored is a SHA-256 of the whole token and
-- a short prefix, and the two do different jobs: the prefix is the lookup handle
-- and the only part a person ever sees again, the hash is what the presented
-- token is compared against. Losing this table therefore leaks no working key.
--
-- allowed_origins is the answer to "share it with one domain, not all". Empty
-- means no browser may use this key at all: no Access-Control-Allow-Origin comes
-- back and a request carrying an Origin header is refused, so an empty list is a
-- server-to-server key rather than an unrestricted one. Listing an origin is the
-- act that grants browser access, which makes the permissive state the one
-- somebody had to choose.

create table api_keys (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 2 and 80),
  -- Shown in the console as the key's identity, e.g. sx_live_9f3c1a7b.
  prefix          text not null unique check (prefix ~ '^sx_(live|test)_[0-9a-f]{8}$'),
  token_hash      text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes          text[] not null default '{}',
  allowed_origins text[] not null default '{}',
  note            text,
  created_by      uuid references profiles(id) on delete set null,
  last_used_at    timestamptz,
  last_used_origin text,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

comment on table api_keys is
  'Bearer credentials for /api/v1. The secret exists only in the response that created it; this table holds a SHA-256 of it.';
comment on column api_keys.allowed_origins is
  'Origins permitted to call with this key from a browser. Empty means server side only: no CORS grant and any request carrying Origin is refused.';
comment on column api_keys.revoked_at is
  'Set instead of deleting, so a key that turns up in a log later can still be identified.';

-- Authentication looks a key up by prefix on every request, so that path is the
-- one that has to stay cheap. Listing in the console sorts newest first.
create index api_keys_prefix_idx on api_keys (prefix) where revoked_at is null;
create index api_keys_created_idx on api_keys (created_at desc);

alter table api_keys enable row level security;

-- Staff may see that a key exists, who made it and when it was last used. The
-- hash is in the row and stays there: it is not the secret, and the console
-- never selects the column.
create policy staff_read_api_keys on api_keys
  for select to authenticated using (is_staff());

-- Public content ---------------------------------------------------------------
--
-- An entry is private until somebody says otherwise. The API's unauthenticated
-- surface is exactly the set of rows with this flag on, which means the question
-- "what can anyone on the internet read" has a single answer that is visible as
-- a column rather than inferred from route code.

alter table site_content add column is_public boolean not null default false;

comment on column site_content.is_public is
  'Served by GET /api/v1/content with no credential. Off by default; toggled at /admin/settings/public-api.';

create index site_content_public_idx on site_content (key) where is_public;

-- Defaults ---------------------------------------------------------------------
--
-- Seeded so the General screen has something to show on a fresh database. Each
-- also exists as a fallback in lib/settings.ts, so a missing row is never an
-- error, only a value nobody has changed yet.

insert into app_settings (key, value) values
  ('support.email',        '"hi@socialx.studio"'::jsonb),
  ('support.reply_hours',  '24'::jsonb),
  ('brand.name',           '"socialX"'::jsonb),
  ('checkout.url',         '"https://order.socialx.studio"'::jsonb),
  ('api.public_enabled',   'true'::jsonb),
  ('api.public_origins',   '[]'::jsonb)
on conflict (key) do nothing;
