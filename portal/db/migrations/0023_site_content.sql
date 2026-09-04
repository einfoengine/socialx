-- socialX portal :: R1 :: website content
--
-- The marketing site ships copy and data baked into the repo, so changing a
-- number means a deploy. This gives the console a Website section where staff
-- keep named blobs of JSON, and the site reads them at render time.
--
-- Access is deliberately asymmetric. The console reads through the caller's own
-- session, so the staff_read policy below is what admits it. The site reads with
-- the service role from server code only, which bypasses RLS the same way the
-- Stripe webhook does. What matters is the absence: there is NO anon and NO
-- client policy, so nothing in a browser can query this table directly, on
-- either app. The data reaches a visitor only after the site's server has
-- rendered it into a page.
--
-- Writes go through the console's server actions with the service role, after
-- requirePermission('website','full'). Same doctrine as coupons and people: RLS
-- is the safety net underneath the DAL, not the primary gate.

create table site_content (
  key         text primary key
              check (key ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  data        jsonb not null,
  description text,
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

comment on table site_content is
  'Named JSON blobs the marketing site renders. Managed at /admin/website; read by apps/site through lib/content.ts.';
comment on column site_content.key is
  'Slug the site fetches by: lowercase letters, digits, hyphens, 2 to 63 chars.';

alter table site_content enable row level security;

create policy staff_read_site_content on site_content
  for select to authenticated using (is_staff());

-- The Website section joins the permission matrix. Content staff own it because
-- it is marketing copy; ops can look; finance has no reason to. Owner is full
-- everywhere by the guard trigger's rule.
insert into staff_permissions (role, section, level) values
  ('owner','website','full'),
  ('ops','website','view'),
  ('content','website','full'),
  ('finance','website','none')
on conflict (role, section) do nothing;
