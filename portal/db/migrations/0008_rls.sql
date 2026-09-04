-- socialX portal :: R0 :: row level security
--
-- The last line of defence. Proxy does an optimistic cookie check, the Data Access
-- Layer verifies the session on every read and write, and these policies hold even
-- if both of those have a bug.
--
-- Posture:
--   staff    see everything through is_staff()
--   clients  read their own org, and write only through narrow verbs
--   library  has NO client policy at all, so a client session cannot read a template

-- Helpers -------------------------------------------------------------------
-- security definer so the policy can read membership without the caller needing
-- rights on the membership table itself.

create or replace function is_staff(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and is_staff = true);
$$;

create or replace function is_member(uid uuid, target_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = uid and org_id = target_org
  );
$$;

create or replace function current_org_ids(uid uuid default auth.uid())
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select org_id from memberships where user_id = uid;
$$;

create or replace function org_id_of_batch(b uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select org_id from batches where id = b;
$$;

-- Enable RLS everywhere ------------------------------------------------------
alter table organizations     enable row level security;
alter table profiles          enable row level security;
alter table memberships       enable row level security;
alter table staff_roles       enable row level security;
alter table plans             enable row level security;
alter table plan_entitlements enable row level security;
alter table billing_cycles    enable row level security;
alter table rate_cards        enable row level security;
alter table plan_prices       enable row level security;
alter table subscriptions     enable row level security;
alter table invoices          enable row level security;
alter table stripe_events     enable row level security;
alter table assets            enable row level security;
alter table brand_profiles    enable row level security;
alter table brand_platforms   enable row level security;
alter table hl_connections    enable row level security;
alter table pillars           enable row level security;
alter table hl_features       enable row level security;
alter table templates         enable row level security;
alter table template_versions enable row level security;
alter table template_features enable row level security;
alter table template_variants enable row level security;
alter table batches           enable row level security;
alter table posts             enable row level security;
alter table post_platform_copy enable row level security;
alter table revisions         enable row level security;
alter table comments          enable row level security;
alter table publish_jobs      enable row level security;
alter table activity_log      enable row level security;
alter table notifications     enable row level security;

-- Staff: full access across the board -----------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','memberships','staff_roles','plans','plan_entitlements',
    'billing_cycles','rate_cards','plan_prices','subscriptions','invoices','stripe_events',
    'assets','brand_profiles','brand_platforms','hl_connections','pillars','hl_features',
    'templates','template_versions','template_features','template_variants','batches',
    'posts','post_platform_copy','revisions','comments','publish_jobs','activity_log',
    'notifications'
  ]
  loop
    execute format(
      'create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t
    );
  end loop;
end $$;

-- Self ------------------------------------------------------------------------
create policy self_read   on profiles for select to authenticated using (id = auth.uid());
create policy self_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy own_memberships on memberships for select to authenticated
  using (user_id = auth.uid());

create policy own_notifications on notifications for select to authenticated
  using (user_id = auth.uid());
create policy own_notifications_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Client read access, scoped to their org -------------------------------------
create policy client_read on organizations for select to authenticated
  using (is_member(auth.uid(), id));

do $$
declare t text;
begin
  -- Only tables that actually carry org_id. post_platform_copy and revisions are
  -- scoped through their parent below; putting them here would fail at policy
  -- creation, because Postgres validates the expression against the columns.
  foreach t in array array[
    'subscriptions','invoices','brand_profiles','brand_platforms',
    'batches','posts','activity_log'
  ]
  loop
    execute format(
      'create policy client_read on %I for select to authenticated using (is_member(auth.uid(), org_id))', t
    );
  end loop;
end $$;

-- post_platform_copy has no org_id of its own; scope it through its post.
create policy client_read on post_platform_copy for select to authenticated
  using (exists (
    select 1 from posts p
    where p.id = post_platform_copy.post_id
      and is_member(auth.uid(), p.org_id)
  ));

-- revisions has no org_id either; scope it through the batch it belongs to.
create policy client_read on revisions for select to authenticated
  using (is_member(auth.uid(), org_id_of_batch(batch_id)));

-- Assets: a client sees its own, plus library assets attached to its own posts.
create policy client_read on assets for select to authenticated
  using (
    (org_id is not null and is_member(auth.uid(), org_id))
    or exists (
      select 1 from posts p
      where is_member(auth.uid(), p.org_id)
        and (p.design_asset_id = assets.id)
    )
  );

-- Comments: client sees its org''s comments, minus anything flagged internal.
create policy client_read on comments for select to authenticated
  using (
    is_internal = false
    and exists (
      select 1 from posts p
      where p.id = comments.post_id and is_member(auth.uid(), p.org_id)
    )
  );

-- Client writes: deliberately narrow ------------------------------------------
-- Approving a batch and changing post status go through server actions that
-- validate the transition. Clients get exactly two direct write verbs.

create policy client_comment on comments for insert to authenticated
  with check (
    is_internal = false
    and author_id = auth.uid()
    and exists (
      select 1 from posts p
      where p.id = comments.post_id and is_member(auth.uid(), p.org_id)
    )
  );

create policy client_request_revision on revisions for insert to authenticated
  with check (
    requested_by = auth.uid()
    and is_member(auth.uid(), org_id_of_batch(batch_id))
  );

-- Public catalog: anyone signed in can read the price list.
do $$
declare t text;
begin
  foreach t in array array['plans','plan_entitlements','billing_cycles','rate_cards','plan_prices']
  loop
    execute format('create policy read_catalog on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Deliberately NO client policy on:
--   templates, template_versions, template_features, template_variants, pillars,
--   hl_features        the library is the IP; clients see their batch, never the source
--   hl_connections     encrypted tokens, service role only
--   stripe_events      webhook plumbing
--   staff_roles        staff-only by definition
--   publish_jobs       internal delivery mechanics
