# Integration policy and system

How a website integrates with this platform, what it is entitled to once it has,
and what the platform guarantees in return.

This is the contract. Where this document and the code disagree, the code is
right and this file is a bug. Every rule below is enforced somewhere real, and
each one names where.

No em-dashes, en-dashes, middots or ellipsis characters anywhere in this file.

---

## 0. The shape of the thing

The platform is not a website. It is the system behind websites: it holds their
content, sells their plans, provisions their customers, runs their client portal
and tells them when something happens.

A **site** is one website integrated with it. Every request that reaches this
platform belongs to exactly one site, and there are three ways to know which:

| How | Used by | Definitive |
|---|---|---|
| An API key | Server-to-server and browser API calls | Yes. The key belongs to a site |
| The Host header | The hosted portal and its sign-in screen | Yes, for verified hosts |
| The client's organization | A signed-in customer's portal | Yes. The org was sold by a site |

There is no fourth way, and in particular **there is no default site**. A request
whose site cannot be resolved is refused. This is the single most important rule
in this document, because a default would mean serving one customer's brand,
content and credentials on another customer's domain.

Enforced in `apps/console/lib/sites/resolve.ts` and `apps/console/lib/api/auth.ts`.

---

## 1. What a site owns, and what it shares

### Owned, and reachable by nobody else

| Thing | Table | Isolation is enforced by |
|---|---|---|
| Brand, portal host, support and checkout addresses | `sites` | The record itself |
| Verified domains | `site_domains` | `site_id`, plus `verified_at` |
| API credentials | `api_keys.site_id` | Resolved before scopes are read |
| Content entries | `site_content.site_id` | Primary key is `(site_id, key)` |
| Webhook endpoints and their delivery history | `site_webhooks`, `webhook_deliveries` | `site_id` |
| Client organizations, and therefore their orders, batches and approvals | `organizations.site_id` | The column itself |
| Every row descended from a client: subscriptions, invoices, batches, posts, comments, revisions, publish jobs, platform copy, brand profiles, assets, memberships, activity | `site_id` on each, derived by trigger | The column itself |

A credential resolves to its site **before** its scopes are considered relevant.
No scope, no combination of scopes, and no console setting widens a key past the
site it was issued for.

**Every table holding tenant data carries `site_id` directly**, rather than
reaching a site through a join. Fourteen tables gained the column in migration
0027: ten derive it from their organization, four from their parent post or
batch. It is never written by the application. Triggers derive it on the way in
and re-derive every descendant if a client is ever moved between sites, so it is
a stored computed column rather than a field that can drift.

The reason is not performance. A join is a thing you can forget, and a query that
forgets one returns every site's rows without failing, warning, or looking wrong
until the day there are two sites.

### Shared across every site

- **The catalogue.** Plans, entitlements, billing cycles, rate cards and prices.
  Every site resells the same delivery service, so there is one price list and one
  place to change it. A site that needs its own catalogue is a schema change and a
  larger decision than an endpoint.
- **The content library and its templates.** Platform IP.
- **Operator identity.** Staff work across every site by definition.

---

## 2. Integration lifecycle

Seven steps, in order, each genuinely blocked on the one above it. The console
screen at `/admin/sites/{key}` is laid out in this order for that reason.

### 1. Register

An operator creates the site at `/admin/sites`. Name and an optional key. It is
created as **draft**, and a draft site's credentials are refused. Going live is a
decision, not a side effect of typing a name in.

### 2. Configure

On the site record: legal name, the website's own address, the checkout address,
the support address the portal prints, and the brand (wordmark, logos, accents).
Every brand field is optional and every one has a fallback, so a half-configured
site still renders.

### 3. Prove the domains

Add each origin the site will call from or serve its portal on, then verify it.

The platform generates a token per origin. The site publishes it at:

```
https://example.com/.well-known/portal-site-verification.txt
```

The file contains the token, exactly, and nothing else. The platform then fetches
that exact URL, follows no redirect, reads at most 1KB and compares the whole
trimmed body.

