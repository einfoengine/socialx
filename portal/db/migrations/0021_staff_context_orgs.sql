-- socialX portal :: fold the org list into the staff gate
--
-- The admin layout fetched organizations on every page render, purely to fill
-- the owner's view switcher. On a database roughly 300ms away that is a fixed
-- tax on every screen for a dropdown most page views never open.
--
-- staff_context already makes the trip. It can carry this back with it.
-- Owners only: nobody else has a switcher to fill.

create or replace function staff_context(preview_role text default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  real_role staff_role;
  eff_role  staff_role;
  perms     json;
  orgs      json;
begin
  select role into real_role from staff_roles where user_id = auth.uid();

  if real_role is null then
    return json_build_object('is_staff', false);
  end if;

  eff_role := real_role;
  if real_role = 'owner' and preview_role is not null and preview_role <> 'owner' then
    begin
      eff_role := preview_role::staff_role;
    exception when invalid_text_representation then
      eff_role := real_role;
    end;
  end if;

  select coalesce(json_object_agg(section, level), '{}'::json)
    into perms
    from staff_permissions
   where role = eff_role;

  -- security definer bypasses RLS, so this is deliberately gated on the caller
  -- actually being an owner rather than on the policy that would have applied.
  if real_role = 'owner' then
    select coalesce(json_agg(json_build_object('id', id, 'name', name) order by name), '[]'::json)
      into orgs
      from organizations;
  else
    orgs := '[]'::json;
  end if;

  return json_build_object(
    'is_staff', true,
    'real_role', real_role,
    'effective_role', eff_role,
    'permissions', perms,
    'orgs', orgs
  );
end;
$$;

revoke all on function staff_context(text) from public;
grant execute on function staff_context(text) to authenticated;
