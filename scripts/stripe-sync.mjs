#!/usr/bin/env node
/**
 * Pushes the catalog into Stripe.
 *
 * The database holds LIST prices, one per plan and cycle. Discounts are coupons.
 * That way the buyer sees the saving on Stripe's own checkout page instead of an
 * already-reduced number with nothing to compare it against, and ending a launch
 * offer is deactivating a coupon rather than archiving prices and migrating
 * everyone on them.
 *
 * Idempotent. Stripe prices and coupons are both immutable, so a changed amount
 * or percentage creates a new object and retires the old one.
 *
 *   node scripts/stripe-sync.mjs          apply
 *   node scripts/stripe-sync.mjs --dry    show what would change
 */
import Stripe from "stripe";
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const DRY = process.argv.includes("--dry");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

const CYCLE_INTERVAL = {
  monthly: { interval: "month", interval_count: 1 },
  quarterly: { interval: "month", interval_count: 3 },
  half: { interval: "month", interval_count: 6 },
  yearly: { interval: "year", interval_count: 1 },
};
const priceKey = (plan, cycle) => `sx_${plan}_${cycle}`;
/*
 * The percentage is part of the coupon id, so changing it creates a new coupon
 * instead of silently leaving the old percentage attached to new customers.
 *
 * The p suffix marks the plan-scoped generation. A Stripe coupon's applies_to is
 * immutable, so restricting the discount to the plan products meant new coupons
 * rather than edits, and the id has to differ or the old unrestricted ones would
 * be found and reused. Without the restriction a 50% launch coupon also halves
 * any one-time add-on on the first invoice, which is not what the offer says.
 */
const couponId = (card, cycle, pct) => `sx_${card}_${cycle}_${Math.round(pct)}_p`;
const money = (c) => `$${(c / 100).toFixed(2)}`;

console.log(
  `Stripe mode: ${process.env.STRIPE_SECRET_KEY.startsWith("sk_test") ? "TEST" : "LIVE"}${DRY ? "  (dry run)" : ""}\n`
);

await db.connect();

/* ---------------- products ---------------- */

const { rows: prices } = await db.query(`
  select pp.id, pp.cycle_key, pp.monthly_amount, pp.total_amount, pp.currency,
         pp.stripe_price_id, p.key as plan_key, p.name as plan_name, p.sort, c.months
  from plan_prices pp
  join plans p on p.id = pp.plan_id
  join billing_cycles c on c.key = pp.cycle_key
  where pp.is_active
  order by p.sort, c.sort
`);

if (prices.length !== 12) {
  console.warn(`Expected 12 list prices, found ${prices.length}. Continuing.\n`);
}

const products = new Map();
for (const planKey of [...new Set(prices.map((r) => r.plan_key))]) {
  const row = prices.find((r) => r.plan_key === planKey);
  const id = `sx_plan_${planKey}`;
  let product = null;
  try {
    product = await stripe.products.retrieve(id);
  } catch {
    /* not created yet */
  }
  if (!product && !DRY) {
    product = await stripe.products.create({
      id,
      name: `socialX ${row.plan_name}`,
      description: `socialX ${row.plan_name} plan. Productized social media for HighLevel SaaS resellers.`,
      metadata: { plan_key: planKey },
    });
    console.log(`  created product  ${id}`);
  } else {
    console.log(`  ${product ? "product exists" : "would create  "}  ${id}`);
  }
  products.set(planKey, product?.id ?? id);
}

/* ---------------- list prices ---------------- */

console.log("\nList prices:");
let created = 0, reused = 0, replaced = 0;

for (const r of prices) {
  const key = priceKey(r.plan_key, r.cycle_key);
  const label = `${r.plan_key}/${r.cycle_key}`;
  const expected = r.monthly_amount * r.months;

  if (r.total_amount !== expected) {
    console.error(`  REFUSED  ${label}: total ${money(r.total_amount)} is not the monthly rate times ${r.months}`);
    process.exitCode = 1;
    continue;
  }

  const found = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const current = found.data[0];

  if (current && current.unit_amount === r.total_amount) {
    reused++;
    if (r.stripe_price_id !== current.id && !DRY) {
      await db.query("update plan_prices set stripe_price_id = $1 where id = $2", [current.id, r.id]);
    }
    console.log(`  ok        ${label.padEnd(20)} ${money(r.total_amount).padStart(10)}  ${current.id}`);
    continue;
  }

  if (DRY) {
    console.log(`  would ${current ? "replace" : "create "}  ${label.padEnd(20)} ${money(r.total_amount).padStart(10)}`);
    continue;
  }

  if (current) {
    await stripe.prices.update(current.id, { active: false, lookup_key: null });
    replaced++;
  }

  const price = await stripe.prices.create({
    product: products.get(r.plan_key),
    currency: r.currency,
    unit_amount: r.total_amount,
    recurring: CYCLE_INTERVAL[r.cycle_key],
    lookup_key: key,
    transfer_lookup_key: true,
    nickname: `${r.plan_name} ${r.cycle_key} list`,
    metadata: {
      plan_key: r.plan_key,
      cycle_key: r.cycle_key,
      plan_price_id: r.id,
      monthly_equivalent: String(r.monthly_amount),
    },
  });

  await db.query("update plan_prices set stripe_price_id = $1 where id = $2", [price.id, r.id]);
  created++;
  console.log(`  ${current ? "replaced" : "created "}  ${label.padEnd(20)} ${money(r.total_amount).padStart(10)}  ${price.id}`);
}

/* ---------------- coupons ---------------- */

