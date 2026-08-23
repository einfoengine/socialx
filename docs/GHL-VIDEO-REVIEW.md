# What socialX should take from GHL Video

A review of `vidmshariful/ghl-video` (ghl-video-2.0) against the socialX portal, and
what is worth building here. Written 2026-08-23 on branch `portal-work`.

Not a copy list. GHL Video sells bespoke video production; socialX sells a productized
content subscription. Some of what works there would actively damage the socialX model,
and section 5 says which.

No em-dashes, per socialX copy rules.

---

## 1. What that codebase is

Same stack as socialX: Next.js 16 with `proxy.ts`, React 19, Supabase, Stripe, Tailwind v4.
Considerably further along: 77 migrations, roughly 40 admin screens, 16 client portal
sections, a partner portal, a public site with blog and landing pages, Playwright end to
end tests, and eight custom check scripts wired into a prebuild gate.

The thing worth studying is not the feature count. It is that the reasoning is written
down beside the code, and that several rules are enforced by scripts rather than by
memory. `lib/alarm.ts` opens by explaining that raising an alarm must never break the
thing that raised it. `check-leaks.ts` explains why an allowlist beats a budget. That is
the transferable part.

---

## 2. Take these, adapted

Ranked by what socialX gains, not by build size.

### 2.1 Notifications and transactional email, written at the same points

**There:** `lib/email/notify.ts` and `lib/notifications.ts` are called together at every
business event, so the in-portal bell always matches the inbox. Templates live in the
database with code defaults as fallback. Per-user email preferences. An email log.
Everything fail-soft: an email problem is logged and swallowed, never breaking the money
path. Chat messages deliberately do not create bell rows, so business events are not
buried under conversation.

**For socialX:** this is the largest hole in what I have built. A client only discovers a
ready batch by logging in, which is exactly what stops the approval loop from replacing
email rather than sitting beside it. Events that need both a bell row and an email:

| Event | Who |
|---|---|
| Batch submitted for approval | Client |
| Changes requested | socialX |
| Batch approved | socialX |
| Posts scheduled into HL Social Planner | Client |
| Payment failed, and each dunning step | Client and socialX |
| Onboarding completed | socialX |
| Revision rounds exhausted | Client, before they hit it |

**Priority: highest.** Nothing else on this list changes day to day operation as much.

### 2.2 The alarm bell for the money path

**There:** `lib/alarm.ts`. Two rules, both earned rather than borrowed from general
monitoring practice. Raising an alarm never breaks the caller. And one failure is not
news, a persistent one is: `notifyAfter` sets how many times something must happen before
anyone is told, picked per call site from whether a retry could plausibly save it.

**For socialX:** webhook failures currently land in `stripe_events.error` where nobody
looks. A provisioning failure means a paying customer with no account and no signal. The
`notifyAfter` idea matters specifically because the Stripe webhook is designed to throw
and be retried, so alerting on the first throw would train the owner to ignore alerts.

**Priority: high.** Small build, and it protects the part of the system where silence is
most expensive.

### 2.3 Ask whether the work actually did anything

**There:** `lib/feedback-ask.ts`. Ask 14 days after approval, not on the day, because the
video needs time in the world. One at a time, oldest first. An answer closes it for good,
including "skipped". "Too early to tell" is a rain check that reopens after 30 days.

**For socialX:** this fits the ICP better than it fits GHL Video. The buyer is revenue
first and measures everything in pipeline, close rate, and retention. Asking "did this
month's content change anything at the trust stage" does two jobs: it gives the client a
reason to notice value they would otherwise not track, and it produces the case study
material the Company Profile says socialX currently lacks. The profile is explicit that
real proof gets added as it is earned, and this is the mechanism that earns it.

**Priority: high.** Cheap, and it is the only thing on this list that generates
marketable proof.

### 2.4 A share link that needs no login

**There:** `lib/shared-lists.ts` plus `/list/[token]` and `/invoice/[token]`. A shortlist
is shared by token; codes are stored and prices looked up live, so a share never quotes a
number checkout would not charge. The total at share time is kept so a later price move
is visible rather than silently restated.

**For socialX:** a founder reviewing a batch often wants a second opinion from a partner
or a VA who has no portal login. Today that means screenshots. A read-only
`/batch/[token]` preview, optionally comment-enabled, removes the worst friction in the
approval loop. The same pattern gives public invoices.

