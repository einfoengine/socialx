# socialX Portal Plan

Architecture and build plan for the socialX backend: own checkout, an Admin Portal, and a
Client Portal, on Supabase.

Status: proposal, not yet approved for build. Written 2026-08-22 on branch `portal-work`.

Companion to `docs/PLATFORM-CONTEXT.md`, which carries the business context this plan
assumes. No em-dashes anywhere in this file, per socialX copy rules.

---

## 0. Decisions this plan is built on

Confirmed with Shariful before writing:

| Decision | Choice |
|---|---|
| Payments | **Stripe direct.** Own checkout on socialx.studio. HighLevel checkout retired after migration |
| HL Social Planner | **Manual push first, API automation in R4.** The portal owns calendar and status from day one |
| ClickUp | **Portal replaces it for client work.** ClickUp keeps internal and non-client tasks only |
| Scope | **Full target architecture, phased into shippable releases** |
| Media | **HighLevel hosts files, socialX stores links. Supabase Storage as a second provider for quick adds.** Confirmed 2026-08-22, already proven on another growX property |
| Launch pricing | **Stays active.** Seeded as a live rate card, not an expiring one |

### What this is really solving

Today the business runs on manual assembly in ClickUp, Drive, and Canva, with checkout in
HighLevel and no client-facing system at all. That caps out around 25 clients, which is
exactly what the Company Profile says. The portal is the Phase 3 moat, and this plan is how
it gets built.

Two things are true today that make this urgent rather than optional:

1. The live FAQ already promises clients a "socialX dashboard" and a "customer portal" for
   approving batches and managing subscriptions. Neither exists. The copy is describing this
   plan.
2. Checkout sits in HighLevel, so socialX has no first-party record of its own orders.
   Provisioning, entitlements, and delivery state all start from a system socialX does not own.

---

## 1. Goals and non-goals

### Goals

- Take money on socialX's own domain, with subscription state as first-party data.
- Give operations a single source of truth from order to published post.
- Give clients a real portal: calendar, approvals, revisions, billing, brand profile.
- Enforce tier entitlements in the system rather than in someone's memory.
- Make the library an asset that can be mass-updated when HighLevel ships changes.
- Keep the path to auto-publishing into HL Social Planner open without blocking v1 on it.

### Non-goals for this plan

- The white-label end-client tier. It is on the horizon and the schema leaves room for it
  (see section 11), but it is not designed here and is never sold as available now.
- Replacing Slack, Drive, Canva, or Figma. The portal owns delivery state, not the whole stack.
- A public content marketplace or client-browsable library. Clients see their own batch, never
  the raw library. The library is the IP.

---

## 2. System shape

```
                    socialx.studio (Next.js 16, one app, three route groups)
   ┌─────────────────────────┬──────────────────────────┬────────────────────────┐
   │  (marketing)            │  (client)                │  (admin)               │
   │  landing, pricing       │  /portal/*               │  /admin/*              │
   │  checkout entry         │  calendar, approvals,    │  orders, library,      │
   │                         │  billing, brand          │  batches, publishing   │
   └─────────────────────────┴──────────────────────────┴────────────────────────┘
                │                        │                          │
                │                 Data Access Layer (server only, verifySession)
                │                        │
                ▼                        ▼
        ┌──────────────┐        ┌──────────────────────────────────────┐
        │   Stripe     │◄──────►│  Supabase                            │
        │  checkout    │webhook │  Postgres + RLS, Auth, Storage,      │
        │  billing     │        │  Realtime, Edge Functions, Cron      │
        └──────────────┘        └──────────────────────────────────────┘
                                              │
                                              │  R4 only
                                              ▼
                                   ┌──────────────────────┐
                                   │  HighLevel API v2    │
                                   │  Social Planner      │
                                   └──────────────────────┘
```

One Next.js app, not three. Route groups keep the marketing site, client portal, and admin
portal separate in code while sharing the design system, the auth session, and one deploy.

### Stack

| Layer | Choice | Note |
|---|---|---|
| App | Next.js 16.2.6 App Router, React 19 | Already in the repo |
| Styling | Tailwind v4, existing tokens in `app/globals.css` | Portal reuses the site's design language, including square corners |
| DB | Supabase Postgres | Row Level Security on every tenant table |
| Auth | Supabase Auth, email magic link + password | Staff and clients in one user pool, separated by role |
| Files | **HighLevel media library primary, Supabase Storage secondary** | Hybrid. See section 3.4 |
| Payments | Stripe, subscriptions mode | Catalog seeded from code, never hand-created |
| Jobs | Supabase Cron plus a `jobs` table | Batch generation, dunning checks, publish retries |
| Email | Resend or Postmark | Transactional only. Marketing stays in HighLevel |
| Hosting | Vercel | Webhooks as Route Handlers on Node runtime |

