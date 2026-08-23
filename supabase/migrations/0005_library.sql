-- socialX portal :: R0 :: the library
-- The IP. Versioned so a feature change can be traced to every affected client post,
-- and structured so the copy law is reviewable rather than buried in one text field.

create table pillars (
  key             text primary key,   -- feature_spotlight | education | pain_agitation | social_proof | promotional
  name            text not null,
  default_mix_pct int  not null,
  sort            int  not null default 0
);

create table hl_features (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid references hl_features(id) on delete cascade,
  name            text not null,
  slug            text unique not null,
  status          text not null default 'active',   -- active | changed | deprecated
  last_shipped_at date,
  created_at      timestamptz not null default now()
);
create index on hl_features (parent_id);

create table templates (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null,          -- SX-0142, stable human reference
  title              text not null,
  pillar_key         text not null references pillars(key),
  format             template_format not null default 'static',
  master_concept     text,
  is_niche_neutral   boolean not null default true,
  status             text not null default 'draft', -- draft | published | retired
  current_version_id uuid,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index on templates (pillar_key);
create index on templates (status);
comment on column templates.is_niche_neutral is
  'Library defaults stay niche neutral. Niche enters at customization, never in the base library.';

-- The copy law as columns. Hook opens on the reader''s world, the HL feature is the
-- quiet resolution in the middle beat, then outcome, then one CTA. Four fields make a
-- draft that leads with the product visible at a glance.
create table template_versions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references templates(id) on delete cascade,
  version      int  not null,
  hook         text,
  middle_beat  text,
  outcome      text,
  cta          text,
  variables    jsonb not null default '{}'::jsonb,  -- {{brand_name}}, {{niche}}, {{offer}}
  changelog    text,
  published_at timestamptz,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (template_id, version)
);

alter table templates
  add constraint templates_current_version_fk
  foreign key (current_version_id) references template_versions(id) on delete set null;

-- Feature tags cross every pillar. One query finds all templates hit by an HL change.
create table template_features (
  template_id uuid not null references templates(id) on delete cascade,
  feature_id  uuid not null references hl_features(id) on delete cascade,
  primary key (template_id, feature_id)
);
create index on template_features (feature_id);

create table template_variants (
  id                  uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references template_versions(id) on delete cascade,
  platform            platform_kind not null,
  copy                text,
  aspect_ratio        text,
  design_ref          text,                       -- Canva or Figma reference
  asset_id            uuid references assets(id) on delete set null,
  unique (template_version_id, platform)
);
