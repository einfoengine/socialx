# socialX

Two independent Next.js projects in one repository.

```
portal/    the client portal and operator console. This is the product.
site/      the marketing website. One example of a site that integrates with it.
docs/      working context, shared by both.
```

Neither project imports the other. They share no code, no build, and no
`node_modules`. What connects them is HTTP: the site reads content, pricing and
its own brand from the portal's `/api/v1` with a scoped API key, exactly the way
any other customer's website would. That is deliberate, and it is what makes the
site disposable and the portal installable on its own.

## The portal

A client portal sold as software other people deploy. It runs on **any
PostgreSQL 13 or later** and on nothing else: Supabase, DigitalOcean, RDS, Neon,
Railway, or a container on the same host.

The engine requirement is deliberate. The portal's authorization model is
Postgres row level security, so tenant isolation is enforced by the database
rather than by application code. MySQL has no equivalent, and supporting one
would mean giving that up. Any Postgres host is fine; another engine is not.

```bash
cd portal
pnpm install
cp .env.example .env.local     # then fill it in
pnpm db:migrate                # applies db/migrations in order
pnpm dev                       # http://localhost:3001
```

The first boot with no owner account prints a setup token and an administrator
password to the terminal. Both are shown once and the password must be changed
at first sign in.

### Database

`portal/db/` holds the migrations, seed data and tests. Plain SQL, applied in
filename order by `scripts/db.mjs` over a `pg` connection. The Supabase CLI is
not used and is not required.

```bash
pnpm db:migrate    # migrations, tracked in schema_migrations
pnpm db:seed       # catalogue and pricing, asserts the numbers
pnpm db:test       # each file rolls itself back
pnpm db:status     # what has been applied
```

Connect as `portal_app`, never as a superuser. Postgres exempts superusers from
row level security silently, which disables tenant isolation with no error
anywhere. `rlsWeakness()` in `lib/core/db/actor.ts` checks for this and the setup
screen refuses to go green without it.

### Where things are

```
portal/
  app/            routes: /admin, /portal, /api/v1, /api/internal, auth
  components/     shared UI for both portals
  db/             migrations, seed, tests
  lib/
    core/         config, db (sql, pool, actor), auth, sites, stripe, webhooks
    dal/          the authorization boundary: session, permissions, scoped reads
    api/          the /api/v1 front door: keys, scopes, auth
  scripts/        db.mjs, seeding, key minting, integration tests
  proxy.ts        cookie refresh and the optimistic redirect
```

## The site

```bash
cd site
pnpm install
cp .env.example .env.local     # then fill it in
pnpm dev                       # http://localhost:3000
```

It holds no database credentials and no Stripe secret key. Everything it renders
comes from the portal over the API, with a built-in fallback for every value so
the marketing site keeps serving when the portal is unreachable.

## Conventions

Package manager is **pnpm**, not npm. Each project installs separately: there is
no workspace and no root `package.json`.

Read `AGENTS.md` before writing code. This is Next.js 16, where the file
conventions and several APIs differ from older training data, and `middleware`
has been renamed to `proxy`.

`docs/PLATFORM-CONTEXT.md` carries the product context: what socialX sells, to
whom, the locked pricing, and the copy rules that apply to anything customer
facing.
