-- socialX portal :: checkout add-ons
--
-- A one-time extra offered at checkout, charged on the first invoice only.
--
-- Deliberately a table rather than a constant. The tier specs and the $197 /
-- $397 / $597 prices are locked and need Shariful's approval to change, so an
-- add-on price must be something he can see, edit and switch off without a
-- deploy. It is also why an add-on is one-time by design: a recurring add-on
-- would be a fourth tier wearing a different name.

create table addons (
  id               uuid primary key default gen_random_uuid(),
  key              text unique not null,
  name             text not null,
  description      text,
  /* Cents, one-time, added to the first invoice. */
  amount           int not null check (amount > 0),
  currency         text not null default 'usd',
  stripe_price_id  text unique,
  /* Which plans may see it. Empty means all of them. Starter and Growth wait 7
     days for a first batch; Scale is already on 5 and a priority queue, so
     offering it a rush would be selling something it already has. */
  applies_to_plans text[] not null default '{}',
  is_active        boolean not null default true,
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger addons_touch before update on addons
  for each row execute function touch_updated_at();

alter table addons enable row level security;
create policy staff_all on addons for all to authenticated
  using (is_staff()) with check (is_staff());
create policy read_catalog on addons for select to authenticated using (true);

-- Whether a client bought one, so delivery knows what was promised.
alter table subscriptions add column if not exists addon_keys text[] not null default '{}';
comment on column subscriptions.addon_keys is
  'Add-ons bought at checkout. Read by the batch builder: a rush is a promise somebody has to keep.';
