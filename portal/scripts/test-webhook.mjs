/**
 * Exercises the real webhook path: a genuine Stripe test subscription, a correctly
 * signed checkout.session.completed event, posted to the running app. Then checks
 * what actually landed in the database, and replays the event to prove idempotency.
 */
import Stripe from "stripe";
import pg from "pg";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = line.indexOf("="); process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const EMAIL = `e2e-${Date.now()}@flowstacktest.invalid`;

// 1. A real test-mode subscription on the Growth quarterly launch price.
const { rows: [price] } = await db.query(`
  select pp.stripe_price_id from plan_prices pp join plans p on p.id=pp.plan_id
  where p.key='growth' and pp.cycle_key='quarterly' and pp.rate_card_key='launch'`);

const customer = await stripe.customers.create({
  email: EMAIL,
  name: "FlowStack Pro",
  payment_method: "pm_card_visa",
  invoice_settings: { default_payment_method: "pm_card_visa" },
});
const sub = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: price.stripe_price_id }],
  metadata: { plan_key: "growth", cycle_key: "quarterly", rate_card_key: "launch" },
});
console.log(`created test subscription ${sub.id} (${sub.status})`);

// 2. A signed checkout.session.completed event.
function post(evt) {
  const payload = JSON.stringify(evt);
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${ts}.${payload}`).digest("hex");
  /* The console, not the website. Provisioning moved here when the website
     stopped holding a database credential, so this is where Stripe points too. */
  const base = (process.env.TEST_PORTAL_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
  return fetch(`${base}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": `t=${ts},v1=${sig}` },
    body: payload,
  }).then(async r => ({ status: r.status, body: await r.text() }));
}

const evt = {
  id: `evt_e2e_${Date.now()}`,
  object: "event",
  api_version: "2026-07-29.dahlia",
  created: Math.floor(Date.now() / 1000),
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_e2e_${Date.now()}`,
      object: "checkout.session",
      mode: "subscription",
      status: "complete",
      subscription: sub.id,
      customer: customer.id,
      customer_details: { email: EMAIL, name: "FlowStack Pro" },
      metadata: { plan_key: "growth", cycle_key: "quarterly", rate_card_key: "launch" },
    },
  },
};

const first = await post(evt);
console.log(`webhook  -> ${first.status} ${first.body}`);

// 3. What actually landed.
const { rows: [state] } = await db.query(`
  select o.id, o.name, o.slug, o.status, o.source, o.owner_email,
         s.status as sub_status, s.cycle_key, s.rate_card_key,
         pl.key as plan,
         (select count(*) from memberships m where m.org_id=o.id) as members,
         (select count(*) from batches b where b.org_id=o.id) as batches,
         (select b.quota_posts from batches b where b.org_id=o.id limit 1) as quota_posts,
         (select b.quota_motion from batches b where b.org_id=o.id limit 1) as quota_motion,
         (select b.revision_rounds_allowed from batches b where b.org_id=o.id limit 1) as rounds,
         (select to_char(b.due_at,'YYYY-MM-DD') from batches b where b.org_id=o.id limit 1) as due
  from organizations o
  left join subscriptions s on s.org_id=o.id
  left join plans pl on pl.id=s.plan_id
  where o.owner_email=$1`, [EMAIL]);

if (!state) { console.log("FAIL: nothing was provisioned"); process.exit(1); }
console.log("\nprovisioned:");
for (const [k, v] of Object.entries(state)) console.log(`  ${k.padEnd(14)} ${v}`);

const checks = [
  ["org created",           !!state.id],
  ["status onboarding",     state.status === "onboarding"],
  ["plan growth",           state.plan === "growth"],
  ["cycle quarterly",       state.cycle_key === "quarterly"],
  ["launch rate card",      state.rate_card_key === "launch"],
  ["owner membership",      Number(state.members) === 1],
  ["first batch created",   Number(state.batches) === 1],
  ["quota 16 posts",        Number(state.quota_posts) === 16],
  ["quota 2 motion",        Number(state.quota_motion) === 2],
  ["2 revision rounds",     Number(state.rounds) === 2],
];
console.log("");
let bad = 0;
for (const [label, ok] of checks) { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) bad++; }

// 4. Replay the same event: must be a no-op, not a second org.
const replay = await post(evt);
const { rows: [{ count }] } = await db.query("select count(*) from organizations where owner_email=$1", [EMAIL]);
const idem = replay.body.includes("duplicate") && Number(count) === 1;
console.log(`\n  ${idem ? "PASS" : "FAIL"}  replay is idempotent (${replay.body.trim()}, orgs=${count})`);
if (!idem) bad++;

// 5. Clean up Stripe and the database.
await stripe.subscriptions.cancel(sub.id).catch(() => {});
await stripe.customers.del(customer.id).catch(() => {});
await db.query("delete from organizations where owner_email=$1", [EMAIL]);
await db.query("delete from stripe_events where id like 'evt_e2e_%'");
const { rows: [u] } = await db.query("select id from auth.users where email=$1", [EMAIL]);
if (u) await db.query("delete from auth.users where id=$1", [u.id]);
console.log("\ncleaned up.");

await db.end();
process.exit(bad ? 1 : 0);
