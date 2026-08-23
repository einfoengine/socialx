# socialX portal :: database

Run order matters. Migrations reference types and tables defined by earlier files.

## First time setup

1. Create a Supabase project. Note the project ref.
2. Run every file in `migrations/` in filename order, in the SQL editor.
3. Run `seed/0001_catalog.sql`. It asserts the pricing is correct and fails loudly if not.
4. Run both files in `tests/`. Both roll back; neither leaves data behind.
5. Make yourself staff:

```sql
-- after signing in once at /login so an auth user exists
insert into staff_roles (user_id, role)
select id, 'owner' from profiles where email = 'shariful@vidiosa.com';
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
  terms of work already in production.
