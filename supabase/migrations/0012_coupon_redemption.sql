-- Counting a redemption.
--
-- A function rather than a read-then-write from the app, so two checkouts
-- starting at the same moment cannot both read the same count and each write
-- back the same increment. On a coupon with a redemption cap that is the
-- difference between honouring the cap and quietly exceeding it.
create or replace function increment_coupon_redemption(coupon_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update coupons set times_redeemed = times_redeemed + 1 where id = coupon_id;
$$;