### Auth architecture, specific to Next.js 16

Two things in this Next version change the usual pattern, and both are load-bearing:

1. **`middleware.ts` is now `proxy.ts`.** Same functionality, new file convention.
2. **Proxy must not be the authorization layer.** The bundled docs are explicit: it runs on
   every route including prefetches, so it should do optimistic cookie checks only, with no
   database calls.

So authorization is layered:

- `proxy.ts` does the cheap redirect: no session cookie on `/portal` or `/admin` goes to login.
- A **Data Access Layer** in `lib/dal/` holds `verifySession()`, memoized with React `cache()`,
  and every server component, server action, and route handler calls it before touching data.
- **RLS in Postgres** is the last line. Even if application code has a bug, a client's session
  cannot read another org's rows.
- The **service role key** is used only in `server-only` modules: webhook handlers and
  provisioning. It never reaches a component that can be rendered on the client.

---

## 3. Data model

Postgres, in schema `public` unless noted. Every tenant-scoped table carries `org_id` and is
covered by RLS. Types are indicative rather than final DDL.

### 3.1 Identity and tenancy

```sql
-- One row per paying client company.
organizations (
  id              uuid pk,
  name            text not null,
  slug            text unique,
  status          org_status,         -- pending, onboarding, active, paused, churned
  source          text,               -- 'stripe' | 'highlevel_legacy' | 'manual'
  hl_location_id  text,               -- their HighLevel subaccount, nullable until known
  owner_email     text,
  created_at      timestamptz
)

profiles (              -- mirrors auth.users
  id           uuid pk references auth.users,
  full_name    text,
  email        text,
  avatar_url   text,
  is_staff     boolean default false
)

memberships (           -- client-side access
  id       uuid pk,
  org_id   uuid references organizations,
  user_id  uuid references profiles,
  role     member_role,   -- owner, manager, viewer
  unique (org_id, user_id)
)

staff_roles (           -- socialX-side access
  user_id  uuid pk references profiles,
  role     staff_role    -- owner, ops, content, finance
)
```

Staff and clients share one user pool. `is_staff` plus `staff_roles` gates `/admin`;
`memberships` gates `/portal`. A staff member never gets a `membership` row, so staff access to
client data goes through explicit service-role paths that are logged, not through RLS leakage.

### 3.2 Catalog, entitlements, and billing

This is where the "pricing is locked" guardrail becomes a system property rather than a rule
people have to remember.

```sql
plans (
  id       uuid pk,
  key      text unique,        -- starter | growth | scale
  name     text,
  sort     int,
  is_active boolean
)

plan_entitlements (
  plan_id            uuid pk references plans,
  posts_per_month    int not null,     -- 8 | 16 | 24
  motion_videos      int not null,     -- 0 | 2 | 4
  platforms_max      int not null,     -- 2 | 3 | 4
  revision_rounds    int,              -- 1 | 2 | NULL means unlimited
  first_batch_days   int not null,     -- 7 | 7 | 5
  customization_level text,            -- light | heavy | bespoke
  monthly_call       boolean
)

billing_cycles ( key text pk, months int, label text )         -- monthly, quarterly, half, yearly
rate_cards     ( key text pk, label text, active_from date, active_to date )  -- regular | launch

plan_prices (
  id              uuid pk,
  plan_id         uuid references plans,
  cycle_key       text references billing_cycles,
  rate_card_key   text references rate_cards,
  unit_amount     int not null,        -- cents, the charge for the whole cycle
  currency        text default 'usd',
  stripe_price_id text unique,
  is_active       boolean,
  unique (plan_id, cycle_key, rate_card_key)
)

subscriptions (
  id                     uuid pk,
  org_id                 uuid references organizations,
  plan_id                uuid references plans,
  cycle_key              text,
  rate_card_key          text,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 sub_status,   -- trialing, active, past_due, paused, canceled, incomplete
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean,
  started_at             timestamptz,
  canceled_at            timestamptz
)

invoices (
  id                 uuid pk,
  org_id             uuid,
  stripe_invoice_id  text unique,
  number             text,
  amount_due         int,
  amount_paid        int,
  status             text,
  hosted_invoice_url text,
  pdf_url            text,
  period_start       timestamptz,
  period_end         timestamptz,
  issued_at          timestamptz
)

stripe_events (        -- webhook idempotency
  id           text pk,           -- Stripe event id
  type         text,
  received_at  timestamptz,
  processed_at timestamptz,
  error        text
)
```

