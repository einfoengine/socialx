-- socialX portal :: a third media provider
--
-- Assets referenced by URL that socialX neither uploaded to HighLevel nor stores
-- in Supabase. Demo and sample imagery served from the marketing site is the case
-- that forced it.
--
-- Filing those as 'highlevel' would have been convenient and wrong: the nightly
-- link checker treats a HighLevel asset as something with a file behind it in a
-- location socialX controls, and would eventually flag or try to repair rows that
-- were never HighLevel's to begin with. A provider field that lies is worse than
-- one more enum value.
--
-- The value is added here and used from the next transaction onward; Postgres
-- will not let a new enum value be used in the transaction that created it.

alter type media_provider add value if not exists 'external';
