-- Portal :: R3 :: orders
--
-- An order becomes a record instead of an inference.
--
-- Until now "order" named a shape read out of other tables: an organization in
-- status pending or onboarding, with a Stripe subscription behind it. That works
-- for exactly one way of buying, which is a card confirmed on a website, and it
-- is the reason nothing else can be sold. There is no row to create for a bank
-- transfer, no row for a sale an operator takes over a call, and no row for an
-- integrator's own checkout to report. The absence of this table was the feature
-- gap, not the endpoints on top of it.
--
-- What an order is: the intent to buy, priced, with whatever happened to it
-- afterwards. It outlives the payment attempt, exists before an organization
-- does, and is the single thing every selling surface writes. Provisioning then
-- has one trigger, `status = paid`, rather than one trigger per payment rail.
--
-- Four ways to create one, and the point of separating them is that they differ
-- in who is trusted rather than in what they produce:
--
--   site_checkout   a buyer paid a card on an integrating website
--   admin_manual    an operator took the sale and recorded it
--   portal_upgrade  an existing client changed plan from inside the portal
--   external_api    another system posted it through /api/v1/orders
--
-- Each is independently switchable, at two levels, the same way public content
-- already works: a platform master switch in apps/console/lib/settings.ts, and
-- sites.order_sources naming what one site may use. Both must say yes.

-- Vocabulary ------------------------------------------------------------------

create type order_source as enum (
  'site_checkout','admin_manual','portal_upgrade','external_api'
);

-- The lifecycle, and the two states worth explaining.
--
-- awaiting_approval exists because money that did not move through a payment
-- processor is a claim rather than an event. An operator ticking "paid by bank
-- transfer", and an integrator posting an order it says it collected, are both
-- assertions this platform cannot verify. Whether they queue here or go straight
-- through is the orders.offline_trust setting, so an operator who wants the
-- friction has it and one who does not is not forced to invent a workaround.
--
-- provisioned is deliberately distinct from paid. Paid is a fact about money.
-- Provisioned is a fact about this system having built the account, and the gap
-- between them is where a failed fulfilment is visible instead of silent.
create type order_status as enum (
  'draft','awaiting_payment','awaiting_approval','paid','provisioned',
  'canceled','refunded','failed'
);

create type order_payment_method as enum (
  'stripe_subscription',  -- card confirmed against a subscription, the site path
  'stripe_invoice',       -- invoice sent, paid whenever they get to it
  'payment_link',         -- a hosted link handed over in a conversation
  'external',             -- collected by the integrating site's own processor
  'offline'               -- bank transfer, cash, or a processor this platform never sees
);

-- Order numbers ----------------------------------------------------------------
--
-- Support quotes this, so it is short, unambiguous when read aloud, and carries
-- no brand: the platform serves many sites and may not name any of them. Year
-- plus a zero-padded counter, e.g. 2026-00417.
create sequence order_no_seq start 1;

-- The table --------------------------------------------------------------------