**Why entitlements are a table, not constants in code.** Post counts, platform caps, revision
rounds, and turnaround days are the actual contract. Putting them in one row per plan means the
batch builder can compute quota, the client portal can show "2 of 16 used", and the revision
counter can enforce Starter's single round without anyone hardcoding a number in three places.

`plan_prices` is the full 3 plans x 4 cycles x 2 rate cards grid, which is 24 Stripe prices. It
is seeded by a script from a single source file, never created by hand in the Stripe dashboard.
That is what makes "no invented discounts" enforceable: there is no code path that charges an
amount that is not a row in this table.

### 3.3 Brand profile, replacing the onboarding survey

```sql
brand_profiles (
  org_id          uuid pk references organizations,
  brand_name      text,
  website         text,
  logo_asset_id   uuid references assets,
  colors          jsonb,        -- {primary, secondary, ink, ...}
  voice_notes     text,
  positioning     text,
  icp_notes       text,
  services        jsonb,        -- what their SaaS actually sells
  niches          text[],       -- roofing, HVAC, dental
  banned_words    text[],       -- honours their own copy rules
  approver_name   text,
  approver_email  text,
  completed_at    timestamptz
)

brand_platforms (
  id         uuid pk,
  org_id     uuid,
  platform   platform_enum,     -- linkedin, facebook, instagram, tiktok, x, hl_community, other
  handle     text,
  hl_account_ref text,          -- the Social Planner account id inside their location
  is_active  boolean
)

hl_connections (                -- R4
  org_id            uuid pk,
  location_id       text,
  access_token_enc  text,       -- encrypted at rest, service role only
  refresh_token_enc text,
  scopes            text[],
  status            text,       -- connected, expired, revoked
  connected_at      timestamptz
)
```

The current onboarding is an embedded HighLevel survey in `app/onbording/`. R1 replaces it with
a native multi-step wizard writing straight into these tables, which is what makes the data
usable by the batch builder instead of sitting in HL form submissions.

### 3.4 Media: HighLevel primary, Supabase secondary

Confirmed approach, already proven on another growX property. The template library plus per
client brand editing generates far more images than is sensible to keep in Supabase Storage,
so **HighLevel hosts the files and socialX stores the links**. Previews in both portals render
straight from the HighLevel CDN. Supabase Storage stays available as a second provider for
quick adds and anything that needs to exist immediately without a round trip to HighLevel.

```sql
create type media_provider as enum ('highlevel', 'supabase');

assets (
  id               uuid pk,
  org_id           uuid,              -- null for socialX library assets
  provider         media_provider not null,

  -- HighLevel hosted
  url              text,              -- CDN link, used directly for preview
  hl_location_id   text,
  hl_file_id       text,

  -- Supabase hosted
  bucket           text,
  path             text,

  -- common
  mime             text,
  width            int,
  height           int,
  duration_s       numeric,
  bytes            bigint,
  alt              text,
  checksum         text,
  last_verified_at timestamptz,
  created_by       uuid,
  created_at       timestamptz,

  constraint provider_shape check (
    (provider = 'highlevel' and url is not null) or
    (provider = 'supabase'  and bucket is not null and path is not null)
  )
)
```

**One table, one resolver.** Every other table references `asset_id` and never learns where the
bytes live. A single `resolveAssetUrl(asset)` in the DAL returns the HighLevel CDN link as is,
or mints a short lived signed URL for a Supabase object. That keeps the provider a storage
detail rather than something every component has to branch on, and it means moving an asset
between providers later touches one function instead of every call site.

**Which HighLevel location holds the file matters.** This is the decision most likely to hurt
later if it is made casually:

| Asset | Recommended home | Why |
|---|---|---|
| Library templates and creative | socialX's own HighLevel location | It is socialX IP. It must not depend on any client account |
| Client batch creative produced by socialX | socialX's own location | A churned client who revokes access would otherwise break every preview in their own delivery history |
| Files the client uploads themselves | Client's location, or Supabase | It is their material. Supabase is the simpler path for one off uploads |

The recommendation is that anything socialX produces lives in socialX's location, and only
client supplied material lives elsewhere. Otherwise cancelling a client silently destroys the
record of what was delivered to them.

