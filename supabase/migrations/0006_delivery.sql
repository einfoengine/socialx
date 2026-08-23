-- socialX portal :: R0 :: delivery
-- The monthly cycle. Quota is snapshotted onto the batch at creation so a mid cycle
-- plan change cannot rewrite the terms of work already in production.

create table batches (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,
  period_start         date not null,
  period_end           date not null,
  status               batch_status not null default 'draft',
  due_at               timestamptz,
  quota_posts          int  not null,
  quota_motion         int  not null default 0,
  quota_platforms      int  not null,
  revision_rounds_allowed int,             -- snapshot of entitlement. NULL = unlimited
  revision_rounds_used int  not null default 0,
  assigned_to          uuid references profiles(id) on delete set null,
  submitted_at         timestamptz,
  approved_at          timestamptz,
  closed_at            timestamptz,
  created_at           timestamptz not null default now(),
  unique (org_id, period_start)
);
create index on batches (org_id);
create index on batches (status);

create table posts (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid not null references batches(id) on delete cascade,
  org_id              uuid not null references organizations(id) on delete cascade,
  template_version_id uuid references template_versions(id) on delete set null,
  is_custom           boolean not null default false,
  title               text,
  format              template_format not null default 'static',
  pillar_key          text references pillars(key),
  copy                text,
  design_asset_id     uuid references assets(id) on delete set null,
  platforms           platform_kind[] not null default '{}',
  scheduled_for       timestamptz,
  status              post_status not null default 'draft',
  position            int not null default 0,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index on posts (batch_id);
create index on posts (org_id);
create index on posts (template_version_id);   -- "which live posts run stale copy"
create index on posts (status);

create table post_platform_copy (
  post_id  uuid not null references posts(id) on delete cascade,
  platform platform_kind not null,
  copy     text,
  asset_id uuid references assets(id) on delete set null,
  primary key (post_id, platform)
);

create table revisions (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references batches(id) on delete cascade,
  post_id      uuid references posts(id) on delete cascade,   -- null = batch level note
  round        int  not null,
  requested_by uuid references profiles(id) on delete set null,
  note         text,
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index on revisions (batch_id);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  body        text not null,
  is_internal boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on comments (post_id);
comment on column comments.is_internal is
  'Staff-only note. Never returned to a client session; enforced by RLS, not by the query author remembering.';

create table publish_jobs (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references posts(id) on delete cascade,
  target        text not null default 'hl_social_planner',
  status        text not null default 'pending',
  external_id   text,
  scheduled_for timestamptz,
  attempts      int not null default 0,
  last_error    text,
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index on publish_jobs (status, scheduled_for);

-- ============================================================================
-- Business rules the database refuses to let the application get wrong.
-- ============================================================================

-- Revision rounds. The single edge that carries the whole commercial difference
-- between Starter, Growth, and Scale.
create or replace function enforce_revision_rounds()
returns trigger
language plpgsql
as $$
declare
  allowed int;
  used    int;
begin
  select revision_rounds_allowed, revision_rounds_used
    into allowed, used
    from batches where id = new.batch_id
    for update;

  -- NULL is unlimited (Scale), so only a non-null allowance is a ceiling.
  if allowed is not null and used >= allowed then
    raise exception
      'Revision limit reached for this batch (% of % rounds used). Upgrade the plan or resolve the batch.',
      used, allowed
      using errcode = 'check_violation';
  end if;

  if new.round is null then
    new.round := used + 1;
  end if;

  return new;
end;
$$;

create trigger revisions_enforce_rounds
  before insert on revisions
  for each row execute function enforce_revision_rounds();

-- Platform cap per plan, snapshotted on the batch.
create or replace function enforce_platform_cap()
returns trigger
language plpgsql
as $$
declare
  cap int;
begin
  select quota_platforms into cap from batches where id = new.batch_id;
  if cap is not null and array_length(new.platforms, 1) > cap then
    raise exception
      'This plan allows % platforms per post; % were given.',
      cap, array_length(new.platforms, 1)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger posts_enforce_platform_cap
  before insert or update of platforms on posts
  for each row execute function enforce_platform_cap();
