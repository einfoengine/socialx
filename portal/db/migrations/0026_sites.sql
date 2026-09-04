-- Portal :: R2 :: sites, the integration registry
--
-- Until now this platform had exactly one website baked into it. site_content was
-- a single global keyspace, api_keys belonged to nobody in particular, and the
-- brand name was a fallback string in application code. That is fine for one
-- brand and impossible for two.
--
-- A `site` is a website that integrates with this platform. It owns its own
-- brand, its own verified domains, its own credentials, its own content
-- keyspace, its own webhook endpoints, and the clients it sold. The platform
-- itself owns none of those things and has no favourite site: the row created at
-- the bottom of this file is a data migration of whatever brand this instance was
-- already serving, and it carries no privilege that a site added tomorrow will
-- not also carry. Nothing anywhere reads a site by a hardcoded key.
--
-- What is deliberately NOT site-scoped, and why:
--
--   plans, plan_entitlements, rate_cards, templates, hl_features
--     The service being sold. Every site resells the same delivery product, so
--     duplicating the catalogue per site would mean three places to fix a price
--     and a library that forks. If a site ever needs its own catalogue, that is a
--     later migration and a bigger decision than this one.
--
--   profiles, staff_roles, staff_permissions
--     Operator identity. Staff work across every site by definition.
--
-- Access posture matches 0024. Staff read through their own session under RLS;
-- every write goes through a server action with the service role after
-- requirePermission('sites','full'); the API reads with the service role from
-- route handlers that authenticated the caller themselves. There is no anon
-- policy on any table here, so nothing in a browser reaches them directly.

create type site_status as enum ('draft', 'active', 'suspended');

comment on type site_status is
  'draft: registered, credentials refused. active: serving. suspended: kept, refused, reversible.';

-- Sites ------------------------------------------------------------------------
--
-- `key` is the stable handle. It appears in admin URLs, in the X-Site-Key header
-- an unauthenticated caller uses to say whose content it wants, and nowhere that
-- a rename would break, which is why it is separate from `name`.
--
-- `portal_host` is what makes the hosted portal work: a request arriving on that
-- host is a request for that site's portal, resolved before any page renders.
-- Unique across the table because a host cannot serve two brands at once, and
-- nullable because a site can be registered and configured before DNS exists.
--
-- `brand` is jsonb rather than columns, and that is a considered choice. What a
-- skin needs is a moving target: today a logo, a wordmark and two accent colors,
-- tomorrow a favicon and a font. Columns would mean a migration per visual
-- decision. The shape is declared in packages/core/src/sites.ts, every field is
-- optional, and an unknown field is ignored rather than an error, so the code
-- owns the schema and the database only stores it.

