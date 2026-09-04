#!/usr/bin/env node
/**
 * The embedded checkout, end to end against live Stripe test mode.
 *
 * Hits the running app's own API routes rather than reimplementing them, then
 * confirms the payment with a test card the way the Payment Element would, and
 * checks that a paid subscription carries everything provisioning needs.
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = line.indexOf("="); process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const money = (c) => `$${(c / 100).toFixed(2)}`;
let fails = 0;
const check = (l, ok, d = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${d ? `  (${d})` : ""}`); if (!ok) fails++; };

const EMAIL = `embed-${Date.now()}@flowstacktest.invalid`;

// 1. Preview prices the order the same way the page does.
const preview = await fetch(`${BASE}/api/checkout/preview`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ plan: "growth", cycle: "yearly" }),
}).then((r) => r.json());
check("preview returns list, total and the running discount",
  preview.listTotal === 476400 && preview.total === 238200 && preview.coupon?.percentOff === 50,
  `${money(preview.listTotal)} -> ${money(preview.total)}`);
check("preview says the discount was automatic", preview.autoApplied === true);

// 2. A code for the wrong cycle is reported, not silently dropped.
const bad = await fetch(`${BASE}/api/checkout/preview`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ plan: "growth", cycle: "monthly", code: "LAUNCH-YEARLY-50" }),
}).then((r) => r.json());
check("a wrong-cycle code is flagged back to the buyer", bad.codeRejected === true && bad.total === 39700);

// 2b. The add-on: charged in full, and NOT halved by the launch coupon.
const bumped = await fetch(`${BASE}/api/checkout/preview`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ plan: "starter", cycle: "yearly", addons: ["rush_first_batch"] }),
}).then((r) => r.json());
check("add-on is added on top of the discounted plan",
  bumped.total === 118200 && bumped.addonTotal === 9700 && bumped.dueToday === 127900,
  `plan ${money(bumped.total)} + addon ${money(bumped.addonTotal)} = ${money(bumped.dueToday)}`);

// Scale already ships in 5 days on a priority queue, so a rush must not be sold to it.
const scaleBump = await fetch(`${BASE}/api/checkout/preview`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ plan: "scale", cycle: "yearly", addons: ["rush_first_batch"] }),
}).then((r) => r.json());
check("the rush is refused on Scale, which already has it", scaleBump.addonTotal === 0);

// 3. Create the subscription.
const created = await fetch(`${BASE}/api/checkout/create-subscription`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    plan: "growth", cycle: "yearly", email: EMAIL,
    fullName: "Nathan Cole", company: "FlowStack Pro", phone: "+1 555 000 0000",
  }),
}).then((r) => r.json());

check("subscription created with something to confirm",
  Boolean(created.clientSecret && created.subscriptionId), created.error ?? "");
if (!created.subscriptionId) { console.log("\ncannot continue"); process.exit(1); }

let sub = await stripe.subscriptions.retrieve(created.subscriptionId);
check("starts incomplete, so nothing is charged yet", sub.status === "incomplete", sub.status);
check("carries the buyer's email for provisioning", sub.metadata.buyer_email === EMAIL);
check("carries name, company and phone",
  sub.metadata.buyer_name === "Nathan Cole" &&
  sub.metadata.buyer_company === "FlowStack Pro" &&
  Boolean(sub.metadata.buyer_phone));

// Required fields are enforced server side, not only in the form.
const missing = await fetch(`${BASE}/api/checkout/create-subscription`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ plan: "growth", cycle: "yearly", email: `x-${Date.now()}@t.invalid` }),
}).then((r) => r.json());
check("a request missing name, company or phone is refused", Boolean(missing.error), missing.error ?? "");

// Removing the standing offer must actually charge list price.
const noDisc = await fetch(`${BASE}/api/checkout/preview`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ plan: "growth", cycle: "yearly", noDiscount: true }),
}).then((r) => r.json());
check("removing the offer charges list price", noDisc.total === 476400 && noDisc.coupon === null,
  `${money(noDisc.total)}`);
check("charges the discounted amount", created.total === 238200, money(created.total));

// 4. Confirm with a test card, the way the Payment Element does.
const pm = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
const intentId = created.clientSecret.split("_secret_")[0];
await stripe.paymentIntents.confirm(intentId, { payment_method: pm.id, return_url: `${BASE}/welcome` });

sub = await stripe.subscriptions.retrieve(created.subscriptionId);
check("becomes active once the card is confirmed", sub.status === "active", sub.status);

const inv = await stripe.invoices.retrieve(sub.latest_invoice);
check("the invoice shows list, discount and paid total",
  inv.subtotal === 476400 && inv.amount_paid === 238200,
  `list ${money(inv.subtotal)}, paid ${money(inv.amount_paid)}`);

// The coupon is scoped to plan products. On a real invoice carrying both, the
// add-on must survive at full price.
const EMAIL2 = `bump-${Date.now()}@flowstacktest.invalid`;
const withBump = await fetch(`${BASE}/api/checkout/create-subscription`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    plan: "starter", cycle: "yearly", email: EMAIL2, addons: ["rush_first_batch"],
    fullName: "Nathan Cole", company: "Bump Test", phone: "+1 555 000 0000",
  }),
}).then((r) => r.json());

const bumpSub = await stripe.subscriptions.retrieve(withBump.subscriptionId, { expand: ["latest_invoice"] });
const bumpInv = bumpSub.latest_invoice;
const addonLine = bumpInv.lines.data.find((l) => (l.description ?? "").toLowerCase().includes("rush"));
check("on a real invoice the coupon does not touch the add-on",
  bumpInv.amount_due === 127900 && addonLine?.amount === 9700,
  `due ${money(bumpInv.amount_due)}, rush line ${money(addonLine?.amount ?? 0)}`);

await stripe.subscriptions.cancel(bumpSub.id).catch(() => {});
await stripe.customers.del(typeof bumpSub.customer === "string" ? bumpSub.customer : bumpSub.customer.id).catch(() => {});
await db.from("organizations").delete().eq("owner_email", EMAIL2);

// Cleanup.
await stripe.subscriptions.cancel(sub.id).catch(() => {});
await stripe.customers.del(typeof sub.customer === "string" ? sub.customer : sub.customer.id).catch(() => {});
await db.from("organizations").delete().eq("owner_email", EMAIL);

console.log(`\n${fails === 0 ? "all checks passed" : `${fails} failed`}`);
process.exit(fails ? 1 : 0);
