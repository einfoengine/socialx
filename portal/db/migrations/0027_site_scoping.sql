-- Portal :: R2 :: the site column, everywhere
--
-- 0026 gave sites their own tables and attached the three that structurally
-- needed one. This finishes the job: every table holding tenant data now carries
-- the site it belongs to, so a query can filter by site without joining through
-- organizations to find out.
--
-- Fourteen tables in two groups, and the grouping is how each one learns its
-- site rather than a judgement call about which matter:
--
--   Through their organization (10)
--     activity_log, assets, batches, brand_platforms, brand_profiles,
--     hl_connections, invoices, memberships, posts, subscriptions
--
--   Through their parent row (4)
--     comments, post_platform_copy, publish_jobs  via post_id
--     revisions                                   via batch_id
--
-- One table with tenant-ish data is deliberately left out. `notifications` is
-- keyed on a user, not an organization, and a user is not a tenant: staff hold
-- notifications and belong to no site, and a client could in principle belong to
-- more than one org. Giving it a site would mean inventing an answer the data
-- does not have.
--
-- What this is for, stated plainly, because a denormalized column always looks
-- like a shortcut until the reason is written down:
--
--   1. A join is a thing you can forget. `from("posts").eq("org_id", x)` is
--      correct for one org and silently wrong for a site; the version that is
--      correct for a site requires remembering that posts reach sites through
--      organizations. A column removes the question.
--   2. The console now shows one site at a time on every screen. That is eight
--      screens whose every query needs the same filter, and a filter that reads
--      the same on all eight is a filter somebody can audit.
--   3. It is the extraction path. If a customer ever has to move to their own
--      deployment, "every row carrying their site_id" is a dump. Reconstructing
--      that from joins later is archaeology.
--
-- The cost of denormalizing is drift, and drift is what the triggers below exist
-- to make impossible. site_id is never written by the application. It is derived
-- on the way in, and re-derived for every descendant if an organization ever
-- moves. Treat it as a computed column that happens to be stored.
--
-- What this does NOT do, said here so nobody reads more into it than is true: it
-- is not a security boundary against staff or against the API. Staff hold
-- is_staff() and see every site by design, and the API reads with the service
-- role, which has BYPASSRLS and skips every policy in this schema. Client
-- isolation was already airtight before this migration and is unchanged: a
-- client sees rows through is_member() on their own organization, and their
-- organization belongs to one site. The site filter is what keeps operators
-- looking at one customer at a time, and lib/dal/scoped.ts is where it is
-- enforced for code running as the service role.

-- The column -----------------------------------------------------------------
--
-- Nullable, and on delete set null, matching organizations.site_id from 0026.
-- Deleting a site must never delete the records of the clients it sold, and a
-- row whose organization has no site yet is a row waiting to be assigned rather
-- than an error.

do $$
declare t text;
begin
  foreach t in array array[
    'activity_log','assets','batches','brand_platforms','brand_profiles',
    'hl_connections','invoices','memberships','posts','subscriptions',
    'comments','post_platform_copy','publish_jobs','revisions'
  ]
  loop
    execute format(
      'alter table %I add column site_id uuid references sites(id) on delete set null', t
    );

    execute format(
      'comment on column %I.site_id is %L', t,
      'Derived by trigger from this row''s organization or parent. Never written by the application; see migration 0027.'
    );

    -- Every site-scoped read filters on this, so it is the index that matters.
    execute format('create index %I on %I (site_id)', t || '_site_idx', t);
  end loop;
end $$;

-- Deriving it ----------------------------------------------------------------
--
-- Three functions, one per way a row can learn its site. Each overwrites
-- unconditionally rather than filling in a blank, and that is the point: if they
-- only populated NULLs, an application could set site_id to whatever it liked
-- and the database would keep it, which is exactly the drift this column has to
-- be immune to. Passing a site_id in an insert is not an error, it is ignored.

create or replace function set_site_from_org()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.org_id is null then
    -- A row with no organization belongs to no site. Library assets and
    -- platform-level activity both land here, and both are correct.
    new.site_id := null;
    return new;
  end if;

  select o.site_id into new.site_id from organizations o where o.id = new.org_id;
  return new;
end;
$$;

comment on function set_site_from_org is
  'Keeps site_id equal to the row''s organization''s site. Overwrites whatever was supplied, so the column cannot drift.';

create or replace function set_site_from_post()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.post_id is null then
    new.site_id := null;
    return new;
  end if;

  select p.site_id into new.site_id from posts p where p.id = new.post_id;
  return new;
end;
$$;

comment on function set_site_from_post is
  'For rows that reach a tenant only through a post: comments, platform copy, publish jobs.';

