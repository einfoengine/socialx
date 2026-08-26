-- socialX portal :: Issues
--
-- A numbered backlog of things found wrong or missing, so a finding survives the
-- conversation it was found in and can be worked one at a time.
--
-- Distinct from ideas: an idea is something that might be worth doing, rated by
-- preference. An issue is a defect or a gap between the journey and the system,
-- and its question is not "do we want this" but "is it fixed yet".
--
-- Staff only, like the rest of the journal.

create type issue_status   as enum ('open','in_progress','blocked','resolved','wont_fix');
create type issue_severity as enum ('low','medium','high');

create table issues (
  id         uuid primary key default gen_random_uuid(),
  -- Stable human handle. Identity rather than a count, so deleting one never
  -- renumbers the others and "issue 7" means the same thing next month.
  number     int generated always as identity,
  title      text not null,
  detail     text,
  area       text not null,
  severity   issue_severity not null default 'medium',
  status     issue_status   not null default 'open',
  source     text not null default 'claude',
  found_on   date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index on issues (number);
create index on issues (status, number);

alter table issues enable row level security;
create policy staff_all on issues for all to authenticated
  using (is_staff()) with check (is_staff());

create trigger issues_touch before update on issues
  for each row execute function touch_updated_at();

-- The backlog as it stood on 2026-08-26. Inserted here rather than in a seed
-- file because these are findings from a point in time, not catalog data that
-- should be re-applied on every run.
insert into issues (title, detail, area, severity, found_on) values
(
  'No notification layer exists at all',
  'The notifications table has zero rows and zero code references, and there is no outbound email transport anywhere in the project: no Resend, Nodemailer, SendGrid or Postmark in package.json. Journey steps 6, 7, 19 and 20 are all "we tell the client something" and none of them can happen. This blocks more of the journey than anything else on this list.',
  'Portal', 'high', '2026-08-26'
),
(
  'No audit stage in the system',
  'Journey steps 8 and 9 are running a comprehensive audit and submitting the audit report. There is no table, no route and no code. The word audit appears only in marketing copy in Booking.tsx and in the journey manifest itself.',
  'Journey', 'high', '2026-08-26'
),
(
  'The journey has two client approval gates, the system has one',
  'Steps 11 and 12 approve the plan; steps 15 and 16 approve the finished posts. batch_status only models the second: draft, in_production, in_review, changes_requested, approved, scheduling, live, closed. There is no state for "plan submitted, awaiting sign-off" before production starts. Step 23 needs the same gate for the next month.',
  'Delivery', 'high', '2026-08-26'
),
(
  'Permission matrix is enforced in the app only, not in RLS',
  'Section permissions are checked in lib/dal/permissions.ts on every page and server action, but 0008_rls.sql still grants every staff member full table access through the blanket staff_all policy keyed on is_staff(). A staff member calling PostgREST directly with a valid token is not stopped by Postgres. This was the accepted trade-off when the matrix was built, recorded here so it is a choice rather than an oversight.',
  'Security', 'high', '2026-08-26'
),
(
  'No month end report',
  'Journey step 20 sends a month end report and requests a meeting. No report artifact, generator or storage exists.',
  'Delivery', 'medium', '2026-08-26'
),
(
  'Clients cannot book a meeting from the portal',
  'Journey step 21. The only booking surface is the LeadConnector calendar in Booking.tsx on the marketing site, aimed at prospects. A paying client has no way to book from inside /portal.',
  'Portal', 'medium', '2026-08-26'
),
(
  'HighLevel Social Planner scheduling is manual',
  'Journey step 18. markScheduled in admin/publishing/actions.ts records a receipt after a human loads the Planner by hand. The HighLevel client implements listMedia, urlIsAlive and getLocation only, with no Social Planner endpoints. Documented in the code as intentional for R2 with the API arriving in R4, so this is planned work rather than a defect.',
  'Delivery', 'medium', '2026-08-26'
),
(
  'Comparison.tsx renders the brand as SOCIALX',
  'components/Comparison.tsx line 184 puts the text socialX inside a span carrying the uppercase class, so the live marketing site displays SOCIALX. The casing rule is locked: never SocialX, SOCIALX or Socialx.',
  'Marketing site', 'medium', '2026-08-26'
),
(
  'FooterReveal.tsx renders the brand as GROWX',
  'components/FooterReveal.tsx line 35 renders "[ Productized SaaS Socials by growX ]" inside an uppercase block, so it displays BY GROWX on the live site. Same locked casing rule as issue 8.',
  'Marketing site', 'medium', '2026-08-26'
),
(
  'Two staff accounts hold real client memberships',
  'shariful@vidiosa.com and growxstudiohq@gmail.com each have a manager membership on the FlowStack Pro org, presumably from testing the portal before a preview existed. They therefore appear in that client''s Team page as actual members. With View their portal in place these memberships are no longer needed.',
  'Data', 'medium', '2026-08-26'
),
(
  'The brand refresh reached only part of the codebase',
  '39 files still reference the old brand blue 2B50DC while 25 use the current 3D4AFF, so the two palettes are live side by side. The client login page and the portal-unavailable page are both still on the old colour.',
  'Brand', 'medium', '2026-08-26'
),
(
  'Marketing site overflows horizontally at about 430px',
  'At a 430px viewport the page is wider than the window: hero text and the right edge of the header are cut off, and the mobile menu trigger is pushed off screen. Confirmed as pre-existing by rendering the committed version at the same width.',
  'Marketing site', 'medium', '2026-08-26'
),
(
  'React hydration mismatch on the marketing home page',
  'The dev server logs "A tree hydrated but some attributes of the server rendered HTML did not match the client properties" on /. Not traced to a component yet. Predates the header work.',
  'Marketing site', 'low', '2026-08-26'
),
(
  'Two migrations share the number 0017',
  '0017_account_password_state.sql and 0017_permissions.sql. The runner tracks by filename so both apply in alphabetical order and the result is deterministic, but the numbering no longer reads as a sequence. Renaming means updating schema_migrations to match.',
  'Data', 'low', '2026-08-26'
);
