-- socialX portal :: Journal
--
-- Three things the build needs to remember between sessions:
--   build_log  what was actually done, so context survives a new conversation
--   decisions  what Shariful locked in, so it is never re-litigated or forgotten
--   ideas      what might happen later, rated so preference is visible
--
-- Staff only. No client policy exists on any of these tables.

create type idea_status as enum ('open','planned','building','shipped','archived');

-- Build log -----------------------------------------------------------------
create table build_log_entries (
  id         uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  release    text,                       -- R0, R1, or null for non-release work
  title      text not null,
  body       text,
  author     text not null default 'Claude',
  created_at timestamptz not null default now()
);
create index on build_log_entries (entry_date desc, created_at desc);

-- Decisions -----------------------------------------------------------------
create table decisions (
  id            uuid primary key default gen_random_uuid(),
  decided_on    date not null default current_date,
  topic         text not null,           -- short label: Payments, Media, Scope
  decision      text not null,           -- the locked choice, stated plainly
  rationale     text,
  decided_by    text not null default 'Shariful',
  status        text not null default 'active',   -- active | superseded
  supersedes_id uuid references decisions(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on decisions (status, decided_on desc);
comment on column decisions.supersedes_id is
  'A changed decision does not overwrite the old one. It supersedes it, so the history of why something changed stays readable.';

-- Ideas ---------------------------------------------------------------------
create table ideas (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  detail     text,
  source     text not null default 'claude',      -- claude | shariful
  -- 1 star is never a stored state. Rating an idea 1 deletes it, so the only
  -- values that can persist are unrated, or 2 through 5.
  rating     int check (rating is null or rating between 2 and 5),
  status     idea_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on ideas (status, rating desc nulls last, created_at desc);
comment on column ideas.rating is
  'NULL means unrated. 1 star deletes the row, enforced in the server action and guarded by this constraint so a 1 can never be written.';

-- RLS -----------------------------------------------------------------------
alter table build_log_entries enable row level security;
alter table decisions         enable row level security;
alter table ideas             enable row level security;

create policy staff_all on build_log_entries for all to authenticated
  using (is_staff()) with check (is_staff());
create policy staff_all on decisions for all to authenticated
  using (is_staff()) with check (is_staff());
create policy staff_all on ideas for all to authenticated
  using (is_staff()) with check (is_staff());

-- Keep updated_at honest without the application having to remember.
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger decisions_touch before update on decisions
  for each row execute function touch_updated_at();
create trigger ideas_touch before update on ideas
  for each row execute function touch_updated_at();
