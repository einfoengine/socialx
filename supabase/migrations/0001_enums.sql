-- socialX portal :: R0 :: enums
-- Every status the system can be in, declared once so the application cannot
-- invent a state the database has never heard of.

create extension if not exists "pgcrypto";

-- Identity ------------------------------------------------------------------
create type org_status    as enum ('pending','onboarding','active','paused','churned');
create type member_role   as enum ('owner','manager','viewer');
create type staff_role    as enum ('owner','ops','content','finance');

-- Billing -------------------------------------------------------------------
create type sub_status    as enum ('incomplete','trialing','active','past_due','paused','canceled');

-- Media ---------------------------------------------------------------------
-- HighLevel is the primary host. Supabase Storage is the secondary provider for
-- quick adds. See docs/PORTAL-PLAN.md section 3.4.
create type media_provider as enum ('highlevel','supabase');

-- Content -------------------------------------------------------------------
create type template_format as enum ('static','motion');
create type platform_kind   as enum (
  'linkedin','facebook','instagram','tiktok','x','hl_community','youtube','other'
);

-- Delivery ------------------------------------------------------------------
create type batch_status as enum (
  'draft','in_production','in_review','changes_requested',
  'approved','scheduling','live','closed'
);
create type post_status as enum (
  'draft','in_production','in_review','changes_requested',
  'approved','scheduled','published','failed','skipped'
);
