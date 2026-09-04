#!/usr/bin/env node
/**
 * Proves the checkout numbers, end to end, against live Stripe.
 *
 * The thing that matters here is not that a session is created: it is that the
 * buyer is shown a list price, a discount line, and a total that equals the
 * percentage socialX advertises. A pre-discounted price cannot show a saving,
 * which is why the catalog holds list prices and the discount is a coupon.
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = line.indexOf("="); process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
/* Over REST rather than a direct Postgres socket: the direct host is IPv6 only
   and drops intermittently from some networks, and a money test that cannot run
   is a money test nobody runs. */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const money = (c) => `$${(c / 100).toFixed(2)}`;
let fails = 0;

const cases = [
  ["starter", "yearly"], ["growth", "quarterly"], ["scale", "half"], ["growth", "monthly"],
];

console.log(`${"tier/cycle".padEnd(20)} ${"list".padStart(10)} ${"discount".padStart(10)} ${"charged".padStart(10)}  card`);

for (const [plan, cycle] of cases) {
  const { data: price } = await db
    .from("plan_prices")
    .select("stripe_price_id, total_amount, plans!inner(key)")
    .eq("plans.key", plan).eq("cycle_key", cycle).eq("is_active", true)
    .single();

  // The active rate card, resolved the way the server action resolves it.
  const today = new Date().toISOString().slice(0, 10);
  const { data: cards } = await db
    .from("rate_cards").select("key, active_from, active_to, sort")
    .eq("is_active", true).order("sort", { ascending: false });
  const card = (cards ?? []).find(
    (c) => (!c.active_from || c.active_from <= today) && (!c.active_to || c.active_to >= today)
  ) ?? { key: "regular" };

  const { data: disc } = await db
    .from("rate_card_discounts").select("stripe_coupon_id, percent_off")
    .eq("rate_card_key", card.key).eq("cycle_key", cycle).eq("is_active", true)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.stripe_price_id, quantity: 1 }],
    success_url: "http://localhost:3000/welcome?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "http://localhost:3000/#gw-pricing",
    ...(disc?.stripe_coupon_id ? { discounts: [{ coupon: disc.stripe_coupon_id }] } : {}),
  });

  const subtotal = session.amount_subtotal;
  const total = session.amount_total;
  const off = subtotal - total;
  const pct = disc ? Number(disc.percent_off) : 0;
  const expected = Math.round(price.total_amount * (1 - pct / 100));

  const listOk = subtotal === price.total_amount;
  const totalOk = total === expected;
  const ok = listOk && totalOk;
  if (!ok) fails++;

  console.log(
    `${ok ? "PASS" : "FAIL"} ${`${plan}/${cycle}`.padEnd(15)} ${money(subtotal).padStart(10)} ` +
    `${(off ? "-" + money(off) : "none").padStart(10)} ${money(total).padStart(10)}  ${card.key}${pct ? ` ${pct}%` : ""}`
  );
  if (!listOk) console.log(`      list shown ${money(subtotal)} but catalog says ${money(price.total_amount)}`);
  if (!totalOk) console.log(`      charged ${money(total)} but ${pct}% off list is ${money(expected)}`);

  await stripe.checkout.sessions.expire(session.id);
}

console.log(`\n${fails === 0 ? "all checks passed" : `${fails} failed`}`);
process.exit(fails ? 1 : 0);
