# Portal database

Plain PostgreSQL. Nothing here needs Supabase, and nothing here is run by the
Supabase CLI: `scripts/db.mjs` connects with `pg` over a connection string and
applies these files in filename order.

The directory was called `supabase/` for most of this project's life, which was
only ever a naming convention borrowed from that CLI. It is `db/` now, and it
lives inside the app that owns it.

Run order matters. Migrations reference types and tables defined by earlier files.

## First time setup

Point `DATABASE_URL` at any Postgres 13 or later, then:

```bash
pnpm db:migrate    # every file in migrations/, in order, tracked in schema_migrations
pnpm db:seed       # catalogue and pricing; asserts the numbers and fails loudly if wrong
pnpm db:test       # both files in tests/; each rolls itself back
```

`0000_bootstrap.sql` supplies the `auth` schema, `auth.uid()` and the PostgREST
role names when they are absent, which is what lets every migration written
against Supabase apply unchanged to a stock Postgres. On Supabase it does
nothing.

The application should connect as `portal_app`, created by
`0031_portable_rls.sql`, and **not** as a superuser. Postgres exempts superusers
from row level security silently, so a `postgres` connection string disables
tenant isolation with no error anywhere. `rlsWeakness()` in
`lib/core/db/actor.ts` checks for this.

```sql
alter role portal_app with login password '...';
```

## Files

| File | What it creates |
|---|---|
| `0001_enums.sql` | Every status type the system can hold |
| `0002_identity.sql` | organizations, profiles, memberships, staff_roles, auth triggers |
| `0003_catalog_billing.sql` | plans, entitlements, prices, subscriptions, invoices, stripe_events |
| `0004_media_brand.sql` | assets (hybrid HighLevel and Supabase), brand profile, platforms, HL connections |
| `0005_library.sql` | pillars, HL features, templates, versions, tags, variants |
| `0006_delivery.sql` | batches, posts, revisions, comments, publish jobs, and the enforcement triggers |
| `0007_ops.sql` | activity log, notifications |
| `0008_rls.sql` | Row level security across all 30 tables |
| `seed/0001_catalog.sql` | The locked tier contract: $197 / $397 / $597, both rate cards, 24 prices |
| `tests/rls_cross_org.sql` | Proves a client cannot read another org, or the library |
| `tests/revision_rounds.sql` | Proves the revision ceiling holds, and that NULL means unlimited |

## Things worth knowing before editing

- **`revision_rounds` NULL means unlimited.** Scale is contractually unlimited, and a
  large integer would be a lie that eventually surfaces in front of a client.
- **Pricing changes happen in the seed, nowhere else.** The seed asserts known values,
  so a drift fails the run instead of quietly charging the wrong amount. Rounding is on
  the dollar figure, not on cents; rounding cents diverges on 18 of the 24 rows.
- **The library has no client policy on purpose.** Clients see their own batch, never
  the templates behind it.
- **Quota is snapshotted onto the batch,** so a mid-cycle plan change cannot rewrite the
  terms of work already in production. That snapshot is what makes the entitlements on
  `/admin/settings/plans` safe to edit.
- **`api_keys` never holds a usable credential.** The column is a SHA-256 of the whole
  token, and the plain secret exists only in the server action response that created it.
  There is no recovery path by design: a lost key is reissued, not retrieved.
- **An empty `allowed_origins` means no browser, not every browser.** Listing a domain is
  what grants browser access to a key, so the permissive state is always one somebody
  chose. `site_content.is_public` works the other way round and is off by default.
- **Rate card windows are editable from the console** as of 0024; the amounts on each card
  are still seed only. Which card applies is configuration, what it charges is the offer.
