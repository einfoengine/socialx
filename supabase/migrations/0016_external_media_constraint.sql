-- External assets need a URL, the same as HighLevel ones. Separate migration
-- because the enum value has to be committed before a constraint can name it.
alter table assets drop constraint if exists provider_shape;

alter table assets add constraint provider_shape check (
  (provider = 'highlevel' and url is not null) or
  (provider = 'external'  and url is not null) or
  (provider = 'supabase'  and bucket is not null and path is not null)
);
