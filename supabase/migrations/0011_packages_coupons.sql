-- socialX portal :: packages and coupons
--
-- Two changes.
--
-- 1. A package is more than a price. Name, tagline, description and what is
--    included now live on `plans`, so the admin Packages screen and the public
--    pricing section read the same rows instead of the site hardcoding a copy
--    that quietly drifts from what is sold.
--
-- 2. Discounts become real coupons that an admin can create, with a code, rather
--    than six seeded rows. rate_card_discounts folds into `coupons`, which keeps
--    both behaviours: auto_apply for the cycle discounts that apply on their own,
--    and a code for the ones handed out through a link.

-- Packages ------------------------------------------------------------------
alter table plans add column if not exists tagline     text;
alter table plans add column if not exists description text;
alter table plans add column if not exists includes    jsonb not null default '[]'::jsonb;

comment on column plans.includes is
  'Array of {text, highlight} rows shown on the pricing card and the package screen. One source, so the site and admin cannot disagree about what a tier buys.';

-- Coupons --------------------------------------------------------------------
create type coupon_kind as enum ('regular', 'launch');

create table coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  kind             coupon_kind not null default 'regular',
  percent_off      numeric(5,2) not null check (percent_off > 0 and percent_off <= 100),

  /*
   * Which cycle this is for. NULL means any cycle, which is what a hand-made
   * promo code usually wants. The seeded cycle discounts each name their cycle,
   * because 50% off is a yearly commitment offer and applying it to a monthly
   * subscription would be giving the discount away without the commitment.
   */
  cycle_key        text references billing_cycles(key) on delete cascade,

  /*
   * true  = applied at checkout on its own for its cycle, no code typed.
   * false = only applies when the code arrives, via a share link.
   */
  auto_apply       boolean not null default false,

  stripe_coupon_id text unique,
  is_active        boolean not null default true,
  max_redemptions  int check (max_redemptions is null or max_redemptions > 0),
  redeem_by        date,
  times_redeemed   int not null default 0,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on coupons (kind, is_active);
create index on coupons (cycle_key);

/*
 * At most one auto-applying coupon per kind and cycle. Two would make checkout
 * depend on row order, which is the kind of bug that only shows up in the
 * amount somebody was charged.
 */
create unique index coupons_one_auto_per_kind_cycle
  on coupons (kind, cycle_key)
  where auto_apply and is_active;

create trigger coupons_touch before update on coupons
  for each row execute function touch_updated_at();

alter table coupons enable row level security;
create policy staff_all on coupons for all to authenticated
  using (is_staff()) with check (is_staff());

-- Carry the six seeded discounts across, keeping their Stripe coupon ids so
-- nothing has to be recreated.
insert into coupons (code, name, kind, percent_off, cycle_key, auto_apply, stripe_coupon_id, is_active)
select
  upper(d.rate_card_key || '-' || d.cycle_key || '-' || round(d.percent_off)::text),
  initcap(d.rate_card_key) || ' ' || d.cycle_key || ' ' || round(d.percent_off)::text || '% off',
  d.rate_card_key::coupon_kind,
  d.percent_off,
  d.cycle_key,
  true,
  d.stripe_coupon_id,
  d.is_active
from rate_card_discounts d
on conflict (code) do nothing;

drop table rate_card_discounts;
