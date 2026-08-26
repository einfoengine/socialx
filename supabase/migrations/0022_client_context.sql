-- socialX portal :: one round trip for the client gate
--
-- Rendering any portal screen cost three sequential calls before a single byte
-- of HTML could flush: profiles for is_staff, memberships for the org, then the
-- organization name and the count of batches waiting on approval. On a database
-- roughly 400ms away that is most of a second of blank screen.
--
-- This returns all of it together. The portal shell can then paint while the
-- page's own modules are still streaming in behind their skeletons.

create or replace function client_context(preview_org uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid         uuid := auth.uid();
  staff       boolean;
  target_org  uuid;
  member_role member_role;
  org_name    text;
  waiting     int;
begin
  if uid is null then
    return json_build_object('signed_in', false);
  end if;

  select coalesce(p.is_staff, false) into staff from profiles p where p.id = uid;

  /* Staff previewing a client portal. Read only on the application side; this
     only decides which org the screens describe. Gated on actually being staff,
     because security definer means RLS is not doing that check here. */
  if staff and preview_org is not null then
    target_org  := preview_org;
    member_role := 'viewer';
  else
    select m.org_id, m.role into target_org, member_role
      from memberships m
     where m.user_id = uid
     order by m.created_at
     limit 1;
  end if;

  if target_org is null then
    return json_build_object('signed_in', true, 'is_staff', staff, 'has_org', false);
  end if;

  select o.name into org_name from organizations o where o.id = target_org;

  select count(*) into waiting
    from batches b
   where b.org_id = target_org and b.status = 'in_review';

  return json_build_object(
    'signed_in', true,
    'is_staff',  staff,
    'has_org',   true,
    'org_id',    target_org,
    'role',      member_role,
    'org_name',  org_name,
    'waiting',   waiting
  );
end;
$$;

revoke all on function client_context(uuid) from public;
grant execute on function client_context(uuid) to authenticated;
