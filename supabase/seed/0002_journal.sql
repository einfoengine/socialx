-- socialX portal :: Journal seed
--
-- Backfills the decisions Shariful has already made and the work already done, so
-- the Journal is useful the first time it loads rather than an empty shell.
-- Idempotent: re-running updates rather than duplicating.

-- Decisions -----------------------------------------------------------------
insert into decisions (decided_on, topic, decision, rationale) values
  (date '2026-08-22', 'Payments',
   'Stripe direct. Own checkout on socialx.studio, HighLevel order forms retired after migration.',
   'Gives socialX first-party subscription data. Entitlements derive from subscriptions, so everything downstream depends on owning this.'),

  (date '2026-08-22', 'HL Social Planner',
   'Manual push first, API automation deferred to R4. The portal owns calendar and status from day one.',
   'Removes the largest external dependency from v1. The HighLevel API surface is unverified, so committing to it early would put an unknown on the critical path.'),

  (date '2026-08-22', 'ClickUp',
   'The portal replaces ClickUp for client work. ClickUp keeps internal and non-client tasks only.',
   'One source of truth for delivery state. Two systems drift.'),

  (date '2026-08-22', 'Scope',
   'Full target architecture, sequenced into five shippable releases R0 through R4.',
   'Each release ends something concrete: R1 retires HighLevel checkout, R2 replaces ClickUp, R3 makes the live FAQ copy true.'),

  (date '2026-08-22', 'Media hosting',
   'Hybrid. HighLevel hosts the files and socialX stores the links. Supabase Storage is the second provider for quick adds.',
   'The template library plus per-client brand editing produces far more images than belong in Supabase Storage. Already proven on another growX property.'),

  (date '2026-08-22', 'Launch pricing',
   'The launch offer stays active. Seeded as a live rate card, not an expiring one.',
   'Still being offered. Open sub-question: a Stripe subscription keeps whatever price it was created on, so launch buyers are grandfathered by default unless deliberately migrated.'),

  (date '2026-08-22', 'Screens and URLs',
   'Everything built inside the app gets its own screen with a proper URL. No state-only tabs.',
   'Deep linking, browser history, and the ability to send someone straight to a view.'),

  (date '2026-08-22', 'Journal',
   'The Admin Portal carries a Journal with three tabs: Daily Build Log, Locked Decisions, and Ideas with star ratings.',
   'Keeps build context, decisions, and future work in the product rather than in a conversation that ends. A 1 star rating always deletes the idea.'),

  (date '2026-08-22', 'Branch',
   'Work happens on the portal-work branch.',
   'Git ref names cannot contain spaces, so the requested "portal work" became portal-work.')
on conflict do nothing;

