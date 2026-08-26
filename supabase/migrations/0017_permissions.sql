-- socialX portal :: R1 :: staff section permissions
--
-- Until now every staff role reached every admin screen: staff_role was a label
-- printed in the rail, and is_staff() was the only real gate. This gives each
-- role a level per admin section, editable from /admin/settings/permissions.
--
-- Sections are keyed by a short string rather than a foreign key to a table of
-- sections, because a section is a screen in the app, not a business record. The
-- app owns that list (lib/permissions.ts); rows for a key the app no longer knows
-- are simply ignored, and a key with no row reads as 'none'.

create type access_level as enum ('none','view','full');

create table staff_permissions (
  role       staff_role   not null,
  section    text         not null,
  level      access_level not null default 'none',
  updated_at timestamptz  not null default now(),
  primary key (role, section)
);

comment on table staff_permissions is
  'One access level per (staff role, admin section). Enforced by the DAL; see lib/dal/permissions.ts.';

/* The owner role is the recovery path. If it could be demoted then one wrong
   toggle takes People and Settings away from everyone and nobody can undo it,
   because undoing it requires the screen that was just removed. The UI renders
   the owner column read-only and this refuses the write regardless. */
create or replace function guard_owner_permissions()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    if old.role = 'owner' then
      raise exception 'The owner role keeps full access to every section.';
    end if;
    return old;
  end if;

  if new.role = 'owner' and new.level <> 'full' then
    raise exception 'The owner role keeps full access to every section.';
  end if;
  return new;
end;
$$;

create trigger staff_permissions_guard_owner
  before insert or update or delete on staff_permissions
  for each row execute function guard_owner_permissions();

-- Read is for any signed-in staff member: the rail has to know what to render.
-- Writing is the owner's alone, which is narrower than the blanket staff_all
-- policy the other tables carry.
alter table staff_permissions enable row level security;

create or replace function is_staff_owner(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from staff_roles where user_id = uid and role = 'owner');
$$;

create policy staff_read_permissions on staff_permissions
  for select to authenticated using (is_staff());

create policy owner_writes_permissions on staff_permissions
  for all to authenticated using (is_staff_owner()) with check (is_staff_owner());

-- Defaults ------------------------------------------------------------------
-- Money to finance, delivery to ops, the library to content, and the two screens
-- that can change who has access at all to nobody but the owner.
insert into staff_permissions (role, section, level) values
  ('owner','today','full'),        ('ops','today','full'),        ('content','today','full'),  ('finance','today','full'),
  ('owner','journal','full'),      ('ops','journal','full'),      ('content','journal','view'),('finance','journal','none'),
  ('owner','orders','full'),       ('ops','orders','view'),       ('content','orders','none'), ('finance','orders','full'),
  ('owner','subscriptions','full'),('ops','subscriptions','view'),('content','subscriptions','none'),('finance','subscriptions','full'),
  ('owner','clients','full'),      ('ops','clients','full'),      ('content','clients','view'),('finance','clients','view'),
  ('owner','packages','full'),     ('ops','packages','none'),     ('content','packages','none'),('finance','packages','view'),
  ('owner','coupons','full'),      ('ops','coupons','none'),      ('content','coupons','none'),('finance','coupons','full'),
  ('owner','links','full'),        ('ops','links','full'),        ('content','links','view'),  ('finance','links','none'),
  ('owner','batches','full'),      ('ops','batches','full'),      ('content','batches','full'),('finance','batches','none'),
  ('owner','review','full'),       ('ops','review','full'),       ('content','review','full'), ('finance','review','none'),
  ('owner','publishing','full'),   ('ops','publishing','full'),   ('content','publishing','view'),('finance','publishing','none'),
  ('owner','library','full'),      ('ops','library','view'),      ('content','library','full'),('finance','library','none'),
  ('owner','people','full'),       ('ops','people','none'),       ('content','people','none'), ('finance','people','none'),
  ('owner','settings','full'),     ('ops','settings','none'),     ('content','settings','none'),('finance','settings','none')
on conflict (role, section) do nothing;
