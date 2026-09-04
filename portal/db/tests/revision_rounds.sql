-- socialX portal :: R0 :: revision round enforcement
--
-- The single edge that carries the commercial difference between the tiers.
-- Starter gets 1 round, Growth 2, Scale unlimited (NULL, not a large number).

begin;

do $$
declare
  org_x   uuid;
  b_ltd   uuid;
  b_unltd uuid;
  failed  boolean := false;
begin
  insert into organizations (name, slug, status)
    values ('Round Test','round-test','active') returning id into org_x;

  -- Growth-shaped batch: 2 rounds allowed.
  insert into batches (org_id, period_start, period_end, quota_posts, quota_platforms, revision_rounds_allowed)
    values (org_x, date '2026-09-01', date '2026-09-30', 16, 3, 2) returning id into b_ltd;

  insert into revisions (batch_id, round, note) values (b_ltd, null, 'first');
  update batches set revision_rounds_used = 1 where id = b_ltd;

  insert into revisions (batch_id, round, note) values (b_ltd, null, 'second');
  update batches set revision_rounds_used = 2 where id = b_ltd;

  -- Third must be refused.
  begin
    insert into revisions (batch_id, round, note) values (b_ltd, null, 'third');
    failed := true;
  exception when others then
    raise notice 'PASS: third revision refused on a 2-round plan.';
  end;

  if failed then
    raise exception 'FAIL: a third revision was accepted on a 2-round plan.';
  end if;

  -- Scale-shaped batch: NULL means unlimited.
  insert into batches (org_id, period_start, period_end, quota_posts, quota_platforms, revision_rounds_allowed)
    values (org_x, date '2026-10-01', date '2026-10-31', 24, 4, null) returning id into b_unltd;

  for i in 1..5 loop
    insert into revisions (batch_id, round, note) values (b_unltd, null, 'round ' || i);
    update batches set revision_rounds_used = i where id = b_unltd;
  end loop;

  raise notice 'PASS: unlimited plan accepted 5 rounds without complaint.';
end $$;

rollback;
