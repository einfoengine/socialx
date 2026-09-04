-- socialX portal :: coupon based pricing
--
-- The catalog holds LIST prices only: one per plan and cycle, at the plain
-- monthly rate times the number of months. Discounts are Stripe coupons applied
-- at checkout, so the buyer sees what they are saving on Stripe's own page
-- instead of a already-discounted number with nothing to compare it to.
--
-- 12 prices and 6 coupons, where there used to be 24 prices. The coupons are
-- percentages, so one "30% off quarterly" serves all three tiers.
--
-- Safe to run destructively: verified zero subscriptions and zero invoices at
-- the time of writing. It would not be safe later, because a subscription that
-- referenced a deleted price row could no longer be explained.

do $$
declare n int;
begin
  select count(*) into n from subscriptions;
  if n > 0 then
    raise exception
      'This migration rebuilds plan_prices and % subscription(s) exist. Migrate them first.', n;
  end if;
end $$;

-- List prices ---------------------------------------------------------------
alter table plan_prices drop constraint if exists plan_prices_plan_id_cycle_key_rate_card_key_key;

delete from plan_prices where rate_card_key <> 'regular';

alter table plan_prices drop column if exists rate_card_key;
alter table plan_prices drop column if exists discount_pct;

alter table plan_prices
  add constraint plan_prices_plan_cycle_unique unique (plan_id, cycle_key);

comment on column plan_prices.monthly_amount is
  'The plain monthly rate in cents. 19700, 39700, 59700. Never discounted.';
comment on column plan_prices.total_amount is
  'List price for the whole cycle in cents: monthly_amount times the cycle months. What Stripe charges before any coupon.';

-- Discounts -----------------------------------------------------------------
create table rate_card_discounts (
  id               uuid primary key default gen_random_uuid(),
  rate_card_key    text not null references rate_cards(key) on delete cascade,
  cycle_key        text not null references billing_cycles(key) on delete cascade,
  percent_off      numeric(5,2) not null check (percent_off > 0 and percent_off < 100),
  stripe_coupon_id text unique,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (rate_card_key, cycle_key)
);

comment on table rate_card_discounts is
  'One row per rate card and cycle that carries a discount. Monthly has none, so it has no row. Percentages rather than fixed amounts, so a single coupon serves every tier.';
comment on column rate_card_discounts.stripe_coupon_id is
  'Created by scripts/stripe-sync.mjs with duration=forever, so a launch buyer keeps the discount at every renewal. Removing it from a subscription is a deliberate, per-customer act.';

alter table rate_card_discounts enable row level security;

create policy staff_all on rate_card_discounts for all to authenticated
  using (is_staff()) with check (is_staff());
create policy read_catalog on rate_card_discounts for select to authenticated
  using (true);
