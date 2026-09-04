-- socialX portal :: one round trip for the staff gate
--
-- Rendering an admin screen used to cost four sequential calls to Supabase:
-- auth.getUser, then profiles for is_staff, then staff_roles for the role, then
-- staff_permissions for the matrix. Each one is a separate network round trip,
-- and on a connection where a cold query measures half a second that is most of
-- the page's time spent waiting rather than working.
--
-- This collapses the last three into one function. auth.getUser stays, because
-- validating the token against the Auth server is the security boundary and is
-- not something to trade away for latency.

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
begin
  select role into real_role from staff_roles where user_id = auth.uid();

  if real_role is null then
    return json_build_object('is_staff', false);
  end if;

  /* The same two rules the application enforces, restated here so the narrowing
     holds even if a caller forgets: only an owner may preview, and owner is
     never the target, so the effective role is always narrower than the real
     one and this can never widen access. */
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

  return json_build_object(
    'is_staff', true,
    'real_role', real_role,
    'effective_role', eff_role,
    'permissions', perms
  );
end;
$$;

revoke all on function staff_context(text) from public;
grant execute on function staff_context(text) to authenticated;
