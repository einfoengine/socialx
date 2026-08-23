-- socialX portal :: R0 :: catalog, entitlements, billing
-- The tier contract lives here as data. Nothing in the application hardcodes a
-- post count, a platform cap, a revision allowance, or a price.

create table plans (
  id        uuid primary key default gen_random_uuid(),
  key       text unique not null,          -- starter | growth | scale
  name      text not null,
  sort      int  not null default 0,
  is_active boolean not null default true
);

create table plan_entitlements (
  plan_id             uuid primary key references plans(id) on delete cascade,
  posts_per_month     int  not null,
  motion_videos       int  not null default 0,
  platforms_max       int  not null,
  revision_rounds     int,                 -- NULL means unlimited (Scale)
  first_batch_days    int  not null,
  customization_level text not null,       -- light | heavy | bespoke
  monthly_call        boolean not null default false
);
comment on column plan_entitlements.revision_rounds is
  'NULL is unlimited, not zero. Scale is contractually unlimited; a large integer would be a lie that eventually bites.';

create table billing_cycles (
  key    text primary key,                 -- monthly | quarterly | half | yearly
  months int  not null,
  label  text not null,
  sort   int  not null default 0
);

create table rate_cards (
  key         text primary key,            -- regular | launch
  label       text not null,
  is_active   boolean not null default true,
  active_from date,
  active_to   date,                        -- NULL means open ended
  sort        int not null default 0
);

create table plan_prices (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references plans(id) on delete cascade,
  cycle_key       text not null references billing_cycles(key),
  rate_card_key   text not null references rate_cards(key),
  discount_pct    numeric(5,4) not null default 0,   -- kept for display, not for maths
  monthly_amount  int not null,             -- cents per month after discount
  total_amount    int not null,             -- cents charged per cycle
  currency        text not null default 'usd',
  stripe_price_id text unique,
  is_active       boolean not null default true,
  unique (plan_id, cycle_key, rate_card_key)
);
comment on table plan_prices is
  'Seeded from supabase/seed. Checkout resolves a row here server side; the browser never sends an amount.';

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organizations(id) on delete cascade,
  plan_id                uuid not null references plans(id),
  cycle_key              text not null references billing_cycles(key),
  rate_card_key          text not null references rate_cards(key),
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 sub_status not null default 'incomplete',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  delivery_hold          boolean not null default false,
  started_at             timestamptz,
  canceled_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on subscriptions (org_id);
create index on subscriptions (status);
comment on column subscriptions.delivery_hold is
  'Set when dunning escalates. Nothing schedules for a held account, so unpaid work never publishes.';

create table invoices (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  stripe_invoice_id  text unique,
  number             text,
  amount_due         int,
  amount_paid        int,
  currency           text default 'usd',
  status             text,
  hosted_invoice_url text,
  pdf_url            text,
  period_start       timestamptz,
  period_end         timestamptz,
  issued_at          timestamptz
);
create index on invoices (org_id);

-- Webhook idempotency. Stripe retries; this makes a replay a no-op.
create table stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);
