-- socialX portal :: R0 :: catalog seed
--
-- The locked tier contract, as data. Prices are $197 / $397 / $597 and change only
-- with Shariful's explicit approval. Editing this file is the only way to change
-- what socialX can charge, which is the point.
--
-- Launch offer is ACTIVE and stays active until told otherwise.
--   regular  quarterly 5%   half 10%   yearly 20%
--   launch   quarterly 30%  half 40%   yearly 50%

insert into plans (key, name, sort) values
  ('starter','Starter',1),
  ('growth', 'Growth', 2),
  ('scale',  'Scale',  3)
on conflict (key) do update set name = excluded.name, sort = excluded.sort;

insert into plan_entitlements
  (plan_id, posts_per_month, motion_videos, platforms_max, revision_rounds, first_batch_days, customization_level, monthly_call)
select id, v.posts, v.motion, v.platforms, v.rounds, v.days, v.level, v.call
from plans p
join (values
  ('starter', 8,  0, 2, 1,    7, 'light',   false),
  ('growth',  16, 2, 3, 2,    7, 'heavy',   true),
  -- NULL rounds is unlimited, not a large number. Scale is contractually unlimited.
  ('scale',   24, 4, 4, null, 5, 'bespoke', true)
) as v(key, posts, motion, platforms, rounds, days, level, call) on v.key = p.key
on conflict (plan_id) do update set
  posts_per_month = excluded.posts_per_month,
  motion_videos   = excluded.motion_videos,
  platforms_max   = excluded.platforms_max,
  revision_rounds = excluded.revision_rounds,
  first_batch_days = excluded.first_batch_days,
  customization_level = excluded.customization_level,
  monthly_call    = excluded.monthly_call;

insert into billing_cycles (key, months, label, sort) values
  ('monthly',   1,  'Monthly',     1),
  ('quarterly', 3,  'Quarterly',   2),
  ('half',      6,  'Half yearly', 3),
  ('yearly',    12, 'Yearly',      4)
on conflict (key) do update set months = excluded.months, label = excluded.label;

insert into rate_cards (key, label, is_active, active_from, active_to, sort) values
  ('regular', 'Regular',      true, null, null, 1),
  -- Open ended on purpose. The launch offer is still running.
  ('launch',  'Launch offer', true, null, null, 2)
on conflict (key) do update set is_active = excluded.is_active, active_to = excluded.active_to;

-- Prices ---------------------------------------------------------------------
-- LIST prices only. The monthly rate times the number of months, no discount
-- baked in. Discounts are coupons, applied at checkout, so the buyer sees the
-- saving rather than an already-reduced number with nothing to compare it to.

insert into plan_prices (plan_id, cycle_key, monthly_amount, total_amount)
select
  p.id,
  c.key,
  (base.dollars * 100)::int              as monthly_amount,
  (base.dollars * 100 * c.months)::int   as total_amount
from plans p
join (values ('starter',197::numeric),('growth',397::numeric),('scale',597::numeric))
     as base(key, dollars) on base.key = p.key
join billing_cycles c on true
on conflict (plan_id, cycle_key) do update set
  monthly_amount = excluded.monthly_amount,
  total_amount   = excluded.total_amount;

-- Discounts -------------------------------------------------------------------
-- The cycle discounts, as auto-applying coupons. Percentages, so one coupon
-- serves all three tiers. Monthly carries none and so has no row.
--
-- These are the two standing rate cards. Anything an admin creates later lives
-- in the same table with auto_apply false and a code to hand out.

insert into coupons (code, name, kind, percent_off, cycle_key, auto_apply)
values
  ('REGULAR-QUARTERLY-5',  'Regular quarterly 5% off',  'regular',  5, 'quarterly', true),
  ('REGULAR-HALF-10',      'Regular half yearly 10% off','regular', 10, 'half',      true),
  ('REGULAR-YEARLY-20',    'Regular yearly 20% off',    'regular', 20, 'yearly',    true),
  ('LAUNCH-QUARTERLY-30',  'Launch quarterly 30% off',  'launch',  30, 'quarterly', true),
  ('LAUNCH-HALF-40',       'Launch half yearly 40% off','launch',  40, 'half',      true),
  ('LAUNCH-YEARLY-50',     'Launch yearly 50% off',     'launch',  50, 'yearly',    true)
on conflict (code) do update set
  percent_off = excluded.percent_off,
  kind        = excluded.kind,
  cycle_key   = excluded.cycle_key,
  auto_apply  = excluded.auto_apply;

-- Content pillars, with the default monthly mix.
insert into pillars (key, name, default_mix_pct, sort) values
  ('feature_spotlight','Feature Spotlight',30,1),
  ('education',        'Education',        25,2),
  ('pain_agitation',   'Pain Agitation',   18,3),
  ('social_proof',     'Social Proof',     15,4),
  ('promotional',      'Promotional',      12,5)
on conflict (key) do update set
  name = excluded.name, default_mix_pct = excluded.default_mix_pct;

-- Sanity ---------------------------------------------------------------------
-- These assertions are the point of the file. A future edit that drifts the
-- pricing fails the run instead of quietly charging the wrong amount.
do $$
declare mix int; n int; v int;
begin
  select sum(default_mix_pct) into mix from pillars;
  if mix <> 100 then
    raise exception 'Pillar mix totals %, expected 100', mix;
  end if;

  select count(*) into n from plan_prices;
  if n <> 12 then
    raise exception 'Expected 12 plan_prices rows (3 plans x 4 cycles), found %', n;
  end if;

  select count(*) into n from coupons where auto_apply and is_active;
  if n <> 6 then
    raise exception 'Expected 6 auto-applying coupons (2 kinds x 3 discounted cycles), found %', n;
  end if;

  -- The locked monthly prices.
  select monthly_amount into v from plan_prices pp join plans p on p.id = pp.plan_id
    where p.key = 'starter' and cycle_key = 'monthly';
  if v <> 19700 then raise exception 'Starter monthly should be 19700 cents, got %', v; end if;

  select monthly_amount into v from plan_prices pp join plans p on p.id = pp.plan_id
    where p.key = 'scale' and cycle_key = 'monthly';
  if v <> 59700 then raise exception 'Scale monthly should be 59700 cents, got %', v; end if;

  -- A cycle total is the monthly rate times the months, nothing else.
  select total_amount into v from plan_prices pp join plans p on p.id = pp.plan_id
    where p.key = 'starter' and cycle_key = 'yearly';
  if v <> 236400 then raise exception 'Starter yearly list should be 236400 cents, got %', v; end if;

  select total_amount into v from plan_prices pp join plans p on p.id = pp.plan_id
    where p.key = 'growth' and cycle_key = 'quarterly';
  if v <> 119100 then raise exception 'Growth quarterly list should be 119100 cents, got %', v; end if;

  -- Every cycle total must equal monthly times months. Catches a hand edit that
  -- bakes a discount back into the list price, which is the failure this whole
  -- model exists to prevent.
  select count(*) into n
    from plan_prices pp join billing_cycles c on c.key = pp.cycle_key
    where pp.total_amount <> pp.monthly_amount * c.months;
  if n > 0 then
    raise exception '% price row(s) are not the monthly rate times the months', n;
  end if;
end $$;