console.log("\nDiscount coupons:");
const { rows: discounts } = await db.query(`
  select c.id, c.kind as rate_card_key, c.cycle_key, c.percent_off, c.stripe_coupon_id, c.code
  from coupons c
  where c.is_active and c.auto_apply
  order by c.kind, c.cycle_key
`);

for (const d of discounts) {
  const pct = Number(d.percent_off);
  const id = couponId(d.rate_card_key, d.cycle_key, pct);
  const label = `${d.rate_card_key}/${d.cycle_key}`;

  let coupon = null;
  try {
    coupon = await stripe.coupons.retrieve(id);
  } catch {
    /* not created yet */
  }

  if (coupon && coupon.valid) {
    if (d.stripe_coupon_id !== coupon.id && !DRY) {
      await db.query("update coupons set stripe_coupon_id = $1 where id = $2", [coupon.id, d.id]);
    }
    console.log(`  ok        ${label.padEnd(20)} ${String(pct).padStart(3)}% off  ${coupon.id}`);
    continue;
  }

  if (DRY) {
    console.log(`  would create  ${label.padEnd(20)} ${pct}% off`);
    continue;
  }

  /*
   * duration: forever. A launch buyer keeps the discount at every renewal, which
   * is the grandfathering decision made deliberately rather than inherited from
   * whichever price they happened to buy. Removing it later is a per-subscription
   * act somebody has to choose.
   */
  const made = await stripe.coupons.create({
    id,
    percent_off: pct,
    duration: "forever",
    name: `socialX ${d.rate_card_key} ${d.cycle_key} ${pct}% off`,
    // Plan products only. A one-time add-on on the same invoice keeps its price.
    applies_to: { products: [...products.values()] },
    metadata: { rate_card_key: d.rate_card_key, cycle_key: d.cycle_key },
  });

  await db.query("update coupons set stripe_coupon_id = $1 where id = $2", [made.id, d.id]);
  console.log(`  created   ${label.padEnd(20)} ${pct}% off  ${made.id}`);
}

/* ---------------- add-ons ---------------- */

console.log("\nAdd-ons:");
const { rows: addons } = await db.query(
  "select id, key, name, description, amount, currency, stripe_price_id from addons where is_active order by sort"
);

for (const a of addons) {
  const productId = `sx_addon_${a.key}`;
  const label = a.key;

  let product = null;
  try {
    product = await stripe.products.retrieve(productId);
  } catch {
    /* not created yet */
  }
  if (!product && !DRY) {
    product = await stripe.products.create({
      id: productId,
      name: `socialX ${a.name}`,
      description: a.description ?? undefined,
      metadata: { addon_key: a.key },
    });
  }

  const key = `sx_addon_${a.key}`;
  const found = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const current = found.data[0];

  if (current && current.unit_amount === a.amount) {
    if (a.stripe_price_id !== current.id && !DRY) {
      await db.query("update addons set stripe_price_id = $1 where id = $2", [current.id, a.id]);
    }
    console.log(`  ok        ${label.padEnd(20)} ${money(a.amount).padStart(10)}  ${current.id}`);
    continue;
  }
  if (DRY) {
    console.log(`  would ${current ? "replace" : "create "}  ${label.padEnd(20)} ${money(a.amount).padStart(10)}`);
    continue;
  }
  if (current) await stripe.prices.update(current.id, { active: false, lookup_key: null });

  // One-time: no recurring block. An add-on that renewed would be a fourth tier.
  const price = await stripe.prices.create({
    product: productId,
    currency: a.currency,
    unit_amount: a.amount,
    lookup_key: key,
    transfer_lookup_key: true,
    nickname: a.name,
    metadata: { addon_key: a.key },
  });
  await db.query("update addons set stripe_price_id = $1 where id = $2", [price.id, a.id]);
  console.log(`  ${current ? "replaced" : "created "}  ${label.padEnd(20)} ${money(a.amount).padStart(10)}  ${price.id}`);
}

/* ---------------- retire the old three-part prices ---------------- */

if (!DRY) {
  console.log("\nRetiring superseded prices:");
  let archived = 0;
  for await (const price of stripe.prices.list({ active: true, limit: 100 })) {
    const key = price.lookup_key ?? "";
    // The old scheme was sx_<plan>_<cycle>_<card>: four segments, not three.
    if (/^sx_[a-z]+_[a-z]+_[a-z]+$/.test(key)) {
      await stripe.prices.update(price.id, { active: false, lookup_key: null });
      archived++;
      console.log(`  archived  ${key}`);
    }
  }
  if (archived === 0) console.log("  nothing to retire");
}

console.log(`\ncreated ${created}, replaced ${replaced}, unchanged ${reused}`);

if (!DRY) {
  const { rows: [c] } = await db.query(
    "select count(*) filter (where stripe_price_id is not null) linked, count(*) total from plan_prices where is_active"
  );
  const { rows: [d] } = await db.query(
    "select count(*) filter (where stripe_coupon_id is not null) linked, count(*) total from coupons where is_active and auto_apply"
  );
  const { rows: [ad] } = await db.query(
    "select count(*) filter (where stripe_price_id is not null) linked, count(*) total from addons where is_active"
  );
  console.log(`prices linked: ${c.linked}/${c.total}   coupons linked: ${d.linked}/${d.total}   add-ons linked: ${ad.linked}/${ad.total}`);
  if (ad.linked !== ad.total) process.exitCode = 1;
  if (c.linked !== c.total || d.linked !== d.total) {
    console.error("Something is unlinked. Checkout would fail for it.");
    process.exitCode = 1;
  }
}

await db.end();
