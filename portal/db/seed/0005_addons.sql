-- socialX portal :: add-on catalog
--
-- PRICE NEEDS SHARIFUL'S SIGN-OFF. $97 is a placeholder chosen to sit under half
-- the entry tier so it reads as an extra rather than a second decision. Change
-- the amount here, run pnpm stripe:sync, and it is live.

insert into addons (key, name, description, amount, applies_to_plans, sort)
values (
  'rush_first_batch',
  'Rush your first batch',
  'Skip the queue and get your first batch in 3 days instead of 7. Useful if you are launching, running ads, or have demos booked this week.',
  9700,
  array['starter','growth'],
  1
)
on conflict (key) do update set
  name        = excluded.name,
  description = excluded.description,
  amount      = excluded.amount,
  applies_to_plans = excluded.applies_to_plans;

do $$
declare n int;
begin
  select count(*) into n from addons where is_active;
  if n < 1 then raise exception 'No active add-ons seeded'; end if;
end $$;
