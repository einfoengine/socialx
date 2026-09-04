# Wiring a website to the platform

How an integrating website talks to this platform, and what changed when socialX's
own website became one.

**This file follows socialX copy rules.** No em-dashes, no en-dashes, no middots, no
ellipsis characters. Keep it that way when editing.

---

## 1. The shape

Two applications, one door between them.

```
site/                               portal                          Postgres
(any integrating website)            (the platform)
                                                                    
  reads its own copy    ---------->  GET  /api/v1/content/{key}  --->  site_content
  renders a price list  ---------->  GET  /api/v1/catalog        --->  plans, prices
  prices a basket       ---------->  POST /api/v1/checkout/quote --->  coupons, addons
  creates an order      ---------->  POST /api/v1/checkout/subscribe -> Stripe + orders
                                                                    
                        Authorization: Bearer sx_live_...
```

The website holds one credential: an API key scoped to one site. It holds no
database credential, no service role key, and no Stripe secret key. It cannot read
another site's data, cannot bypass row level security, and cannot charge anybody
except through an endpoint that decides the price itself.

**Before this, socialX's own site held `SUPABASE_SERVICE_ROLE_KEY`.** That key has
BYPASSRLS and skips every policy in the schema. A marketing site was carrying it in
order to read published copy. It is gone from that application now.

---

## 2. What moved

| Was | Is now |
|---|---|
| `site/lib/content.ts` querying `site_content` | Same file, calling `GET /api/v1/content/{key}` |
| `apps/site/lib/billing/resolve.ts` | `portal      /lib/billing/resolve.ts` |
| `apps/site/lib/billing/provision.ts` | `portal      /lib/billing/provision.ts` |
| `apps/site/lib/billing/checkout.ts` | Deleted. Dead code: the embedded checkout replaced the Stripe Checkout Session flow and nothing imported it. |
| `apps/site/app/api/webhooks/stripe` | `portal      /app/api/webhooks/stripe` |
| `apps/site/app/api/checkout/preview` resolving prices itself | Same route, forwarding to `/api/v1/checkout/quote` |
| `apps/site/app/api/checkout/create-subscription` talking to Stripe | Same route, forwarding to `/api/v1/checkout/subscribe` |
| Checkout page running four direct queries | One `GET /api/v1/catalog?plan=` plus one quote |

The two site-side `/api/checkout/*` routes still exist, and that is deliberate.
The browser must not hold an API key, so it calls its own origin and this server
forwards with the key. Those routes own no pricing logic any more.

---

## 3. New scopes

Added to `portal      /lib/api/scopes.ts`:

| Scope | Grants |
|---|---|
| `checkout:quote` | Price a basket, including validating a coupon code. |
| `checkout:write` | Create a subscription and get back a client secret. |

Neither is reachable by a public caller. `checkout:quote` is not public because an
endpoint that says whether a code is real is a coupon oracle: left open, a script
walks guessable strings and comes away with every live discount on the platform.

A selling website wants exactly four scopes:

```
content:read, catalog:read, checkout:quote, checkout:write
```

Deliberately not `content:write`. A website renders its copy. The console edits it.

---

## 4. Setting it up

### Mint a key

```bash
pnpm key:mint <site-key> --name "socialX website"
```

Defaults to the four scopes above. The secret prints once and is never
recoverable: the platform stores only a SHA-256 of the whole token. The console at
`/admin/sites` does the same job with a form, and is the right tool for cutting a
key for somebody else. The script exists for the first key, because a credential
that can only be minted by signing into an application that is not running yet is
a bootstrap problem.

### Environment

`apps/site/.env.local`:

```
PORTAL_API_URL=https://portal.socialx.studio    # falls back to NEXT_PUBLIC_PORTAL_URL
PORTAL_API_KEY=sx_live_...                      # from the mint step
PORTAL_SITE_KEY=socialx                         # public read fallback only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # public by design
```

**Remove from `apps/site/.env.local`:** `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`. Nothing in that application reads them any more.

**Add to `portal      /.env.local`:** `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`, which the console now needs because provisioning lives
there.

### Repoint the Stripe webhook

This is the one step that is not code and cannot be skipped. In the Stripe
dashboard, change the endpoint from the website's origin to the console's:

```
was   https://socialx.studio/api/webhooks/stripe
now   https://portal.socialx.studio/api/webhooks/stripe
```

Until this is done, a paid checkout will never provision an account. The signing
secret does not change.

---

## 5. One behaviour that genuinely improved

Provisioning used to read `PORTAL_SITE_KEY` from the environment to decide which
site sold a client. That was correct while provisioning lived inside a single
website's deployment. It is wrong in the console, which serves every site: an
environment variable there would stamp every order from every website with
whichever site that process happened to be configured for.

`POST /api/v1/checkout/subscribe` now writes `site_key` into the Stripe
subscription metadata, taken from the authenticated key rather than from the
request body, so one site's credential cannot provision clients onto another's
books. It travels through Stripe and comes back on the webhook, which is the only
moment provisioning can still learn it. The environment variable is kept as a
fallback for orders created before this moved and for subscriptions made by hand
in the Stripe dashboard.

---

## 6. Failure behaviour

| When | What happens |
|---|---|
| Platform unreachable, content read | `contentOr` returns the page's built-in default. A marketing site is a live business asset and keeps serving. |
| Platform unreachable, checkout page | Redirects to `/#gw-pricing`. There is nothing useful a buyer can do on a checkout screen that cannot name a price. |
| Platform unreachable, subscribe | The buyer is told nothing has been charged, which is guaranteed: a subscription that was never confirmed never bills. |
| Key revoked, expired, or its site suspended | 401 or 403 from `authenticate`, before any logic runs. Suspending a site is a real kill switch. |
| Rate limited | 429 with `Retry-After`. Budgets are layered: a general volume budget per key in `authenticate`, plus stricter per-endpoint budgets on coupon codes and per buyer email. |

Every call carries a timeout: 6 seconds by default, 25 for `subscribe`, which is
two or three Stripe round trips behind one request.

---

## 7. Testing it

```bash
pnpm dev                # both apps: site on 3000, console on 3001
pnpm test:api           # the /api/v1 surface
pnpm test:integration   # site registry, keys, origins
pnpm test:embedded      # the checkout path, now end to end through both apps
pnpm test:webhook       # posts a signed event at the console
```

`test:embedded` hits the website's own `/api/checkout/*` routes, so it now
exercises the whole chain: browser to website to platform to Stripe. It needs both
dev servers running, where it used to need one.