**The failure mode to design for.** A HighLevel hosted link is only as durable as the file
behind it. If someone deletes or moves a file inside HighLevel, the link 404s and the portal
shows a broken preview with no warning. Three cheap mitigations:

- `last_verified_at` plus a nightly job that HEAD checks a rolling sample of active assets.
- A broken asset surfaces in the admin Today screen rather than to the client.
- `checksum` and `bytes` recorded at upload, so a replaced file is detectable rather than silent.

**Configuration this implies.** The HighLevel CDN hostname has to be allowed in
`next.config.ts` under `images.remotePatterns` for `next/image` to optimize previews, and in
the Content Security Policy `img-src` once one is set. Both are one line each, and both are
easy to forget until previews silently break in production.

### 3.5 The library

This is the part with the most long-term leverage, and the part most likely to be
under-designed if it gets rushed.

```sql
pillars (
  key             text pk,      -- feature_spotlight, education, pain_agitation, social_proof, promotional
  name            text,
  default_mix_pct int           -- 30, 25, 18, 15, 12
)

hl_features (
  id             uuid pk,
  parent_id      uuid references hl_features,   -- parent and sub tags
  name           text,
  slug           text unique,
  status         text,          -- active, changed, deprecated
  last_shipped_at date
)

templates (
  id                 uuid pk,
  code               text unique,     -- SX-0142, stable human reference
  title              text,
  pillar_key         text references pillars,
  format             template_format, -- static | motion
  master_concept     text,
  is_niche_neutral   boolean default true,
  status             text,            -- draft, published, retired
  current_version_id uuid,
  created_by         uuid
)

template_versions (
  id           uuid pk,
  template_id  uuid references templates,
  version      int,
  hook         text,        -- opens on the reader's world
  middle_beat  text,        -- the HL feature as quiet resolution
  outcome      text,
  cta          text,
  variables    jsonb,       -- {{brand_name}}, {{niche}}, {{offer}}, {{feature}}
  changelog    text,
  published_at timestamptz,
  unique (template_id, version)
)

template_features ( template_id uuid, feature_id uuid, primary key (template_id, feature_id) )

template_variants (
  id                  uuid pk,
  template_version_id uuid references template_versions,
  platform            platform_enum,
  copy                text,
  aspect_ratio        text,
  design_ref          text        -- Canva or Figma reference
)
```

Three design points worth defending:

- **The copy law is structural.** `hook`, `middle_beat`, `outcome`, `cta` are separate columns
  rather than one body field, because the customer-first structure is the product's quality
  rule. Separate fields make it reviewable and make it obvious when a draft leads with the
  product.
- **Feature tags are their own axis.** `template_features` is a join table crossing all pillars,
  exactly as the Company Profile specifies. When HighLevel changes a feature, one query finds
  every affected template, and a second finds every client post built from those versions.
- **Versions are immutable.** A post instance references `template_version_id`, not
  `template_id`. That is the only way to answer "which live client posts are running stale
  copy" after a feature ships.

### 3.6 Delivery: batches, posts, revisions

```sql
batches (
  id                   uuid pk,
  org_id               uuid references organizations,
  period_start         date,
  period_end           date,
  status               batch_status,
  due_at               timestamptz,     -- first batch uses entitlements.first_batch_days
  quota_posts          int,             -- snapshotted from entitlements at creation
  quota_motion         int,
  revision_rounds_used int default 0,
  assigned_to          uuid,
  submitted_at         timestamptz,
  approved_at          timestamptz,
  closed_at            timestamptz,
  unique (org_id, period_start)
)

posts (
  id                  uuid pk,
  batch_id            uuid references batches,
  org_id              uuid,
  template_version_id uuid,             -- null when written from scratch on Scale
  is_custom           boolean default false,
  title               text,
  format              template_format,
  pillar_key          text,
  copy                text,             -- the customized master copy
  design_asset_id     uuid references assets,
  platforms           platform_enum[],
  scheduled_for       timestamptz,
  status              post_status,
  position            int,
  created_by          uuid
)

post_platform_copy (      -- per-platform adaptation, not a resize
  post_id   uuid,
  platform  platform_enum,
  copy      text,
  asset_id  uuid,
  primary key (post_id, platform)
)

revisions (
  id           uuid pk,
  batch_id     uuid references batches,
  post_id      uuid,            -- null when the note is batch-level
  round        int,
  requested_by uuid,
  note         text,
  status       text,            -- open, in_progress, resolved
  created_at   timestamptz,
  resolved_at  timestamptz
)

comments (
  id        uuid pk,
  post_id   uuid references posts,
  author_id uuid,
  body      text,
  is_internal boolean default false,   -- staff-only notes never shown to the client
  created_at timestamptz
)

publish_jobs (
  id            uuid pk,
  post_id       uuid references posts,
  target        text,            -- hl_social_planner
  status        text,            -- pending, sent, confirmed, failed
  external_id   text,
  scheduled_for timestamptz,
  attempts      int default 0,
  last_error    text,
  published_at  timestamptz
)

-- see section 3.4 for the hybrid media model
assets (
  id            uuid pk,
  org_id        uuid,            -- null for library assets
  provider      media_provider,  -- highlevel | supabase
  url           text,            -- HighLevel: the CDN link used for preview
  hl_location_id text, hl_file_id text,
  bucket        text, path text, -- Supabase: object location
  mime text, width int, height int, duration_s numeric, bytes bigint,
  alt text, checksum text,
  last_verified_at timestamptz,
  created_by uuid, created_at timestamptz
)

activity_log (
  id         uuid pk,
  actor_id   uuid,
  org_id     uuid,
  entity     text, entity_id uuid,
  action     text,
  diff       jsonb,
  created_at timestamptz
)
```

