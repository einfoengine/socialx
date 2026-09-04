-- Portal :: R3 :: payments
--
-- Who collects the money, and what this platform knows when it is not the one
-- collecting.
--
-- Until now there was one answer: a card, on Stripe, in this platform's own
-- account. Every billing row in the schema is shaped by that assumption.
-- subscriptions is keyed on stripe_subscription_id, invoices on
-- stripe_invoice_id, and the portal's billing screen reads both and offers a
-- Stripe billing portal session on top. None of that is wrong. It is simply the
-- only case, and a site that already takes money through its own processor
-- currently has to either move its billing here or show its clients a billing
-- screen that says "no subscription on this workspace yet" forever.
--
-- So a site now says which it is:
--
--   platform   this platform's Stripe collects. The webhook keeps the rows in
--              step, and the client manages their card in the Stripe portal.
--   external   the site collects, somewhere this platform never sees. The rows
--              are imported from a feed the site publishes, and the portal shows
--              them as read-only facts with the site's own management link.
--
-- Three things are worth stating about the shape of this, because each was a
-- choice with a cheaper alternative that is worse:
--
-- 1. Imported rows land in `subscriptions` and `invoices`, tagged with `source`,
--    rather than in tables of their own. The portal, the subscriptions list and
--    the MRR total are then one reader over one shape. Parallel tables would
--    mean every screen merges two sources forever, and the first screen somebody
--    forgets to update is a client whose billing silently disappears.
--
-- 2. The two writers are fenced off each other's rows. The Stripe path filters
--    on stripe_subscription_id and stripe_invoice_id, which an imported row
--    never has; the importer filters on source = 'external'. Neither can touch
--    the other's records even if a feed reports an id it has no business
--    reporting.
--
-- 3. What was imported is never presented as more current than it is.
--    Every imported row carries synced_at, every run is recorded in
--    billing_syncs whether it worked or not, and the portal prints how old the
--    figure is. Billing data that is quietly eight days stale is worse than
--    billing data that is visibly eight days stale.

-- Vocabulary -------------------------------------------------------------------
--
-- One type for three columns, because the question is the same question in all
-- three: did the money move through this platform, or somewhere else. A site's
-- setting, a subscription's provenance and an invoice's provenance are the same
-- distinction at different scopes.

create type billing_source as enum ('platform', 'external');

comment on type billing_source is
  'platform: collected by this platform''s processor. external: collected by the site, imported from its feed.';

-- What a site chose ---------------------------------------------------------------

alter table sites
  add column if not exists payment_collection billing_source not null default 'platform';

comment on column sites.payment_collection is
  'Who takes this site''s money. ANDed with the billing.external_collection platform switch, so external can be stopped everywhere at once.';

-- The feed.
--
-- Pull rather than push, and the reason is what happens when an integration
-- stops. A site that pushes and then stops pushing looks exactly like a site
-- with no customers: there is nothing to notice. A feed this platform fetches
-- fails visibly, on a schedule, with an HTTP status and a row saying so.
--
-- The header name is configurable because plenty of systems that can serve JSON
-- cannot serve it behind an Authorization scheme, and the same reasoning already
-- put x-api-key next to Bearer on the way in. The value is stored verbatim and
-- sent verbatim, so "Bearer abc" in the value field is one field of behaviour
-- rather than two of branching.
alter table sites add column if not exists billing_feed_url text
  check (billing_feed_url is null or billing_feed_url ~ '^https?://');
alter table sites add column if not exists billing_feed_header text not null default 'Authorization';
alter table sites add column if not exists billing_feed_secret text;
alter table sites add column if not exists billing_manage_url text;

comment on column sites.billing_feed_url is
  'Where this platform fetches the site''s billing state. https, except on localhost, enforced in application code.';
comment on column sites.billing_feed_secret is
  'Sent verbatim as the value of billing_feed_header. Stored because sending it needs it, and never selected by any read except the fetch.';
comment on column sites.billing_manage_url is
  'Where an externally billed client is sent to change their card. Printed in the portal in place of the Stripe billing portal button.';

-- Provenance on the rows themselves --------------------------------------------
--
-- Defaulting to platform is what makes this migration safe on a live database:
-- every existing subscription and invoice was collected by this platform's
-- Stripe, so the default states the truth about them rather than guessing it.

