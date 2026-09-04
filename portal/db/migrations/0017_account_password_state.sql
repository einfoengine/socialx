-- socialX portal :: R0 :: who can sign in with a password
--
-- The admin People screen needs to show whether an account has a password or can
-- only get in by emailed link. That fact lives in auth.users.encrypted_password,
-- which is not in the public schema, so PostgREST cannot select it and the Auth
-- admin API does not expose it. listUsers returns identities as null, so there is
-- no usable signal on the client side at all.
--
-- A security definer function is the way across that boundary. It returns one
-- boolean per user and never the hash itself, so the answer is available without
-- the material behind it leaving the database.
--
-- The guard is the where clause: for anyone who is not staff it returns zero rows
-- rather than raising, which is the same posture as the RLS policies in 0008.

create or replace function staff_account_password_state()
returns table (user_id uuid, has_password boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         (u.encrypted_password is not null and u.encrypted_password <> '')
  from auth.users u
  where is_staff(auth.uid());
$$;

-- Definer functions are executable by public by default, which would hand the
-- anon role a call into auth.users. The guard would still hold, but the grant
-- should not be there in the first place.
revoke execute on function staff_account_password_state() from public;
revoke execute on function staff_account_password_state() from anon;
grant execute on function staff_account_password_state() to authenticated;