### 3.7 State machines

**Batch:**

```
draft ──► in_production ──► in_review ──┬──► approved ──► scheduling ──► live ──► closed
                ▲                       │
                └── changes_requested ◄─┘
```

**Post:**

```
draft ──► in_production ──► in_review ──┬──► approved ──► scheduled ──► published
                ▲                       │                      │
                └── changes_requested ◄─┘                      └──► failed ──► (retry)
```

`skipped` exists on posts for the case where a client kills one piece without blocking the
batch.

### 3.8 Business rules the database enforces

These are the rules that currently live in people's heads, and each one is a real source of
margin leak or client dispute if it drifts:

| Rule | Enforcement |
|---|---|
| Post count per batch | Check against `batches.quota_posts`, snapshotted from entitlements |
| Motion video count | Same, `quota_motion`. Counted by `posts.format = 'motion'` |
| Platform cap | Post cannot list more platforms than `plan_entitlements.platforms_max` |
| Revision rounds | Trigger on `revisions` insert: reject when `revision_rounds_used >= revision_rounds` and the entitlement is not NULL |
| First batch turnaround | `due_at` computed at provisioning from `first_batch_days` |
| Price integrity | Charges only ever reference a `plan_prices.stripe_price_id` |
| One batch per client per month | `unique (org_id, period_start)` |

Quota is snapshotted onto the batch rather than read live, so a mid-cycle plan change does not
silently rewrite the terms of a batch already in production.

### 3.9 RLS posture

```sql
-- helpers
is_staff(uid)            -> exists in staff_roles
is_member(uid, org_id)   -> exists in memberships

-- shape of every tenant table policy
create policy client_read on posts for select
  using ( is_member(auth.uid(), org_id) );

create policy staff_all on posts for all
  using ( is_staff(auth.uid()) );
```

Client write access is deliberately narrow. Approving a batch, requesting a revision, and
posting a comment go through server actions that validate state transitions, not through direct
table writes. Clients get read access plus those three verbs. The library tables have no client
policy at all, so a client session cannot read a template even if a query is malformed.

---

## 4. Checkout, and how it feeds the Admin Portal

### 4.1 Flow

```
Pricing page
   │  tier + billing cycle
   ▼
Server action: createCheckoutSession(planKey, cycleKey)
   │  resolves the ACTIVE rate card server-side, looks up plan_prices,
   │  gets stripe_price_id. The client never sends a price.
   ▼
Stripe Checkout (subscription mode)
   │  metadata: { plan_price_id, plan_key, cycle_key, rate_card_key }
   ▼
success_url  /welcome?session_id=...        webhook  checkout.session.completed
                                                 │
                                                 ▼
                                    provisionFromCheckout()  [idempotent]
                                      1. upsert organization (status = onboarding)
                                      2. insert subscription
                                      3. invite owner user, create membership
                                      4. create first batch shell, due_at = now + first_batch_days
                                      5. insert admin task + Slack notification
   ▼
/welcome  "check your email"  ──►  magic link  ──►  Onboarding wizard
                                                       │ writes brand_profiles,
                                                       │ brand_platforms, logo asset
                                                       ▼
                                            org.status = active
                                            Admin Portal: order appears in the queue
```

