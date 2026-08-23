-- socialX portal :: R0 :: media and brand
--
-- Media is hybrid by design. HighLevel hosts the bytes and socialX stores the
-- link, because the template library plus per client brand editing produces far
-- more images than belong in Supabase Storage. Supabase stays available as a
-- second provider for quick adds.
--
-- Every other table references assets(id) and never learns which provider is in
-- play. One resolver in the DAL turns a row here into a usable URL.

create table assets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id) on delete cascade,  -- null = socialX library asset
  provider         media_provider not null,

  -- HighLevel hosted
  url              text,          -- CDN link, rendered directly
  hl_location_id   text,
  hl_file_id       text,

  -- Supabase hosted
  bucket           text,
  path             text,

  -- common
  mime             text,
  width            int,
  height           int,
  duration_s       numeric,
  bytes            bigint,
  alt              text,
  checksum         text,
  last_verified_at timestamptz,
  is_broken        boolean not null default false,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),

  -- A row must actually carry the coordinates its provider needs.
  constraint provider_shape check (
    (provider = 'highlevel' and url is not null) or
    (provider = 'supabase'  and bucket is not null and path is not null)
  )
);
create index on assets (org_id);
create index on assets (provider);
-- Feeds the nightly link checker: oldest verified first, broken ones surfaced to admin.
create index on assets (last_verified_at nulls first) where provider = 'highlevel';

comment on column assets.is_broken is
  'Set by the link checker when a HighLevel URL stops resolving. Surfaces on the admin Today screen, never to the client.';
comment on column assets.checksum is
  'Recorded at upload so a file replaced in place inside HighLevel is detectable rather than silent.';

create table brand_profiles (
  org_id         uuid primary key references organizations(id) on delete cascade,
  brand_name     text,
  website        text,
  logo_asset_id  uuid references assets(id) on delete set null,
  colors         jsonb not null default '{}'::jsonb,
  voice_notes    text,
  positioning    text,
  icp_notes      text,
  services       jsonb not null default '[]'::jsonb,
  niches         text[] not null default '{}',
  banned_words   text[] not null default '{}',
  approver_name  text,
  approver_email text,
  completed_at   timestamptz,
  updated_at     timestamptz not null default now()
);
comment on column brand_profiles.banned_words is
  'The client''s own copy rules. socialX honours them the way socialX expects its own rules honoured.';

create table brand_platforms (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  platform       platform_kind not null,
  handle         text,
  hl_account_ref text,                    -- Social Planner account id inside their location
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (org_id, platform)
);
create index on brand_platforms (org_id);

-- R4. Present now so the shape is settled; unused until HighLevel automation lands.
create table hl_connections (
  org_id            uuid primary key references organizations(id) on delete cascade,
  location_id       text not null,
  access_token_enc  text,
  refresh_token_enc text,
  scopes            text[],
  status            text not null default 'disconnected',
  connected_at      timestamptz,
  expires_at        timestamptz
);
comment on table hl_connections is
  'Tokens are encrypted at rest and only ever decrypted inside the publish worker. Service role only; no client policy exists for this table.';