-- Build log ------------------------------------------------------------------
insert into build_log_entries (entry_date, release, title, body, author) values
  (date '2026-08-22', null, 'Repo cloned and branch created',
   'Cloned einfoengine/socialx into the working directory and cut the portal-work branch off main at 92c65ad.',
   'Claude'),

  (date '2026-08-22', null, 'Fixed pnpm dev failing with next: command not found',
   'Two stacked causes. Dependencies were never installed, and pnpm install itself exited 1 because pnpm 11 replaced the old ignoredBuiltDependencies approval with allowBuilds, leaving sharp and unrs-resolver undecided. Since pnpm dev shells out to pnpm install first, the failing install aborted the dev server before Next started. Added allowBuilds to pnpm-workspace.yaml with both packages set false, preserving the repo original intent.',
   'Claude'),

  (date '2026-08-22', null, 'Platform context captured',
   'Reviewed the full site against the Company Profile v2 and ICP v3. Wrote docs/PLATFORM-CONTEXT.md and wired it into CLAUDE.md so it loads every session. Catalogued guardrail breaks in shipped copy: the 800+ figure in four places framed as socialX own count, a since 2019 headline counter, and stock avatars used as customer proof.',
   'Claude'),

  (date '2026-08-22', null, 'Platform brief published',
   'Built The socialX System, a visual brief covering the offer, the buyer, the machine, and the rules, using the live site design tokens rather than the older doc palette.',
   'Claude'),

  (date '2026-08-22', null, 'Portal plan written',
   'Full architecture for own checkout, Admin Portal, and Client Portal on Supabase. Five releases, roughly 10 to 15 weeks. Published as docs/PORTAL-PLAN.md plus a visual companion.',
   'Claude'),

  (date '2026-08-22', 'R0', 'R0 foundations built',
   'Thirty tables across eight migrations, RLS on every one, a catalog seed asserting the locked pricing, and two test files. Application layer: Supabase browser, server, and service clients; a Data Access Layer with verifySession, requireStaff, and requireOrg; proxy.ts for optimistic checks only. App restructured into marketing, auth, client, and admin route groups, with GTM and the sales chat widget moved out of the root layout so they no longer load inside the portals.',
   'Claude'),

  (date '2026-08-22', 'R0', 'Two bugs caught before they shipped',
   'A static audit of the migrations found RLS policies scoping revisions and post_platform_copy by org_id, a column neither table has. Postgres validates policy expressions at creation, so both would have failed on the first run. Separately, the catalog seed rounded prices on cents while the live site rounds on dollars, which diverges on 18 of the 24 rows. Starter yearly launch would have been 98.50 instead of 99.',
   'Claude'),

  (date '2026-08-22', 'R0', 'Marketing site made independent of portal config',
   'proxy.ts runs on every route, so missing Supabase environment variables were returning 500 on the landing page. Public routes now degrade to a portal-unavailable notice while the marketing site keeps serving.',
   'Claude'),

  (date '2026-08-22', 'R0', 'Secrets handling and migration runner',
   'Added scripts/secure-env.mjs, which moves real values out of .env.example into a chmod 600 .env.local and prints key names only, never values. Added scripts/db.mjs to run migrations, seed, and tests over a direct Postgres connection, each file in its own transaction with a schema_migrations ledger so re-runs are safe.',
   'Claude'),

  (date '2026-08-22', 'R0', 'Journal built',
   'Admin Journal with three tabs, each its own route: build log, locked decisions, and rated ideas. Backfilled with every decision made so far and the build history to date.',
   'Claude')
on conflict do nothing;

-- Ideas ----------------------------------------------------------------------
insert into ideas (title, detail, source, status) values
  ('Fix the guardrail breaks in shipped marketing copy',
   'The 800+ claim appears in Hero, Booking, Footer, and WhySocialX framed as socialX own client count, against the locked 1000+ attributed to the founding team through GHL Video. The since 2019 counter in ClientLogos is Shariful personal story, not a brand claim. Hero and Booking use i.pravatar.cc stock avatars as customer proof.',
   'claude', 'open'),

  ('Soften the FAQ copy until R3 ships',
   'The live FAQ tells clients they approve batches in a socialX dashboard and manage subscriptions from a customer portal. Neither exists until R3. Either soften the wording now or accept the gap knowingly.',
   'claude', 'open'),

  ('Nightly link checker for HighLevel hosted assets',
   'A HighLevel link is only as durable as the file behind it. A nightly job that HEAD checks the oldest verified assets and flags broken ones to the admin Today screen, so a client never sees a broken preview first.',
   'claude', 'open'),

  ('Reconcile the two brand palettes',
   'The brand docs specify 01E7FF, 00A3FF, and 000877 with Chillax for body. The live site runs on 2B50DC and 5B8DEF with Inter. Comparison.tsx already mixes 01E7FF in from the doc palette, so the two systems are bleeding together.',
   'claude', 'open'),

  ('Resolve the revisions inconsistency in Includes',
   'Includes.tsx lists unlimited revisions on your first batch as standard across all plans, which contradicts 1 round on Starter and 2 on Growth.',
   'claude', 'open'),

  ('Soft guard on unlimited Scale revisions',
   'Scale is contractually unlimited, which is real cost exposure with no system limit. Track rounds and alert ops past a threshold without capping the client.',
   'claude', 'open'),

  ('Fix the dead links in the footer and white-label block',
   'Terms, Privacy, Cookie Settings, and GHL Explainer all point at href="#". The white-label Get on the list CTA does too, and the newsletter form shows success without sending anywhere.',
   'claude', 'open')
on conflict do nothing;