**Why the price is resolved server-side.** If the browser could name a price, the locked
pricing guardrail would only be as strong as the front end. Resolving from `plan_prices` on the
server means the checkout cannot charge an amount that was not deliberately seeded.

### 4.2 Webhooks to handle

| Event | Action |
|---|---|
| `checkout.session.completed` | Provision org, subscription, user invite, first batch |
| `customer.subscription.updated` | Sync status, period dates, plan or cycle change |
| `customer.subscription.deleted` | Mark canceled, set org to churned at period end |
| `invoice.paid` | Store invoice, clear any past_due hold |
| `invoice.payment_failed` | Set past_due, start dunning, flag in admin |
| `invoice.upcoming` | Optional renewal reminder |

Every handler is idempotent through the `stripe_events` table, keyed on the Stripe event id.
Signature verification on the raw body, Node runtime, not Edge.

### 4.3 Plan changes and dunning

- **Upgrade:** immediate with proration. Entitlements apply from the next batch, not the batch
  in production.
- **Downgrade:** at period end, so the current batch is unaffected.
- **Cancel:** at period end. Delivery continues through the paid period.
- **Past due:** day 0 client banner, day 3 admin flag, day 7 delivery hold. Nothing gets
  scheduled while an account is on hold, which prevents publishing work that has not been paid for.
- **Payment method and invoice history:** Stripe Billing Portal, so socialX never handles card data.

### 4.4 Migrating off HighLevel checkout

1. Seed the Stripe catalog and run the new checkout on a hidden route.
2. Import existing clients (LeadJenn Automations on Scale) as `source = 'highlevel_legacy'`,
   with an org, a subscription row, and no `stripe_subscription_id`.
3. Switch pricing page CTAs to the new checkout.
4. Point `order.socialx.studio` links at the new flow and retire the HL order forms.
5. Migrate legacy subscribers to Stripe at their next renewal, or leave them on HL billing and
   flag them in admin. Either way the portal is their source of delivery truth.

**Open business question, needs Shariful's call.** The launch rate card is temporary, but a
Stripe subscription created on a launch price keeps that price until it is changed. Decide now
whether launch buyers are grandfathered forever or roll to the regular card at renewal. It
changes the `rate_cards` model and it is much cheaper to decide before the first Stripe
subscriber than after.

---

## 5. Admin Portal

Route group `app/(admin)/admin/*`. Gated by `is_staff` plus `staff_roles`.

| Module | What it does | Release |
|---|---|---|
| **Today** | Batches due, awaiting approval, overdue, failed publishes, new orders, past_due accounts. The one screen ops opens first | R2 |
| **Orders** | New order queue from checkout, onboarding completion state, assignment to a producer | R1 |
| **Subscriptions** | Every subscription with plan, cycle, rate card, status, renewal date, invoices, dunning state | R1 |
| **Clients** | Org detail: brand profile, platforms, HL connection, batch history, internal notes, activity log | R1 |
| **Library** | Template CRUD with versioning, pillar and feature tagging, platform variants, assets. Includes the "what is affected" view when a feature changes | R2 |
| **Batch builder** | The core screen. Pick client and month, see quota, pull templates, customize copy per the ladder, assign dates and platforms, drag on a calendar | R2 |
| **Review queue** | Incoming change requests across all clients, with round counters and SLA timers | R3 |
| **Publishing** | Approved posts ready to go out. Manual receipt in R2, automated jobs with retries in R4 | R2 then R4 |
| **Team** | Staff roles, assignment, workload | R2 |
| **Settings** | Plans, prices, rate cards, HL feature list, pillar mix | R1 |
| **Audit** | Activity log, filterable by org and actor | R2 |

### The batch builder deserves detail

It is the screen that replaces ClickUp, and it is where the whole month's work happens.

```
┌─ Client: FlowStack Pro ──── Period: Sep 2026 ──── Plan: Growth ─────────────┐
│  Quota  16 posts  /  2 motion  /  3 platforms      Used  11 / 16   2 / 2    │
├───────────────────────────┬─────────────────────────────────────────────────┤
│  LIBRARY                  │  BATCH                                          │
│  filter: pillar, feature, │  ┌───────────────────────────────────────────┐  │
│  format, unused-by-client │  │ Sep 03  Feature Spotlight  Missed Call    │  │
│                           │  │         LI / FB / IG        in_production │  │
│  SX-0142 Missed call...   │  ├───────────────────────────────────────────┤  │
│  SX-0187 Reputation...    │  │ Sep 05  Education           Pipelines     │  │
│  SX-0203 Pipelines...     │  │         LI                  in_review     │  │
│                           │  └───────────────────────────────────────────┘  │
│  [+ write from scratch]   │  Pillar mix: FS 31% / ED 25% / PA 19% ...       │
└───────────────────────────┴─────────────────────────────────────────────────┘
```