alter table subscriptions add column if not exists source billing_source not null default 'platform';
alter table subscriptions add column if not exists external_ref text;
alter table subscriptions add column if not exists external_manage_url text;
-- Cents per cycle, as the site actually charges.
--
-- Platform subscriptions have no amount here and must not: what they cost is
-- plan_prices joined with the rate card, and copying it onto the subscription
-- would be a second answer free to drift from the first. An external
-- subscription has no such join to make. The site sets its own prices, this
-- platform never sees the charge, and the only honest number is the one the feed
-- reports. Null means the feed did not say, and the portal falls back to the
-- catalogue rather than inventing a figure.
alter table subscriptions add column if not exists amount int
  check (amount is null or amount >= 0);
alter table subscriptions add column if not exists currency text;
alter table subscriptions add column if not exists synced_at timestamptz;

comment on column subscriptions.source is
  'Which writer owns this row. The Stripe webhook only ever touches platform rows; the importer only ever touches external ones.';
comment on column subscriptions.amount is
  'Cents per cycle as the site charges, for external rows only. Platform rows are priced from the catalogue.';
comment on column subscriptions.synced_at is
  'When this row was last confirmed by the site''s feed. Null on platform rows, which are pushed by Stripe rather than fetched.';

alter table invoices add column if not exists source billing_source not null default 'platform';
alter table invoices add column if not exists external_ref text;
alter table invoices add column if not exists synced_at timestamptz;

comment on column invoices.source is
  'platform: recorded from a Stripe event. external: imported from the selling site''s billing feed.';

-- An external row is identified by what the other system calls it, and a
-- platform row is not identified that way at all. Stating it as a constraint
-- rather than a convention means a future writer cannot half-adopt either shape:
-- an external row with nothing to match on would duplicate itself on the next
-- import, and a platform row carrying an external ref would be claimed by the
-- importer on the run after that.
-- Guarded, because ADD CONSTRAINT has no IF NOT EXISTS and the rest of this file
-- is written to survive being run twice.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_external_ref_matches_source') then
    alter table subscriptions add constraint subscriptions_external_ref_matches_source
      check ((source = 'external') = (external_ref is not null));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'invoices_external_ref_matches_source') then
    alter table invoices add constraint invoices_external_ref_matches_source
      check ((source = 'external') = (external_ref is not null));
  end if;
end $$;

-- Idempotency for the importer.
--
-- A feed is fetched again every hour and reports the same subscriptions every
-- time, so the second run has to update rather than duplicate. Unique on the
-- pair rather than on external_ref alone, because two sites are separate systems
-- and both are entitled to call something "sub_1". Nulls do not collide in a
-- Postgres unique index, so every platform row is exempt without a partial index
-- that PostgREST could not target on conflict.
create unique index if not exists subscriptions_external_ref_idx
  on subscriptions (org_id, external_ref);
create unique index if not exists invoices_external_ref_idx
  on invoices (org_id, external_ref);

-- Sync runs ---------------------------------------------------------------------
--
-- Recorded before the fetch is attempted, for the same reason webhook deliveries
-- are: a run that dies mid-request has to leave evidence, and one that is only
-- written on success turns "your billing has not updated in four days" into an
-- unanswerable question.
--
-- `problems` is what makes a half-working feed fixable. A run that imported
-- eleven subscriptions and skipped three is not a failure and must not be
-- reported as one, but the three are somebody's clients looking at an empty
-- billing screen. Naming them on the site record is the difference between a
-- five minute fix and a support thread.

create table billing_syncs (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,

  -- Who asked for it. An operator pressing Fetch now and the scheduler are the
  -- same work, and separating them is what lets somebody read the history as
  -- "this has been running on its own since Tuesday" rather than as noise.
  kind         text not null default 'schedule' check (kind in ('schedule', 'operator')),
  triggered_by uuid references profiles(id) on delete set null,

  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  http_status  int,

  subscriptions_seen    int not null default 0,
  subscriptions_written int not null default 0,
  invoices_seen         int not null default 0,
  invoices_written      int not null default 0,
  skipped               int not null default 0,

  problems     text[] not null default '{}',
  error        text
);

comment on table billing_syncs is
  'Every attempt to fetch a site''s billing feed, successful or not. Written before the request, so a run that never came back is still a row.';
comment on column billing_syncs.problems is
  'Rows the feed sent that could not be used, and why. Capped: this is a summary for the site record, not a log.';

create index billing_syncs_site_idx on billing_syncs (site_id, started_at desc);

alter table billing_syncs enable row level security;

-- Same posture as every table in 0026 and 0028. Staff read through their own
-- session; every write is the importer running with the service role, so there
-- is no insert or update policy here at all. No client sees this table: what a
-- client is entitled to is their own billing, not the health of the pipe that
-- fetched it.
create policy staff_read_billing_syncs on billing_syncs
  for select to authenticated using (is_staff());
