#!/usr/bin/env node
/**
 * Checkout links, verified against live Stripe.
 *
 * A link carries a package, a cycle and at most a code. The cases that matter are
 * the ones where a link is wrong: a code for another cycle, an expired code, a
 * code nobody created. All three must fall back to list price rather than refuse
 * the sale, because losing a discount is recoverable and losing the buyer is not.
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
const money = (c) => `$${(c / 100).toFixed(2)}`;
let fails = 0;

async function resolve(plan, cycle, code) {
  const { data: price } = await db.from("plan_prices")
    .select("stripe_price_id, total_amount, plans!inner(key)")
    .eq("plans.key", plan).eq("cycle_key", cycle).eq("is_active", true).single();

  let coupon = null;
  if (code) {
    const { data } = await db.from("coupons")
      .select("code, percent_off, stripe_coupon_id, cycle_key, redeem_by, max_redemptions, times_redeemed")
      .eq("code", code.toUpperCase()).eq("is_active", true).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    if (data && (!data.cycle_key || data.cycle_key === cycle)
        && (!data.redeem_by || data.redeem_by >= today)
        && (data.max_redemptions === null || data.times_redeemed < data.max_redemptions)) {
      coupon = data;
    }
  } else {
    const { data } = await db.from("coupons")
      .select("code, percent_off, stripe_coupon_id")
      .eq("kind", "launch").eq("cycle_key", cycle).eq("auto_apply", true).eq("is_active", true).maybeSingle();
    coupon = data;
  }
  return { price, coupon };
}

const cases = [
  ["growth", "yearly", null, "standing link picks up the launch offer", 50],
  ["starter", "quarterly", "LAUNCH-QUARTERLY-30", "explicit code matching its cycle", 30],
  ["scale", "monthly", null, "monthly has no discount", 0],
  ["growth", "monthly", "LAUNCH-YEARLY-50", "yearly code on a monthly link is ignored", 0],
  ["growth", "yearly", "NOPE-DOES-NOT-EXIST", "unknown code falls back to list", 0],
];

for (const [plan, cycle, code, label, expectPct] of cases) {
  const { price, coupon } = await resolve(plan, cycle, code);
  const pct = coupon ? Number(coupon.percent_off) : 0;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.stripe_price_id, quantity: 1 }],
    success_url: "http://localhost:3000/welcome",
    cancel_url: "http://localhost:3000/#gw-pricing",
    ...(coupon?.stripe_coupon_id ? { discounts: [{ coupon: coupon.stripe_coupon_id }] } : {}),
  });

  const expectedTotal = Math.round(price.total_amount * (1 - expectPct / 100));
  const ok = pct === expectPct && session.amount_total === expectedTotal;
  if (!ok) fails++;

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}\n` +
    `        ${plan}/${cycle}${code ? ` code=${code}` : ""}  ` +
    `list ${money(session.amount_subtotal)} -> charged ${money(session.amount_total)}` +
    `${pct ? ` (${pct}% off)` : " (no discount)"}`
  );
  if (!ok) console.log(`        expected ${expectPct}% and ${money(expectedTotal)}`);

  await stripe.checkout.sessions.expire(session.id);
}

console.log(`\n${fails === 0 ? "all checks passed" : `${fails} failed`}`);
process.exit(fails ? 1 : 0);