**Priority: medium high.** Directly removes friction from the screen clients touch most.

### 2.5 Clients vote on what gets made next

**There:** migration `0053_catalog_votes.sql` plus library engagement tracking. Clients
signal which videos they want made.

**For socialX:** the library roadmap is currently Salman guessing which of the 27
HighLevel features to cover next. Letting clients upvote features they want content about
turns that into evidence, and the votes double as a read on which HL features the
ecosystem actually cares about. It costs one table and one portal screen.

**Priority: medium high.** Unusually high leverage for the size.

### 2.6 The style guide as a client deliverable

**There:** recent commits added a style guide socialX writes for a client, read and marked
up in their portal, stored in the HighLevel library rather than local storage.

**For socialX:** `brand_profiles` currently holds intake answers. Turning that into a
readable brand document the client can review and correct makes the intake feel like a
deliverable rather than a form, and it gives both sides one artefact to point at when a
batch misses the voice. It also fits the hybrid media decision exactly: the document
lives in HighLevel, socialX stores the link.

**Priority: medium.**

### 2.7 The handbook that cannot go stale

**There:** `lib/handbook.ts`. Anything the system already knows is not written in it:
statuses, revision policy, roles, stages, and which emails exist are read from the code
and database at the moment the page opens. Only judgement is written, because judgement
cannot be derived. `check:handbook` fails the build when a page references something that
no longer exists.

**For socialX:** ops knowledge currently lives in Slack and in people's heads, and the
Company Profile says the portal is the moat. A handbook that reads live entitlements,
statuses, and pillar mix from the database is the difference between onboarding a new
producer in a day and in a month.

**Priority: medium.** Grows in value with headcount.

### 2.8 Onboarding as a path, not a pile

**There:** `lib/onboarding.ts`. Only ever one step is actionable, because a list where
three things are all "do this now" is a pile of chores. And the third step belongs to
socialX rather than the client, since nobody can approve work that has not been made yet.

**For socialX:** the portal overview already nudges toward onboarding, but the post
onboarding path is a blank dashboard until the first batch lands. Encoding the three
steps, with the third owned by socialX, fills that gap honestly.

**Priority: medium.** Small build, noticeably better first week.

---

## 3. Take these as engineering discipline

These are not features. They are why that codebase has not rotted.

### 3.1 Checks that enforce rules nobody remembers

Eight scripts, run by `prebuild` so a broken rule cannot ship:

| Check | What it catches |
|---|---|
| `check:tokens` | A component pointing at a design token that no longer exists. Silent in every direction: `var(--gone)` paints nothing |
| `check:leaks` | A colour literal typed into a component, which quietly removes that surface from the theme forever |
| `check:portal-ui` | A screen inventing its own button and field styles instead of using the shared vocabulary |
| `check:drift` | The price a page shows disagreeing with the row checkout actually charges |
| `check:handbook` | Documentation describing something that no longer exists |
| `check:demo` | The known-good demo client still being intact |

**For socialX, in order of fit:**

- **A drift check is the obvious first one.** socialX already resolves prices server side
  from `plan_prices`, but nothing verifies that `plan_prices` still agrees with Stripe.
  Today a failed `stripe:sync` is invisible until a customer sees the wrong number. The
  seed asserts its own arithmetic; nothing asserts the round trip.
- **A leak check next.** socialX has tokens in `globals.css` and the portal screens
  already carry literals like `#2B50DC` inline. That is the exact drift this catches, and
  it is cheaper to stop now at 30 screens than later at 100.
- **A handbook check** only once there is a handbook.

### 3.2 The ratchet, not the cliff

`check-portal-ui.ts` is worth reading in full. Every screen was on the old way, so a check
that simply refused them would have to be switched off until the last conversion landed,
which is weeks of no protection during the exact period the problem could grow. Instead
the unconverted files are listed by name, the check refuses local styles anywhere else,
and the list can only shrink. It doubles as the migration tracker: when the list is empty,
the conversion is done.

That pattern applies to any cleanup socialX takes on later.

### 3.3 Tests and a prebuild gate