Behaviours that matter:

- **Quota is live and blocking.** The builder will not let a Growth batch exceed 16 posts or 2
  motion videos.
- **Pillar mix is shown against the target** (30/25/18/15/12), as guidance rather than a hard
  block. Drift is a quality signal ops should see while assembling, not after.
- **Already-used templates are flagged per client**, so the same client does not receive the
  same base post twice.
- **Customization depth follows the plan.** Starter shows brand-swap fields only. Growth opens
  full copy rewriting. Scale allows writing from scratch with no template link.

---

## 6. Client Portal

Route group `app/(client)/portal/*`. Gated by `memberships`.

| Module | What the client does | Release |
|---|---|---|
| **Overview** | What needs their attention, next batch status, days to next publish | R3 |
| **Calendar** | Month view of scheduled posts, filter by platform, click into any post | R3 |
| **Approvals** | Review a submitted batch post by post, approve all or request changes, with the remaining revision rounds visible before they spend one | R3 |
| **Post detail** | Per-platform copy and creative, comment thread, revision history | R3 |
| **Billing** | Plan, cycle, rate card, next invoice, invoice history, payment method, change plan, cancel | R3 |
| **Brand profile** | Edit the brand kit, voice, banned words, platforms. Changes flag the next batch for the producer | R3 |
| **Assets** | Upload wins, screenshots, testimonials, logos, feeding custom posts on Growth and Scale | R3 |
| **Team** | Invite colleagues, set roles | R3 |

### The approval screen is the product's face

It is the one screen most clients touch every month, and the place where the tier promise
either reads as honest or as overselling.

- **Show the round counter before they spend it.** "This is revision round 1 of 2" on Growth,
  "Unlimited revisions" on Scale, "1 round included" on Starter. The Company Profile is explicit
  that Starter must never be oversold as bespoke, and the UI is where that either holds or breaks.
- **Approve per post and per batch.** Most clients approve everything. The per-post path exists
  so one weak piece does not hold up fifteen good ones.
- **Comments are threaded per post,** with an internal flag so staff notes never surface to the client.
- **Every state change is logged** and visible to both sides, which is what kills "I never
  approved that" disputes.

---

## 7. HL Social Planner integration (R4)

Deferred deliberately. The portal owns calendar and status from R2, with a human pushing
approved posts into HighLevel and marking them scheduled. R4 replaces the human step.

**What it needs:**

- OAuth per HighLevel location, with encrypted tokens in `hl_connections` and refresh handling.
- A `publish_jobs` worker: claim pending jobs, post to the Social Planner API, store the
  external id, retry with backoff, surface hard failures to the Publishing screen.
- Status reconciliation, so a post deleted or edited inside HighLevel does not leave the portal
  claiming it is live.
- Per-client kill switch back to manual.

**Verify before committing the release.** The Social Planner endpoints in HighLevel API v2, the
per-platform payload requirements, media upload limits, and rate limits all need confirming
against current HighLevel documentation. Treat R4 sizing as provisional until that spike is
done, because it is the one release with a hard external dependency.

---

## 8. Release plan

Estimates assume one experienced full-stack developer. They are ranges, not commitments.

### R0. Foundations (1 to 2 weeks)

Supabase project, core schema, RLS helpers and policies, Supabase Auth wired to Next 16,
`proxy.ts` optimistic checks, the DAL with `verifySession()`, route groups, admin and portal
shells reusing the existing design tokens, staff role seeding.

**Done when:** a staff user can log in and reach an empty admin shell, a client user cannot, and
RLS is proven by a test that tries cross-org reads and fails.

### R1. Checkout and provisioning (2 to 3 weeks)

Stripe catalog seed script, checkout server action, webhook handler with idempotency,
provisioning, native onboarding wizard replacing the HL survey, admin Orders, Subscriptions,
Clients, and Settings.

**Done when:** a real card can buy Growth quarterly on socialx.studio, the org and subscription
exist in Supabase, the buyer completes onboarding, and the order shows in the admin queue.
**This is the release that ends the HighLevel checkout dependency.**

### R2. Library and batch builder (3 to 4 weeks)

Library CRUD with versioning and feature tagging, asset uploads, batch generation from
subscription periods, the batch builder with quota enforcement, calendar assignment, manual
publishing receipt, Today dashboard, audit log.