create table sites (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique
                 check (key ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  name           text not null check (length(btrim(name)) between 1 and 80),
  legal_name     text,
  status         site_status not null default 'draft',
  -- Where the integrating website lives. Used for the "back to your site" link
  -- out of the portal, and shown in the console so a key can be traced to a
  -- business rather than to a slug.
  primary_url    text,
  portal_host    text unique
                 check (portal_host ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{2,5})?$'),
  support_email  text,
  checkout_url   text,
  brand          jsonb not null default '{}'::jsonb,
  note           text,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table sites is
  'A website integrated with this platform. Registered at /admin/sites; resolved per request by API key or by Host.';
comment on column sites.key is
  'Stable handle. Used in admin URLs and as the X-Site-Key value an unauthenticated caller sends.';
comment on column sites.portal_host is
  'Host that serves this site''s portal. A request arriving here is resolved to this site before any page renders.';
comment on column sites.brand is
  'Skin for the portal and for transactional copy. Shape declared in packages/core/src/sites.ts; unknown fields ignored.';
comment on column sites.status is
  'Only an active site authenticates. Draft and suspended both refuse every credential, which is the kill switch.';

create trigger sites_touch before update on sites
  for each row execute function touch_updated_at();

alter table sites enable row level security;

create policy staff_read_sites on sites
  for select to authenticated using (is_staff());

-- Domains ----------------------------------------------------------------------
--
-- An origin a site has proved it controls.
--
-- Verification is by HTTP rather than DNS, and the reason is that the thing being
-- established here is control of an *origin*, not ownership of a *domain*. A
-- browser's Origin header carries scheme, host and port; a TXT record proves
-- something about the host alone and says nothing about whether the person who
-- set it can serve content on https at that port. Fetching a token this platform
-- generated, from the exact origin being claimed, proves the narrower thing that
-- is actually load bearing. It also fails closed on the case DNS gets wrong most
-- often: a staging host on somebody else's subdomain.
--
-- The token is per row and permanent, so re-verification after a lapse does not
-- need a new file published. Losing verified_at is what revokes trust.

create table site_domains (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references sites(id) on delete cascade,
  -- Stored exactly as a browser would send it: scheme and host, no path, no
  -- trailing slash. Anything else can never match an Origin header.
  origin             text not null unique
                     check (origin ~ '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{2,5})?$'),
  purpose            text not null default 'browser'
                     check (purpose in ('browser', 'portal')),
  verification_token text not null,
  verified_at        timestamptz,
  last_checked_at    timestamptz,
  last_error         text,
  created_at         timestamptz not null default now()
);

comment on table site_domains is
  'Origins a site has proved it controls, by serving /.well-known/portal-site-verification.txt. Unverified origins are refused everywhere.';
comment on column site_domains.origin is
  'Scheme, host and optional port, lowercase, no path. The exact shape of a browser Origin header.';
comment on column site_domains.purpose is
  'browser: may appear on an API key''s allowlist. portal: may serve this site''s hosted portal.';
comment on column site_domains.verified_at is
  'Null means unproven, and unproven is refused. Clearing this is how trust is withdrawn without deleting the row.';

create index site_domains_site_idx on site_domains (site_id);
-- The hot path: every browser API call resolves an Origin header to a site.
create index site_domains_verified_idx on site_domains (origin) where verified_at is not null;

alter table site_domains enable row level security;

create policy staff_read_site_domains on site_domains
  for select to authenticated using (is_staff());

-- Webhooks ---------------------------------------------------------------------
--
-- Where a site is told that something happened.
--
-- The secret is stored in the clear, which is the opposite of what 0024 does with
-- api_keys, and the difference is not an inconsistency. An API key is a
-- credential this platform *verifies*, so a hash is sufficient and storing more
-- than a hash would be negligent. A webhook secret is a key this platform *signs
-- with*, and there is no signing without the material. What reduces the blast
-- radius instead is that it is per endpoint, rotatable from the console without
-- touching anything else, and never selected by any read except the one that
-- signs a delivery.
--
-- `events` empty means every event, which is the useful default: an integrator
-- wiring up their first endpoint wants to see what exists before deciding what to
-- filter. Naming events narrows it.

create table site_webhooks (
  id                    uuid primary key default gen_random_uuid(),
  site_id               uuid not null references sites(id) on delete cascade,
  -- https only. A signed payload sent over http is a signed payload anybody on
  -- the path can read, and the events here carry customer email addresses.
  url                   text not null check (url ~ '^https://'),
  description           text,
  events                text[] not null default '{}',
  secret                text not null,
  active                boolean not null default true,
  -- Delivery health, kept on the endpoint so the console can show "this has been
  -- failing for two days" without aggregating the delivery log on every render.
  last_success_at       timestamptz,
  last_failure_at       timestamptz,
  consecutive_failures  int not null default 0,
  disabled_reason       text,
  created_by            uuid references profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table site_webhooks is
  'Endpoints a site receives events on. Payloads are signed HMAC-SHA256 with the secret held here.';
comment on column site_webhooks.secret is
  'Signing material, stored because signing needs it. Rotate from the console; never selected except by the signer.';
comment on column site_webhooks.events is
  'Event names to send. Empty means all of them, which is the default for a new endpoint.';
comment on column site_webhooks.disabled_reason is
  'Set when the platform turns an endpoint off itself, after enough consecutive failures to call it broken.';

create index site_webhooks_site_idx on site_webhooks (site_id);

create trigger site_webhooks_touch before update on site_webhooks
  for each row execute function touch_updated_at();

alter table site_webhooks enable row level security;

create policy staff_read_site_webhooks on site_webhooks
  for select to authenticated using (is_staff());

-- Deliveries -------------------------------------------------------------------
--
-- One row per event per endpoint, written before the first attempt is made.
--
-- Writing first is what makes this a queue rather than a log. An event that is
-- emitted while the network is down, or during a deploy, is still a row with a
-- next_attempt_at, so the drain picks it up later. If delivery were attempted
-- first and recorded after, an event lost in flight would be lost silently, and
-- "we sent it, you missed it" is not a claim either side can check.
--
-- The payload is stored so a redelivery replays exactly what was sent, including
-- the values as they were, rather than re-reading rows that have since changed.

create table webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  webhook_id      uuid not null references site_webhooks(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  event           text not null,
  payload         jsonb not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'delivered', 'failed', 'dead')),
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  response_status int,
  error           text,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now()
);

comment on table webhook_deliveries is
  'The outbound queue and its history. Written before the first attempt, so an event survives a failure to send it.';
comment on column webhook_deliveries.status is
  'pending: owed. delivered: accepted with a 2xx. failed: attempt failed, will retry. dead: out of attempts, will not retry.';
comment on column webhook_deliveries.payload is
  'Exactly what was sent. A redelivery replays this rather than re-reading rows that may have moved on.';

-- The drain's only query: what is owed, oldest first.
create index webhook_deliveries_due_idx on webhook_deliveries (next_attempt_at)
  where status in ('pending', 'failed');
create index webhook_deliveries_site_idx on webhook_deliveries (site_id, created_at desc);

alter table webhook_deliveries enable row level security;

create policy staff_read_webhook_deliveries on webhook_deliveries
  for select to authenticated using (is_staff());

-- Attaching what already exists --------------------------------------------------
--
-- Three tables gain a site. Nullable first, because the rows already in them
-- predate the concept and there is nothing to point them at until the site row
-- below exists.

alter table api_keys       add column site_id uuid references sites(id) on delete cascade;
alter table site_content   add column site_id uuid references sites(id) on delete cascade;
alter table organizations  add column site_id uuid references sites(id) on delete set null;

comment on column api_keys.site_id is
  'The site this credential speaks for. A key reaches one site''s data and no other, which is the isolation guarantee.';
comment on column organizations.site_id is
  'The site that sold this client. Decides which brand their portal wears and which endpoints hear about them.';

-- The first site ----------------------------------------------------------------
--
-- Built from whatever this instance was already configured as, so the migration
-- names no brand of its own. app_settings is where those values already live
-- (0024 seeded them), and reading them here is what keeps this file honest: it
-- migrates one existing tenant into the registry rather than blessing one.
--
-- On an instance with no settings at all this still produces a usable row, and
-- the console renames it in one field.

do $$
declare
  brand_name text;
  brand_key  text;
  site_uuid  uuid;
  checkout   text;
  support    text;
begin
  select btrim(value #>> '{}') into brand_name from app_settings where key = 'brand.name';
  select btrim(value #>> '{}') into checkout   from app_settings where key = 'checkout.url';
  select btrim(value #>> '{}') into support    from app_settings where key = 'support.email';

  if brand_name is null or brand_name = '' then
    brand_name := 'First site';
  end if;

  -- Slugify: lowercase, non-alphanumerics to hyphens, collapsed and trimmed. A
  -- name that slugifies to nothing (all punctuation) still needs a legal key.
  brand_key := btrim(regexp_replace(lower(brand_name), '[^a-z0-9]+', '-', 'g'), '-');
  if brand_key !~ '^[a-z0-9][a-z0-9-]{1,38}$' then
    brand_key := 'site-1';
  end if;

  insert into sites (key, name, status, support_email, checkout_url)
  values (brand_key, brand_name, 'active', support, checkout)
  returning id into site_uuid;

  update api_keys      set site_id = site_uuid where site_id is null;
  update site_content  set site_id = site_uuid where site_id is null;
  update organizations set site_id = site_uuid where site_id is null;

  -- Every origin already trusted on a key becomes a verified domain of that
  -- site. Somebody made that decision deliberately once; making them make it
  -- again is not a security improvement, it is an outage.
  --
  -- The distinct runs in the subquery on purpose. Selecting gen_random_bytes()
  -- alongside a DISTINCT would make every row unique by its own token and dedupe
  -- nothing, which the unique constraint on origin would then reject.
  insert into site_domains (site_id, origin, purpose, verification_token, verified_at)
  select site_uuid, o, 'browser', encode(gen_random_bytes(16), 'hex'), now()
  from (
    select distinct unnest(allowed_origins) as o
    from api_keys
    where revoked_at is null
  ) origins
  on conflict (origin) do nothing;
end $$;

-- Now that every row has one, a site becomes mandatory where it is structural.
-- organizations stays nullable: a client can exist before anyone decides which
-- site sold them, and losing a site must not delete its clients' records.
alter table api_keys     alter column site_id set not null;
alter table site_content alter column site_id set not null;

-- Content is keyed per site --------------------------------------------------
--
-- The primary key moves from (key) to (site_id, key). This is the change that
-- makes two websites able to both have a "hero" entry, which the old key was
-- silently preventing.

alter table site_content drop constraint site_content_pkey;
alter table site_content add primary key (site_id, key);

drop index if exists site_content_public_idx;
create index site_content_public_idx on site_content (site_id, key) where is_public;

-- Permissions ------------------------------------------------------------------
--
-- Sites join the matrix. Ops owns it because registering a website, verifying
-- its domains and cutting its credentials is operational work rather than
-- marketing or finance. Content can look, since the Website screen it already
-- owns is now scoped by the site chosen here. Owner is full everywhere by the
-- guard trigger's rule.

insert into staff_permissions (role, section, level) values
  ('owner','sites','full'),
  ('ops','sites','full'),
  ('content','sites','view'),
  ('finance','sites','none')
on conflict (role, section) do nothing;