**Why HTTP and not a DNS TXT record.** What is being established is control of an
*origin*, not ownership of a *domain*. A browser's `Origin` header carries scheme,
host and port; a TXT record proves something about the host alone and nothing about
whether whoever set it can serve content at that scheme and port. Serving a file at
the exact address being claimed proves the narrower thing that is actually load
bearing, and it fails closed on the case DNS gets wrong most often, which is a
staging host living on somebody else's subdomain.

Verification is not permanent in the sense that matters: clearing `verified_at`
cuts browser access everywhere at once, with no keys to go and edit.

### 4. Issue credentials

On the site record. A key carries:

- a **name**, which should name the thing that holds it and never a person,
- one or more **scopes**,
- zero or more **browser origins**, chosen from the site's verified domains,
- an optional **expiry** in days.

The secret is shown exactly once, in the response that created it. It is stored as
a SHA-256 of the whole token, so a copy of the database yields no working
credential. There is no reveal endpoint, no admin override and no support path.
Losing a key means issuing a new one.

**No origins ticked means server side only.** That is the default and it is the
right answer whenever the calling code has a server to make the request from.

### 5. Wire the events

Add an https endpoint. Choose events, or choose none to receive all of them. The
signing secret is shown once, on creation, and can be rotated.

Send a ping from the console before writing any handler logic. It carries no data
and answers exactly one question: does this endpoint receive and verify a signed
payload.

### 6. Activate

Set the site to **active**. Credentials begin working. Nothing before this point
authenticates.

### 7. Operate

Watch the delivery log on the site record. Rotate keys and secrets on whatever
schedule the site's own policy requires. Suspend the site to stop everything at
once.

---

## 3. The policy, stated as rules

Each rule names where it is enforced, so a claim here can be checked.

**P1. No default site.** A request that resolves to no site is refused with
`site_unresolved`. `lib/api/auth.ts`, `lib/sites/resolve.ts`.

**P2. Only an active site authenticates.** Draft and suspended both refuse every
credential the site holds, immediately and with no cache to wait out. Suspension
is the kill switch. `lib/api/auth.ts`.

**P3. Browser access requires two independent grants.** The origin must be on the
key's allowlist *and* be a verified domain of that site, checked on every request.
Either one alone is insufficient. `lib/api/auth.ts`.

**P3a. Row level security is not the site boundary, and does not pretend to be.**
Client isolation is enforced by RLS through organization membership, and that
holds regardless of application code. Staff hold `is_staff()` and see every site
by design; the API reads with the service role, which has `BYPASSRLS` and skips
every policy in the schema. For those two paths the site filter lives in
application code at one choke point, checked by P14. Saying otherwise would be
describing a policy that is never evaluated.

**P4. CORS is not access control.** An origin that is not permitted is refused
server side with a 403, separately from not being given the CORS header. A browser
discarding a response is a courtesy; curl ignores it. Only the refusal is a
guarantee. `lib/api/auth.ts`.

**P5. A key caller never gets a wildcard CORS grant.** The allowlist is echoed one
origin at a time, with `Vary`, so a shared cache cannot hand one domain's grant to
another. A public caller does get a wildcard, because what it can reach is content
the site deliberately published. `corsHeaders` in `lib/api/auth.ts`.

**P6. Secrets are shown once.** API tokens are stored hashed and never recoverable.
Webhook secrets are stored in the clear because signing requires the material, and
are never selected by any read except the one that signs a delivery.

**P7. https everywhere, except loopback.** Domain verification and webhook
endpoints both refuse plain http outside localhost. Events carry customer email
addresses.

**P8. A private entry answers 404, never 403.** To a caller with no credential, an
unpublished key is indistinguishable from one that was never created. The same
applies across sites: another site's entry is a 404, because the alternative tells
any credential holder which keys exist platform-wide. `app/api/v1/content/[key]`.

**P9. Every event name in the vocabulary is emitted by real code.** An integrator
who filters on an event that never fires has built a feature that silently does
nothing and will blame their own handler for weeks. Adding a name and wiring it are
one change. `apps/console/lib/core/webhooks.ts`.