`prebuild` runs unit tests and four checks before every build. socialX has four test
scripts today, all run by hand. Wiring them into `prebuild` costs one line and means a
broken revision ceiling cannot reach production.

Worth noting: the tests there are `tsx --test` on pure modules, which is why the rules
files are written import-free. `lib/feedback-ask.ts` and `lib/onboarding.ts` say so in
their opening comments. That is a deliberate design choice, not an accident, and socialX
should copy it for anything rule-shaped.

### 3.4 A demo client

`seed-demo-client.ts` plus `check:demo` keeps a known-good account alive to click through.
socialX has no way to see a populated portal without hand-building one, which is why the
approval screen has never been viewed with real content in it.

---

## 4. Take these later, for growth

Lower priority because they serve acquisition rather than delivery, and socialX delivery
is where the current risk sits.

- **Partner and affiliate program.** `lib/partner-program.ts` is a clean model: the
  commission rate attaches to the client rather than the product, first-order and
  follow-on rates, verified against Stripe and FirstPromoter. HL resellers know other HL
  resellers, so referral fits the ecosystem well.
- **Coupons and order bumps.** Careful here: the Company Profile bans invented discounts.
  Any coupon system needs the same server-side resolution the rate cards already use.
- **Campaigns and email marketing.** Marketing email stays in HighLevel today by decision.
  Worth revisiting only if that becomes a constraint.
- **SEO tooling.** Audit, redirects, traffic, and page inventory. socialX is one landing
  page today, so this is premature.
- **Blog and landing pages.** Same reasoning.
- **Cross-sell section.** The GHL Video portal already carries a `socialx` section. The
  reciprocal belongs in the socialX portal, and it is the cheapest cross-brand move
  available. Note the Company Profile limits public cross-brand references to the footer
  line and the track-record line, so this needs Shariful's call on scope.

---

## 5. Do not take these

Being explicit, because the pull toward feature parity is real and some of it is harmful.

- **Quote and custom project request flows.** GHL Video sells bespoke work, so a quote
  form is correct there. socialX is the productized wedge, and the Company Profile is
  explicit that it never drifts into custom agency scope, media buying, or strategy
  retainers. That work belongs to growX. A quote form on socialX is the first step toward
  breaking the model that makes the flat price possible.
- **Per-project stations, production jobs, and studio queues.** They exist because a video
  is a long bespoke pipeline with many hand-offs. A socialX batch is a monthly cycle with
  one approval. Importing that machinery would add ceremony to something that is
  deliberately simple.
- **Editing subscriptions as a second product line.** socialX has three tiers and the
  pricing is locked. A fourth shape needs Shariful's approval and a reason, not
  inheritance from a sister brand.
- **The full 40-screen admin.** Much of that surface exists because GHL Video sells more
  kinds of thing. socialX should stay at the smallest admin that runs the business.

---

## 6. Suggested sequence

Nothing here is approved. Ordered by what protects or unblocks the most.

| Step | What | Why now |
|---|---|---|
| 1 | Notifications and transactional email | The approval loop does not work without it. Clients cannot act on what they cannot see |
| 2 | Alarm bell with `notifyAfter` | Provisioning failures are currently silent, and silence there costs a paying customer |
| 3 | `check:drift` and `check:leaks`, wired into `prebuild` | Cheap now, and both problems grow quietly |
| 4 | Demo client seed | Every screen after this is easier to build and verify |
| 5 | Feedback ask at 14 days | Generates the proof socialX does not yet have |
| 6 | Share a batch by token | Removes the worst friction in the screen clients touch monthly |
| 7 | Feature voting | Turns the library roadmap from guesswork into evidence |
| 8 | Style guide as a deliverable | Makes intake feel like value rather than a form |
| 9 | Handbook | Pays off when the team grows |

Steps 1 through 4 are worth doing before R4. R4 is the HighLevel Social Planner
integration, which still needs its API spike, and none of the above depends on it.

---

## 7. The honest summary

The single most valuable thing in that repository is not a feature. It is the habit of
writing down why a rule exists, next to the code that enforces it, and then having a
script fail the build when the rule is broken. socialX has the beginnings of that: the
seed asserts its own pricing, the revision ceiling is a database trigger, and the Journal
records decisions. Continuing in that direction matters more than any individual screen on
this list.
