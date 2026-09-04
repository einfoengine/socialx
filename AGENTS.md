<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Note `middleware` is now `proxy`: the file is `proxy.ts` and it exports `proxy`.
<!-- END:nextjs-agent-rules -->

# Two projects, not a monorepo

```
portal/    the product. Client portal, operator console, /api/v1.
site/      socialX's own marketing website. A consumer of the portal's API.
```

They are independent. Separate `package.json`, separate `node_modules`, separate
`pnpm install`, no shared code, no workspace, no root `package.json`. `node_modules`
exists only inside each project, so run every command from inside the one you are
working on.

**Never add an import that crosses between them.** If the site needs something
from the portal, it goes over `/api/v1` through `site/lib/platform.ts`. That
boundary is the reason the portal can be installed by somebody who never wants
the marketing site, and the reason the site can be replaced by a customer's own.

Package manager is **pnpm**.

# The database

**PostgreSQL 13 or later. Only PostgreSQL, and this is not negotiable.**

Any *host* works, which is the part that matters: Supabase, DigitalOcean, RDS,
Neon, Railway, a container, localhost. Any *engine* does not. The schema uses
57 row level security policies, 30 server-side functions, 19 enum types, 18
triggers, array columns, partial indexes and `returning`. MySQL has no row level
security at all, and RLS is not a detail here: it is the entire authorization
model, the thing that makes a forgotten scope return zero rows instead of every
tenant's data.

Supporting a second engine would mean reimplementing that authorization in
application code across every query, which is exactly what portable RLS was
built to avoid. Do not add a dialect abstraction.

`portal/db/`, applied by `portal/scripts/db.mjs` over a plain `pg` connection.
The Supabase CLI is not used.

The directory was called `supabase/` historically. That was only ever a naming
convention borrowed from that CLI, and the SQL inside is portable: `0000_bootstrap.sql`
supplies `auth.users`, `auth.uid()` and the PostgREST role names when they are
absent, so every migration written against Supabase applies unchanged to a stock
Postgres.

Migrations are numbered and tracked in `schema_migrations` by filename. Never
edit one that has already applied. Add a new one.

# Two things that will bite

**Row level security is the authorization boundary, and it depends on the actor
being set.** `lib/core/db/actor.ts` sets `portal.actor` transaction-locally on
every query that should be scoped to somebody. A query run outside `asActor()`
returns zero rows rather than every row, so a forgotten wrapper looks like an
empty screen, not a leak. Use `asSystem(reason, ...)` for work with no user
behind it, and write a real reason.

**The application must connect as `portal_app`.** Postgres exempts superusers and
table owners from every policy, silently. A `postgres` connection string means
every tenant reads every other tenant while the app appears to work perfectly.

# Migration in progress

The portal is being moved off Supabase. Both paths reach the same database, so
this is incremental and the app works throughout.

- Done: config, connection pool, SQL layer, portable RLS, local auth schema.
- Not done: ~320 queries still use `supabase.from()`, auth is still GoTrue,
  storage is still a Supabase bucket.

New code should use `lib/core/db` (`sql`, `one`, `execute`, `tx`) and wrap reads
in `asActor`. Do not add new `supabase.from()` call sites.

# Writing

`docs/PLATFORM-CONTEXT.md` holds the product context and the copy rules. The one
that catches everybody: **no em-dashes, en-dashes, middots or ellipsis characters**
in any asset, including code comments.