**P10. Delivery is recorded before it is attempted.** An event emitted while the
network is down is still a row with a retry time. If delivery were attempted first
and recorded after, a lost event would be lost silently, and "we sent it, you missed
it" would be unfalsifiable on both sides.

**P11. A site's data survives its site.** Deleting a site cascades to its domains,
keys, endpoints and content, but `organizations.site_id` is `on delete set null`.
Losing a site must never delete the records of the customers it sold.

**P12. Pricing is not per site.** See section 1. A site cannot set its own prices
through any endpoint or console screen, because there is no such column.

**P13. The console shows one site at a time.** Every screen holding tenant data
filters on the site chosen in the top bar, and there is no "all sites" view. A
list merging two customers is a screen where clicking the wrong row is an
ordinary mistake rather than an impossible one. Clients whose site was deleted
appear under an explicit Unassigned entry, so nothing becomes unreachable.

**P14. A cross-site query has to say so.** `scripts/check-site-scoping.mjs`
(`pnpm check:sites`) reads every access to a site-scoped table in the portal and
fails unless it is narrowed to a site, narrowed to one record, or carries a
`cross-site:` comment giving the reason. Fourteen queries are declared
cross-site today, each one a deliberate decision with its rationale next to it.
The check is not a security boundary and does not claim to be. It is what stops
"did anyone think about this" from being unanswerable.

**P15 and P16** are about billing this platform does not collect, and are stated
in section 6 next to the feed they govern.

---

## 4. The API

Base URL: the portal origin plus `/api/v1`. Versioned in the path. A breaking
change gets `/api/v2`; `/api/v1` is not changed under anyone.

### Authenticating

Either header works. `x-api-key` exists because plenty of no-code tools and webhook
builders can set a named header and cannot set an `Authorization` scheme.

```
Authorization: Bearer sx_live_9f3c1a7b_...
x-api-key: sx_live_9f3c1a7b_...
```

### Calling without a credential

An unauthenticated caller reads only entries the site marked public, and only while
the platform-wide public switch is on. It must name the site, because there is no
default one to guess:

```
X-Site-Key: example-co          preferred
?site=example-co                when a header cannot be set
Origin: https://example.com     resolved through a verified domain
```

### Scopes

| Scope | Grants |
|---|---|
| `content:read` | Read this site's content entries, including unpublished ones |
| `content:write` | Replace an existing entry's JSON. Cannot create, delete, or change what is public |
| `catalog:read` | Read plans, entitlements and prices |
| `orders:read` | Read this site's subscriptions and their status |

### Endpoints

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/me` | any | What the credential is, what it may do, which site it speaks for |
| GET | `/site` | public or `content:read` | Brand, portal address, checkout address, support address |
| GET | `/content` | public or `content:read` | Every readable entry, without bodies |
| GET | `/content/{key}` | public or `content:read` | One entry with its JSON |
| PUT | `/content/{key}` | `content:write` | Replaces an entry's JSON |
| GET | `/catalog` | `catalog:read` | Plans, entitlements, cycles, rate cards, prices in cents |
| GET | `/orders` | `orders:read` | Subscriptions, paged. `limit`, `offset`, `status` |

`GET /me` exists because the first two questions after wiring up a key are always
"is it reaching the right place" and "whose data am I about to get". Point at it
when something is not working.

### Errors

Every failure is `{"error": {"code": "...", "message": "..."}}` with a real status.

| Code | Status | Means |
|---|---|---|
| `invalid_key` | 401 | Not a key, unknown prefix, or wrong secret. One message for all three on purpose |
| `key_revoked` | 401 | Revoked. Issue a new one |
| `key_expired` | 401 | Past its expiry |
| `site_missing` | 401 | The site was deleted |
| `site_inactive` | 403 | Draft or suspended |
| `site_unresolved` | 401 | No credential and no site named |
| `public_api_disabled` | 401 | The platform-wide public switch is off |
| `key_required` | 401 | This endpoint has no anonymous surface |
| `missing_scope` | 403 | The key does not carry the scope this route needs |
| `origin_not_allowed` | 403 | Not on this key's allowlist |
| `origin_not_verified` | 403 | On the key, but the site has not proved it |
| `not_found` | 404 | No such entry for this site. Also what a private entry looks like to a public caller |
| `too_large` | 413 | An entry is capped at 256KB |
| `unavailable` | 503 | The database could not be read or written |

### Examples

```bash
# Public: name the site, since there is no default one.
curl https://portal.example.com/api/v1/content \
  -H "X-Site-Key: example-co"

