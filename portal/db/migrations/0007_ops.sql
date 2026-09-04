-- socialX portal :: R0 :: operations
-- Evidence and attention. activity_log is what ends "I never approved that".

create table activity_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id) on delete set null,
  org_id     uuid references organizations(id) on delete cascade,
  entity     text not null,
  entity_id  uuid,
  action     text not null,
  diff       jsonb,
  created_at timestamptz not null default now()
);
create index on activity_log (org_id, created_at desc);
create index on activity_log (entity, entity_id);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read_at);