**Done when:** a month of client work runs end to end in the portal with no ClickUp involvement.
**This is the release that replaces ClickUp for client work.**

### R3. Client portal (2 to 3 weeks)

Overview, calendar, approvals with revision round enforcement, post detail with comments,
billing self-serve via Stripe Billing Portal, brand profile editing, asset uploads, team invites.

**Done when:** a client approves a batch and requests a revision without email.
**This is the release that makes the current FAQ copy true.**

### R4. HighLevel automation (2 to 3 weeks, after a spike)

OAuth per location, publish jobs with retries, status reconciliation, feature-change mass update
tooling, per-client fallback to manual.

**Done when:** approved posts appear in the client's HL Social Planner with no human step.

### R5. Scale and horizon (not scoped here)

Analytics and reporting, client-facing performance data, and the groundwork for the white-label
end-client tier.

### Sequencing logic

R1 before R2 is deliberate. Owning checkout gives first-party subscription data, and
entitlements come from subscriptions, so the batch builder in R2 has real quota to enforce
rather than a hardcoded guess. Building the builder first would mean building it twice.

---

## 9. Security and correctness

| Concern | Control |
|---|---|
| Cross-tenant reads | RLS on every tenant table. Cross-org read test in CI |
| Service role leakage | Service key only in `server-only` modules. Lint rule against importing them client-side |
| Auth in proxy | Optimistic cookie check only, no DB calls, per the Next 16 docs |
| Webhook forgery | Stripe signature verification on the raw body, Node runtime |
| Duplicate webhooks | `stripe_events` idempotency table |
| Price tampering | Price resolved server-side from `plan_prices`, never accepted from the client |
| HL tokens | Encrypted at rest, decrypted only in the publish worker |
| File access | Supabase objects in private buckets with short lived signed URLs. HighLevel assets resolved through one function so the provider is never assumed at the call site |
| Client data in AI tooling | Content is written with Claude. Keep client identities out of prompts, per the confidentiality guardrail |
| Audit | `activity_log` on every state transition |

---

## 10. Risks and open questions

| # | Item | Why it matters | Needs |
|---|---|---|---|
| 1 | **Launch pricing** | Confirmed staying active, so the launch rate card is seeded as a live card rather than an expiring one. Open sub-question: a Stripe subscription keeps whatever price it was created on, so launch buyers are grandfathered by default unless deliberately migrated | Default is grandfathered. Reversible later, per subscription |
| 1b | **HighLevel link durability** | Assets are HighLevel hosted, so a file deleted or moved inside HighLevel breaks previews silently | last_verified_at, nightly HEAD sampling, broken assets surfaced to admin not clients |
| 2 | **HL Social Planner API capability** | R4's entire premise. Endpoints, media limits, and rate limits are unverified | A spike before R4 is committed |
| 3 | **Unlimited revisions on Scale** | Real cost exposure with no system limit | A soft guard: track rounds, alert ops past a threshold, keep it unlimited contractually |
| 4 | **Library seeding** | R2's value depends on templates existing. Phase 1 is 285 posts plus 30 motion scripts across 27 features | Salman's production runway, in parallel with R0 and R1 |
| 5 | **Legacy client migration** | LeadJenn is on HL billing and asked for HighLevel Community as a fourth platform | Confirm the platform enum covers agreed non-standard channels |
| 6 | **Who does the build** | This is roughly 10 to 15 weeks of focused work | Resourcing decision |
| 7 | **FAQ copy is ahead of reality** | The site promises a dashboard and portal today | Either soften the copy now or ship R3 fast. Flagged in PLATFORM-CONTEXT section 9 |

---

## 11. Room left for the horizon

The white-label end-client tier is not designed here, but two choices keep the door open
without building anything for it now:

- `organizations` can carry a nullable `parent_org_id`, letting a reseller's end clients hang
  off the reseller as sub-orgs under the same billing relationship.
- `brand_profiles` is per-org rather than per-subscription, so an end client gets its own brand
  kit while the reseller keeps the commercial relationship.

Neither is built in this plan, and neither gets mentioned to clients as available.

---

## 12. What to do next

1. Decide the launch pricing question in section 10, item 1.
2. Approve or cut the release sequence in section 8.
3. Run the HighLevel Social Planner API spike so R4 can be sized honestly.
4. Start R0 while Salman continues the Phase 1 library build in parallel.

Nothing in this plan changes the offer, the pricing, or the ICP. It changes how the business
delivers what it already sells.