# With a key, which already knows its site.
curl https://portal.example.com/api/v1/me \
  -H "Authorization: Bearer sx_live_..."

# Write an entry a machine already knows the truth of.
curl -X PUT https://portal.example.com/api/v1/content/homepage-stats \
  -H "Authorization: Bearer sx_live_..." \
  -H "Content-Type: application/json" \
  -d '{"data": {"clients": 42}}'
```

---

## 5. Webhooks

### The envelope

```json
{
  "id": "8f0c...",
  "event": "order.created",
  "created_at": "2026-09-02T11:04:00.000Z",
  "site_id": "3a1e...",
  "data": {}
}
```

### Headers

| Header | Meaning |
|---|---|
| `X-Webhook-Id` | The delivery id. Also `id` in the body. Use it to make your handler idempotent |
| `X-Webhook-Event` | The event name, so a router does not have to parse the body first |
| `X-Webhook-Timestamp` | Unix seconds, the same value signed |
| `X-Webhook-Signature` | `t=<unix>,v1=<hex hmac-sha256>` |

### Verifying

The signature covers `${timestamp}.${raw body}`, not the body alone. A signature
over the body alone is valid forever, so anybody who captures one delivery can
replay it at will. Binding the timestamp in means a receiver can refuse anything
older than its own tolerance and the signature cannot be lifted onto a fresh one.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, header, rawBody, toleranceSeconds = 300) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );

  const t = Number(parts.t);
  if (!Number.isFinite(t)) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if (expected.length !== parts.v1.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
```

Three rules for a receiver:

1. Verify against the **raw body**, byte for byte. Re-serializing parsed JSON
   changes the bytes and every signature fails.
2. Compare in **constant time**. A plain `===` leaks how many characters matched.
3. Answer **2xx quickly** and do the work afterwards. The platform waits 10 seconds
   and then calls it a failure.

### The vocabulary

| Event | Fires when |
|---|---|
| `ping` | An operator sends one from the console. Carries no data |
| `site.updated` | Brand, portal host, support address, checkout address or status changed |
| `content.updated` | An entry was written, from the console or through the API |
| `order.created` | A subscription was paid for and provisioned |
| `subscription.updated` | An existing subscription changed status, period or cancellation state |

An endpoint with no events selected receives all of them, which is the default a new
endpoint is created with.

### Retries

Delivery is attempted immediately, inside `after()`, on the request that emitted the
event, so a healthy endpoint hears within a second. A failure is retried on a
widening schedule:

```
1 minute, 5 minutes, 25 minutes, 2 hours, 10 hours, then dead
```

Five retries over roughly twelve hours. The shape matches the two failures that
actually happen: a deploy, which is over in a minute, and an outage, which is not
over in an hour. Running off the end marks the delivery **dead**; the row stays and
can be sent again by hand from the console.

An endpoint that fails **20 times in a row** is switched off automatically, with the
reason recorded. That is not a punishment: it is generating retries forever at the
platform's expense and telling nobody anything. Re-enabling it clears the counter.

### Retries need a scheduler

The inline attempt covers the healthy case. Retries only happen if something calls
the drain:

```
GET|POST /api/internal/webhooks/drain
Authorization: Bearer $CRON_SECRET
```

Point a scheduler at it every five minutes. **Without `CRON_SECRET` set the endpoint
refuses every request**, which means retries silently stop, so treat it as required
configuration rather than optional. It is not part of the integration surface, is not
versioned, and no API key opens it.

---

