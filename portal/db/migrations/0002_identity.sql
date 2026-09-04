-- socialX portal :: R0 :: identity and tenancy
-- Staff and clients share one auth pool. Which side someone is on is decided by
-- which table their id appears in: staff_roles for socialX, memberships for a client.

create table organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text unique not null,
  status         org_status not null default 'pending',
  source         text not null default 'stripe',   -- stripe | highlevel_legacy | manual
  hl_location_id text,                             -- their HighLevel subaccount
  owner_email    text,
  parent_org_id  uuid references organizations(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column organizations.parent_org_id is
  'Reserved for the future white label tier so a reseller can hold sub-orgs. Unused today.';

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  avatar_url text,
  is_staff   boolean not null default false,
  created_at timestamptz not null default now()
);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on memberships (user_id);
create index on memberships (org_id);

create table staff_roles (
  user_id    uuid primary key references profiles(id) on delete cascade,
  role       staff_role not null default 'ops',
  created_at timestamptz not null default now()
);

-- Keep profiles in step with auth.users without needing the app to remember to.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- is_staff on profiles is a cached read of staff_roles, so RLS policies stay cheap.
create or replace function sync_is_staff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    update public.profiles set is_staff = false where id = old.user_id;
    return old;
  else
    update public.profiles set is_staff = true where id = new.user_id;
    return new;
  end if;
end;
$$;

create trigger staff_roles_sync
  after insert or update or delete on staff_roles
  for each row execute function sync_is_staff();