create or replace function set_site_from_batch()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.batch_id is null then
    new.site_id := null;
    return new;
  end if;

  select b.site_id into new.site_id from batches b where b.id = new.batch_id;
  return new;
end;
$$;

comment on function set_site_from_batch is
  'For revisions, which belong to a batch. A revision can name a post or not, but it always names the batch.';

do $$
declare t text;
begin
  -- `of <column>` on the update branch, so an ordinary update of any other
  -- column does not pay for a lookup it cannot change the answer to.
  foreach t in array array[
    'activity_log','assets','batches','brand_platforms','brand_profiles',
    'hl_connections','invoices','memberships','posts','subscriptions'
  ]
  loop
    execute format(
      'create trigger %I before insert or update of org_id on %I
         for each row execute function set_site_from_org()',
      t || '_set_site', t
    );
  end loop;

  foreach t in array array['comments','post_platform_copy','publish_jobs']
  loop
    execute format(
      'create trigger %I before insert or update of post_id on %I
         for each row execute function set_site_from_post()',
      t || '_set_site', t
    );
  end loop;
end $$;

create trigger revisions_set_site
  before insert or update of batch_id on revisions
  for each row execute function set_site_from_batch();

-- Keeping it true ------------------------------------------------------------
--
-- The triggers above fix a row when the row changes. This one fixes every
-- descendant when the organization changes, which is the other half and the one
-- that is easy to forget: moving a client to a different site would otherwise
-- leave fourteen tables' worth of rows pointing at the site that used to own
-- them.
--
-- Guarded on a real change, because organizations is updated on every status
-- change and rewriting fourteen tables each time would be a serious cost for
-- nothing.

create or replace function resite_org_children()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare t text;
begin
  if new.site_id is not distinct from old.site_id then
    return new;
  end if;

  foreach t in array array[
    'activity_log','assets','batches','brand_platforms','brand_profiles',
    'hl_connections','invoices','memberships','posts','subscriptions'
  ]
  loop
    execute format('update %I set site_id = $1 where org_id = $2', t)
      using new.site_id, new.id;
  end loop;

  -- The generation below those. Reached by subquery rather than by letting the
  -- posts update cascade, because a BEFORE trigger on posts fires on the row
  -- being written and knows nothing about the rows pointing at it.
  foreach t in array array['comments','post_platform_copy','publish_jobs']
  loop
    execute format(
      'update %I set site_id = $1 where post_id in (select id from posts where org_id = $2)', t
    ) using new.site_id, new.id;
  end loop;

  update revisions set site_id = new.site_id
  where batch_id in (select id from batches where org_id = new.id);

  return new;
end;
$$;

comment on function resite_org_children is
  'Moves every one of an organization''s rows to its new site. Without it, reassigning a client would strand fourteen tables.';

create trigger organizations_resite
  after update of site_id on organizations
  for each row execute function resite_org_children();

-- Backfill -------------------------------------------------------------------
--
-- Written as direct updates rather than by touching every row and letting the
-- triggers fire, which on a table of any size is the difference between one
-- statement and a per-row function call.
--
-- Order matters exactly once: the post-derived tables read posts.site_id, so
-- posts has to be filled first. It is in the group above them.

do $$
declare t text;
begin
  foreach t in array array[
    'activity_log','assets','batches','brand_platforms','brand_profiles',
    'hl_connections','invoices','memberships','posts','subscriptions'
  ]
  loop
    execute format(
      'update %I x set site_id = o.site_id from organizations o
         where o.id = x.org_id and x.site_id is distinct from o.site_id', t
    );
  end loop;

  foreach t in array array['comments','post_platform_copy','publish_jobs']
  loop
    execute format(
      'update %I x set site_id = p.site_id from posts p
         where p.id = x.post_id and x.site_id is distinct from p.site_id', t
    );
  end loop;
end $$;

update revisions r set site_id = b.site_id
from batches b
where b.id = r.batch_id and r.site_id is distinct from b.site_id;

-- Row level security ---------------------------------------------------------
--
-- Nothing is added here, deliberately, and the reason is worth recording so the
-- absence does not read as an oversight.
--
-- A client already reaches these tables through is_member() on their own
-- organization, and an organization belongs to exactly one site, so a client can
-- no more read another site's rows after this migration than before it. Adding a
-- site predicate to those policies would be a second expression enforcing a
-- consequence of the first.
--
-- The two callers that could cross sites are staff, who hold is_staff() and are
-- meant to work across every site, and the API, which reads with the service
-- role. The service role has BYPASSRLS, so a policy written for it would never
-- be evaluated. That is why site scoping for those two paths lives in
-- application code at a single choke point, lib/dal/scoped.ts, checked by
-- scripts/check-site-scoping.mjs, rather than in a policy that would look
-- reassuring and do nothing.