## 6. Billing this platform does not collect

A site does not have to sell through this platform's processor. It can take the
money itself, with whatever it already uses, and still give its clients a portal
that shows their plan, their renewal date and their invoices.

Set on the site record: **Payments**, either "This platform collects" or "The
site collects". The platform-wide switch that permits the second is
`billing.external_collection` under Settings, Payments, and both must say yes,
the same AND that governs order sources.

### The feed

A site that collects publishes one JSON document. This platform fetches it
hourly and whenever an operator presses Fetch now, with the header and value
configured on the site record, and it refuses redirects because the request
carries that value.

```json
{
  "subscriptions": [
    {
      "id": "sub_9f21",
      "client_email": "nathan@flowstackpro.com",
      "plan": "growth",
      "cycle": "monthly",
      "status": "active",
      "amount": 39700,
      "currency": "usd",
      "current_period_start": "2026-09-01T00:00:00Z",
      "current_period_end": "2026-10-01T00:00:00Z",
      "cancel_at_period_end": false,
      "manage_url": "https://billing.example.com/s/9f21"
    }
  ],
  "invoices": [
    {
      "id": "in_4410",
      "client_email": "nathan@flowstackpro.com",
      "number": "INV-4410",
      "amount_paid": 39700,
      "currency": "usd",
      "status": "paid",
      "issued_at": "2026-09-01T09:12:00Z",
      "url": "https://billing.example.com/i/4410"
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Your identifier for the row. What the next fetch updates rather than duplicates |
| `client_email` or `org_id` | Yes | Matched only against organizations this site sold |
| `plan`, `cycle` | Subscriptions | Keys from the shared catalogue, as `GET /catalog` returns them |
| `status` | Subscriptions | active, trialing, past_due, paused, canceled, incomplete. Common synonyms are accepted; anything else is refused rather than guessed at |
| `amount` | No | Cents per cycle, as you charge. This is what the portal prints. Without it the portal falls back to the catalogue price, which is probably not yours |
| `manage_url` | No | Where this client changes their card. Falls back to the site's own management address |
| `url`, `pdf_url` | No | https only. Rendered as links in the client's portal |

Both keys are optional, so a site with nothing billed yet answers `{}` and that
is a successful fetch rather than a failure.

### What the platform does with it

- Rows land in `subscriptions` and `invoices` tagged `source = 'external'`, so
  the portal, the subscriptions list and the MRR total read one shape.
- A row it cannot use is skipped, counted and named on the site record: an
  unknown plan, an unreadable status, an email belonging to no client of this
  site. It is never guessed at, because every guess here is somebody's bill.
- **It never deletes.** A subscription that stops appearing is far more often a
  partial response than a cancellation. Cancellation is a status you state.
- **It never writes to a platform row**, and the payment webhook never writes to
  an imported one. A client who already has a platform subscription is skipped
  rather than overwritten.
- Every fetch is recorded before it is attempted, successful or not, with its
  status code and counts. Same reasoning as P10.

### What the client sees

Their plan, price, renewal date and invoices, as read-only facts, with a link to
the site's own management address instead of a card form, and how long ago the
figures were fetched. Nothing on that screen charges anybody or cancels anybody:
this platform is not in the payment path and does not pretend to be.

**P15. Imported billing is never presented as live.** Every imported row carries
`synced_at`, the portal prints its age, and anything older than
`billing.feed_max_age_hours` says so in the client's own words. A copy shown as
if it were the source is how somebody who paid yesterday is told they are past
due. `lib/billing/external.ts`, `app/portal/billing`.

**P16. Turning the switch off stops fetching, not the truth.** Rows already
imported keep reading as external, because that is where the client's money
actually goes and a billing screen that changed its story with a platform setting
would be lying to them. `lib/billing/external.ts`.

### The schedule

```
GET|POST /api/internal/billing/sync
Authorization: Bearer $CRON_SECRET
```

Hourly. The same secret as the webhook drain, and the same posture: not
versioned, not part of the integration surface, no API key opens it. Without a
scheduler pointed at it the feature still works, one Fetch now at a time, which
means billing is only ever as fresh as the last person who pressed the button.

---

## 7. The hosted portal

A site's customers sign in on the site's own domain, and see the site's brand.

1. The site points a host at this platform in DNS, for example
   `portal.example.com`.
2. An operator sets that hostname as **Portal host** on the site record. It is
   unique across the platform: a host cannot serve two brands.
3. Requests arriving on it resolve to that site before any page renders, and the
   sign-in screen and portal chrome wear its wordmark, logo and accents.

A second host, a vanity domain or a staging one, is added as a `site_domains` row
with purpose `portal` and must be verified the same way.

On a shared host that belongs to no single site, the portal falls back to the brand
of the site that sold the signed-in client, and the sign-in screen, which has no
client yet, renders the neutral mark with no links out. Sending a visitor to one
customer's website from a screen that could belong to any of them is worse than
sending them nowhere.

---

## 8. Configuration

| Variable | Where | Required for |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Both apps | Everything server side |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Both apps | Sessions |
| `NEXT_PUBLIC_PORTAL_URL` | Both apps | Absolute links into the portal |
| `CRON_SECRET` | Console | Webhook retries. Unset means no retries |
| `PORTAL_SITE_KEY` | A website reading content directly from the database | Naming which site it is |

`PORTAL_SITE_KEY` is deliberately not defaulted. A wrong value renders another
company's copy on this domain; a missing one renders the built-in fallbacks, which
is the safe failure.

---

## 9. What this platform does not promise

Stated plainly, because an integration built on an assumption that was never true is
worse than one built on a documented limit.

- **No rate limits are enforced today.** Do not read that as permission to poll every
  second. Limits will arrive, and the first sites to feel them will be the ones that
  did.
- **No overlap window on webhook secret rotation.** The old secret stops working
  immediately. Rotation is a coordinated change.
- **No guaranteed event ordering.** Deliveries retry independently, so a retried
  `order.created` can arrive after the `subscription.updated` that followed it. Use
  `created_at` in the envelope, and make handlers idempotent on `id`.
- **No at-most-once delivery.** A 2xx that the platform never received is retried.
  Idempotency is the receiver's job, and `X-Webhook-Id` is what it is for.
- **No reconciliation of imported billing.** What a feed says is what the portal
  shows. This platform does not check it against anything, cannot refund or charge
  through it, and will not notice a figure that is wrong, only one that is old.
- **No backfill of events.** An endpoint added tomorrow starts from tomorrow. Use
  `GET /orders` for state that already exists, and events for the delta. An
  integration with only one of the two ends up reconstructing the other badly.

---

## 10. Where this lives in the code

| Concern | File |
|---|---|
| Schema, the registry | `apps/console/db/migrations/0026_sites.sql` |
| Schema, the site column everywhere | `apps/console/db/migrations/0027_site_scoping.sql` |
| The single site filter for staff and API reads | `apps/console/lib/dal/scoped.ts` |
| The check that nothing skips it | `scripts/check-site-scoping.mjs` |
| The site record and brand parsing | `apps/console/lib/core/sites.ts` |
| Signing, emitting, delivering, retrying | `apps/console/lib/core/webhooks.ts` |
| Resolving a site from a key, host, origin or org | `apps/console/lib/sites/resolve.ts` |
| Authentication and CORS | `apps/console/lib/api/auth.ts` |
| The scope vocabulary | `apps/console/lib/api/scopes.ts` |
| Endpoints | `apps/console/app/api/v1/` |
| The retry drain | `apps/console/app/api/internal/webhooks/drain/` |
| Console screens | `apps/console/app/admin/sites/` |
| Which site the console is showing | `apps/console/lib/sites/admin.ts` |
| Who collects, and importing what they collected | `apps/console/lib/billing/external.ts` |
| The payment vocabulary both apps share | `apps/console/lib/core/payments.ts` |
| Schema, payments and the sync log | `apps/console/db/migrations/0030_payments.sql` |
| End to end check | `scripts/test-integration.mjs` |
