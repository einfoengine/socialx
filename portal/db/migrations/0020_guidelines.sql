-- socialX portal :: development guidelines
--
-- Rules the build has to keep, each with the reason it exists. Distinct from
-- decisions, which record what Shariful locked in about the business. These are
-- engineering rules, and most of them are here because breaking them already
-- cost something once.

create table guidelines (
  id         uuid primary key default gen_random_uuid(),
  number     int generated always as identity,
  area       text not null,
  rule       text not null,
  why        text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index on guidelines (number);

alter table guidelines enable row level security;
create policy staff_all on guidelines for all to authenticated
  using (is_staff()) with check (is_staff());

create trigger guidelines_touch before update on guidelines
  for each row execute function touch_updated_at();

insert into guidelines (area, rule, why) values
(
  'Performance',
  'Proxy uses getSession, never getUser.',
  'getUser calls the Auth server on every request. Measured at 373ms median, which made Proxy roughly half of all server time. getSession verifies the JWT locally and only reaches the network when a refresh is actually due. Safe because Proxy does not authorize: the real check is getUser inside lib/dal, on every server component and every server action, with RLS underneath. Swapping it cut a warm admin page from 2136ms to 1749ms.'
),
(
  'Performance',
  'Read the whole staff gate in one round trip.',
  'Rendering an admin screen used to cost auth.getUser, then profiles, then staff_roles, then staff_permissions, each a separate network call. The staff_context function returns is_staff, the real role, the effective role after any preview, and the permission map together. With the Proxy change this took a warm admin page from 2136ms to 1092ms, a 49% cut. On a connection where a cold query measures half a second, the number of sequential round trips is the page.'
),
(
  'Performance',
  'One route per screen area, not one per tab.',
  'The journal was five routes, so reading five short lists meant five full page loads through the auth stack. It is now one route that issues its queries together, server renders every panel, and hands them to a client shell that switches on local state. Tab changes make no request at all. Old paths redirect so existing links still land on the right tab.'
),
(
  'Security',
  'A preview may only ever narrow access, never widen it.',
  'Both view-as features follow this. Only an owner can preview a staff role, and owner is never a preview target, so the effective role is always narrower than the real one. The rule is enforced twice, in lib/dal/permissions.ts and again inside the staff_context function, so a caller that forgets still cannot escalate. Verified by signing in as content, forging the cookie, and confirming People and Access stayed refused.'
),
(
  'Security',
  'Client-facing approvals cannot be produced from a staff preview.',
  'Viewing a client portal is read only: every portal mutation refuses while the preview cookie is set. A client approval is the contractual gate before anything publishes and it drives revision round counting, so an approval recorded as if the client made it would undermine the one thing the review loop exists to prove.'
),
(
  'Security',
  'Aggregator screens gate each panel on the section it reads from.',
  'The Overview reads batches, subscriptions, organizations, posts, assets, features and prices. Granting a role the Overview without per panel gating hands it a summary of everything the permission matrix closes off. Gate on the query, not the markup, so rows a role may not see never leave Postgres.'
),
(
  'Brand',
  'Never put a brand name inside an element with text-transform uppercase.',
  'The casing rule is locked: socialX, growX, HighLevel, never SOCIALX or GROWX. CSS uppercasing breaks it invisibly in the source. This was shipped twice in one session, in the journey actor chips and again in the client preview banner, and both times the source read correctly. Two pre-existing instances remain live on the marketing site, issues 8 and 9.'
),
(
  'Verification',
  'Verify what renders, not what the source says.',
  'A grep for the literal string SOCIALX could never match, because the uppercasing was CSS. The check passed and the bug shipped; a screenshot caught it. The same class of mistake made a stale dev server look like a passing test twice. Check the rendered output, and confirm the server actually rebuilt before trusting it.'
),
(
  'Verification',
  'Measure before and after with the same procedure.',
  'The first proxy measurement suggested the change had made things worse, because it compared logs taken under different warm states. A clean A/B, restarting and warming identically each time, showed an 18% gain. Timings taken under different conditions are not a comparison.'
);
