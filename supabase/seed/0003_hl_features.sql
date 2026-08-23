-- socialX portal :: HighLevel feature taxonomy
--
-- The independent tagging axis that crosses every content pillar. When HighLevel
-- ships a change to a feature, one query finds every affected template and a second
-- finds every client post built from those versions.
--
-- Starting set of 27, matching the Phase 1 library scope. Salman owns this list:
-- verify against the current HighLevel feature set and adjust in the admin screen
-- at /admin/library/features rather than editing this file after first run.

insert into hl_features (name, slug, status) values
  ('Social Planner',              'social-planner',        'active'),
  ('Missed Call Text Back',       'missed-call-text-back', 'active'),
  ('Reputation Management',       'reputation-management', 'active'),
  ('Conversation AI',             'conversation-ai',       'active'),
  ('Voice AI',                    'voice-ai',              'active'),
  ('Workflows',                   'workflows',             'active'),
  ('Pipelines and Opportunities', 'pipelines',             'active'),
  ('Calendars and Booking',       'calendars',             'active'),
  ('Funnels and Websites',        'funnels-websites',      'active'),
  ('Forms and Surveys',           'forms-surveys',         'active'),
  ('Email Marketing',             'email-marketing',       'active'),
  ('SMS Marketing',               'sms-marketing',         'active'),
  ('Payments and Invoicing',      'payments-invoicing',    'active'),
  ('Memberships and Courses',     'memberships-courses',   'active'),
  ('Communities',                 'communities',           'active'),
  ('Blogs',                       'blogs',                 'active'),
  ('Affiliate Manager',           'affiliate-manager',     'active'),
  ('Reporting and Dashboards',    'reporting',             'active'),
  ('Snapshots',                   'snapshots',             'active'),
  ('SaaS Mode and Rebilling',     'saas-mode',             'active'),
  ('WhatsApp',                    'whatsapp',              'active'),
  ('Proposals and Estimates',     'proposals-estimates',   'active'),
  ('Documents and Contracts',     'documents-contracts',   'active'),
  ('Mobile App',                  'mobile-app',            'active'),
  ('Custom Objects',              'custom-objects',        'active'),
  ('Ad Manager',                  'ad-manager',            'active'),
  ('White Label App Builder',     'white-label-app',       'active')
on conflict (slug) do update set name = excluded.name;

do $$
declare n int;
begin
  select count(*) into n from hl_features where parent_id is null;
  if n < 27 then
    raise exception 'Expected at least 27 top level HighLevel features, found %', n;
  end if;
end $$;
