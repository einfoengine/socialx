-- socialX portal :: buyer details from checkout
--
-- Checkout now collects name, email, company and phone, all required, and the
-- client account is created from exactly those. Storing the person separately
-- from the company matters: the organization is "FlowStack Pro", the human who
-- pays and approves is "Nathan Cole", and support needs both.

alter table organizations add column if not exists owner_name  text;
alter table organizations add column if not exists owner_phone text;

comment on column organizations.owner_name is
  'The person who bought, as given at checkout. The company name lives in organizations.name.';
comment on column organizations.owner_phone is
  'Collected at checkout so delivery can reach a client without digging through Stripe.';

alter table profiles add column if not exists phone text;