create table orders (
  id           uuid primary key default gen_random_uuid(),
  order_no     text not null unique
               default to_char(now(), 'YYYY') || '-' || lpad(nextval('order_no_seq')::text, 5, '0'),

  -- Which site sold it.
  --
  -- Written directly, and this is the one deliberate exception to 0027's rule
  -- that site_id is always derived by trigger. Every other tenant table reaches
  -- its site through an organization, but an order exists before there is an
  -- organization to ask: at creation the site is known from the API key, the
  -- console's selected site, or the checkout's own site, and there is nothing
  -- else to derive it from. It is validated on the way in by application code
  -- rather than by a trigger, so it is listed in SITE_SCOPED_TABLES for the
  -- guard script but has no derivation function.
  --
  -- Nullable and on delete set null, matching organizations.site_id, because P11
  -- holds here too: deleting a site must never delete the record of a sale.
  site_id      uuid references sites(id) on delete set null,

  source       order_source not null,
  status       order_status not null default 'draft',
  payment_method order_payment_method,

  -- Null until fulfilment creates or finds the organization. Set from the start
  -- on portal_upgrade, where the buyer is already a client.
  org_id       uuid references organizations(id) on delete set null,

  -- The buyer as given at the point of sale. Kept on the order rather than read
  -- back off the organization, because an order is a record of what was agreed
  -- at a moment and a client's details change afterwards.
  buyer_email   text not null check (buyer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  buyer_name    text,
  buyer_company text,
  buyer_phone   text,

  -- What was bought. Priced from the shared catalogue, never from a caller.
  plan_id       uuid not null references plans(id),
  cycle_key     text not null references billing_cycles(key),
  rate_card_key text not null references rate_cards(key),
  addon_keys    text[] not null default '{}',
  coupon_id     uuid references coupons(id) on delete set null,

  -- Money, in cents, resolved server side at creation and frozen.
  --
  -- Frozen matters: a price list edited next quarter must not silently restate
  -- what somebody paid last quarter. These columns are what was charged, and the
  -- catalogue is what is charged now.
  currency       text not null default 'usd',
  list_total     int not null default 0,
  discount_total int not null default 0,
  total          int not null default 0,
  due_today      int not null default 0,

  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_invoice_id      text,

  -- The other system's own identifier for this sale, when it had one. Carried so
  -- a reconciliation between the two sides has something to join on.
  external_ref  text,

  -- Supplied by an API caller so a retry cannot sell twice. Unique per site
  -- rather than globally, because two integrators generating "order-1" is not a
  -- collision either of them should be able to cause for the other.
  idempotency_key text,

  -- Where the buyer came from. utm fields, referrer, click ids. jsonb because
  -- this is somebody else's vocabulary and it changes without asking.
  attribution jsonb not null default '{}'::jsonb,

  note        text,

  -- Who acted. Three different actors, kept apart on purpose: an operator taking
  -- a sale, a credential posting one, and an operator approving money nobody can
  -- verify are three different accountabilities and one column cannot hold them.
  created_by  uuid references profiles(id) on delete set null,
  api_key_id  uuid references api_keys(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  approved_at    timestamptz,
  paid_at        timestamptz,
  provisioned_at timestamptz,
  canceled_at    timestamptz,

  -- A paid order knows when. Without this the timeline on an account is a guess,
  -- and "when did this become a customer" is the first question asked of it.
  constraint orders_paid_has_time check (
    status not in ('paid','provisioned') or paid_at is not null
  ),
  constraint orders_provisioned_has_org check (
    status <> 'provisioned' or (org_id is not null and provisioned_at is not null)
  )
);

comment on table orders is
  'Every sale, whichever surface took it. Fulfilment triggers on status reaching paid, so a bank transfer and a card produce the same account.';
comment on column orders.site_id is
  'Written directly, not derived. An order predates its organization, so there is nothing to derive from. See 0027 for the rule this excepts.';
comment on column orders.idempotency_key is
  'Caller supplied, unique per site. A retrying integration re-reads its order instead of creating a second one.';
comment on column orders.total is
  'What was charged, in cents, frozen at creation. The catalogue holds what is charged now.';

create unique index orders_idem_idx on orders (site_id, idempotency_key)
  where idempotency_key is not null;
create unique index orders_stripe_sub_idx on orders (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index orders_site_created_idx on orders (site_id, created_at desc);
create index orders_status_idx on orders (status) where status <> 'provisioned';
create index orders_org_idx on orders (org_id);
create index orders_email_idx on orders (lower(buyer_email));

-- Per site enablement -----------------------------------------------------------
--
-- Which of the four a site may use. Empty means the site sells through none of
-- them, which is the correct state for a site that has registered but not yet
-- agreed how it takes money, and it fails closed.
--
-- The platform master switch for each source lives in app_settings and is read
-- through lib/settings.ts. Effective enablement is the AND of the two, exactly
-- as api.public_enabled gates site_content.is_public: one switch to stop a
-- source everywhere during an incident, one list to say what each site sells.
alter table sites add column if not exists order_sources text[] not null default '{}';

comment on column sites.order_sources is
  'Order sources this site may use. ANDed with the platform master switch for each source; empty means the site cannot take orders.';

-- Empty is the right default for a site registered tomorrow and the wrong one
-- for a site selling today. Every existing site was already taking card payments
-- on its own website, so it gets that source and nothing else: a migration may
-- not quietly stop a working checkout, and it may not quietly grant three
-- capabilities nobody asked for either.
update sites set order_sources = array['site_checkout'] where order_sources = '{}';

-- Row level security ------------------------------------------------------------
--
-- Same posture as every table before it. Staff read through their own session.
-- A client reads their own organization's orders and nothing else, which is what
-- makes a receipts view in the portal possible without a new endpoint. Every
-- write goes through a server action or a route handler with the service role,
-- after the permission check, so there is no insert or update policy here at all.
alter table orders enable row level security;

create policy staff_read_orders on orders
  for select to authenticated using (is_staff());

create policy member_read_orders on orders
  for select to authenticated using (org_id is not null and is_member(auth.uid(), org_id));

-- Backfill ------------------------------------------------------------------------
--
-- Every subscription that already exists was an order, and leaving them out
-- would make the orders screen a record that begins the day this shipped. They
-- are reconstructed as provisioned site_checkout orders, since that is the only
-- surface that existed to sell them.
--
-- paid_at is the subscription's start, not now(), so the history reads true.
insert into orders (
  site_id, source, status, payment_method, org_id,
  buyer_email, buyer_name, buyer_company,
  plan_id, cycle_key, rate_card_key,
  stripe_customer_id, stripe_subscription_id,
  created_at, paid_at, provisioned_at
)
select
  o.site_id, 'site_checkout', 'provisioned', 'stripe_subscription', o.id,
  coalesce(o.owner_email, 'unknown@example.invalid'), o.owner_name, o.name,
  s.plan_id, s.cycle_key, s.rate_card_key,
  s.stripe_customer_id, s.stripe_subscription_id,
  s.created_at, coalesce(s.started_at, s.created_at), coalesce(s.started_at, s.created_at)
from subscriptions s
join organizations o on o.id = s.org_id
where o.owner_email is not null
on conflict do nothing;
