import "server-only";

import { createServiceClient } from "@/lib/core/supabase/service";

/**
 * Resolving what a checkout actually charges.
 *
 * One place, because both the pricing page and any shared link end up here and a
 * second copy of this logic is a second chance to charge the wrong amount.
 */

export type ResolvedCheckout = {
  /** True when the discount attached on its own rather than from a typed code. */
  autoApplied: boolean;
  planKey: string;
  cycleKey: string;
  stripePriceId: string;
  planPriceId: string;
  listTotal: number;
  coupon: { id: string; code: string; percentOff: number; stripeCouponId: string } | null;
  /** One-time extras on the first invoice. Never discounted by the plan coupon. */
  addons: { key: string; name: string; amount: number; stripePriceId: string }[];
  /** The subscription total after any discount, excluding add-ons. */
  total: number;
  /** What actually leaves the card today: the discounted plan plus any add-ons. */
  dueToday: number;
};

const PLANS = ["starter", "growth", "scale"];
const CYCLES = ["monthly", "quarterly", "half", "yearly"];

/**
 * Which rate card is live right now.
 *
 * Launch is open ended today. Giving it an end date is the only change needed to
 * fall back to regular; this reads it rather than assuming.
 */
async function activeKind(db: ReturnType<typeof createServiceClient>): Promise<"regular" | "launch"> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("rate_cards")
    .select("key, active_from, active_to, sort")
    .eq("is_active", true)
    .order("sort", { ascending: false });

  const live = (data ?? []).find(
    (c) => (!c.active_from || c.active_from <= today) && (!c.active_to || c.active_to >= today)
  );
  return (live?.key as "regular" | "launch") ?? "regular";
}

export async function resolveCheckout(
  planKey: string,
  cycleKey: string,
  code?: string | null,
  opts: { skipAutoDiscount?: boolean; addonKeys?: string[] } = {}
): Promise<ResolvedCheckout> {
  if (!PLANS.includes(planKey)) throw new Error(`Unknown package "${planKey}".`);
  if (!CYCLES.includes(cycleKey)) throw new Error(`Unknown billing cycle "${cycleKey}".`);

  const db = createServiceClient();

  const { data: price } = await db
    .from("plan_prices")
    .select("id, stripe_price_id, total_amount, plans!inner(key)")
    .eq("plans.key", planKey)
    .eq("cycle_key", cycleKey)
    .eq("is_active", true)
    .not("stripe_price_id", "is", null)
    .maybeSingle();

  if (!price?.stripe_price_id) {
    throw new Error(`No Stripe price for ${planKey}/${cycleKey}. Run: pnpm stripe:sync`);
  }

  /*
   * A buyer who removes the offer gets list price. Without this the standing
   * discount would silently reattach on the next re-price, which reads as the
   * page ignoring them.
   */
  const coupon = code
    ? await couponByCode(db, code, cycleKey)
    : opts.skipAutoDiscount
      ? null
      : await autoCoupon(db, await activeKind(db), cycleKey);

  const pct = coupon ? Number(coupon.percent_off) : 0;
  const total = Math.round(price.total_amount * (1 - pct / 100));

  /*
   * Add-ons are validated against the plan, not taken on trust. A rush is offered
   * on Starter and Growth only, because Scale already ships in 5 days on a
   * priority queue and charging it for speed it already has would be a con.
   */
  const wanted = (opts.addonKeys ?? []).filter(Boolean);
  let addons: ResolvedCheckout["addons"] = [];
  if (wanted.length > 0) {
    const { data: rows } = await db
      .from("addons")
      .select("key, name, amount, stripe_price_id, applies_to_plans")
      .in("key", wanted)
      .eq("is_active", true)
      .not("stripe_price_id", "is", null);

    addons = (rows ?? [])
      .filter(
        (a) =>
          (a.applies_to_plans as string[]).length === 0 ||
          (a.applies_to_plans as string[]).includes(planKey)
      )
      .map((a) => ({
        key: a.key as string,
        name: a.name as string,
        amount: a.amount as number,
        stripePriceId: a.stripe_price_id as string,
      }));
  }

  const addonTotal = addons.reduce((sum, a) => sum + a.amount, 0);

  return {
    autoApplied: Boolean(coupon && !code),
    planKey,
    cycleKey,
    stripePriceId: price.stripe_price_id,
    planPriceId: price.id,
    listTotal: price.total_amount,
    coupon: coupon
      ? {
          id: coupon.id,
          code: coupon.code,
          percentOff: pct,
          stripeCouponId: coupon.stripe_coupon_id as string,
        }
      : null,
    addons,
    total,
    dueToday: total + addonTotal,
  };
}

/** The add-ons a given plan may be offered. */
export async function addonsForPlan(planKey: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("addons")
    .select("key, name, description, amount, applies_to_plans")
    .eq("is_active", true)
    .not("stripe_price_id", "is", null)
    .order("sort");

  return (data ?? [])
    .filter(
      (a) =>
        (a.applies_to_plans as string[]).length === 0 ||
        (a.applies_to_plans as string[]).includes(planKey)
    )
    .map((a) => ({
      key: a.key as string,
      name: a.name as string,
      description: (a.description as string) ?? "",
      amount: a.amount as number,
    }));
}

async function autoCoupon(
  db: ReturnType<typeof createServiceClient>,
  kind: string,
  cycleKey: string
) {
  const { data } = await db
    .from("coupons")
    .select("id, code, percent_off, stripe_coupon_id, cycle_key")
    .eq("kind", kind)
    .eq("cycle_key", cycleKey)
    .eq("auto_apply", true)
    .eq("is_active", true)
    .not("stripe_coupon_id", "is", null)
    .maybeSingle();
  return data;
}

/**
 * A coupon arriving by code, from a shared link.
 *
 * Validated rather than trusted: a code that has expired, run out of
 * redemptions, or belongs to another cycle is ignored and the buyer falls back to
 * whatever they would have been offered anyway. Silently charging list price beats
 * refusing the sale over a stale link.
 */
async function couponByCode(
  db: ReturnType<typeof createServiceClient>,
  code: string,
  cycleKey: string
) {
  const { data } = await db
    .from("coupons")
    .select("id, code, percent_off, stripe_coupon_id, cycle_key, redeem_by, max_redemptions, times_redeemed")
    .eq("code", code.trim().toUpperCase())
    .eq("is_active", true)
    .not("stripe_coupon_id", "is", null)
    .maybeSingle();

  if (!data) return null;
  if (data.cycle_key && data.cycle_key !== cycleKey) return null;
  if (data.redeem_by && data.redeem_by < new Date().toISOString().slice(0, 10)) return null;
  if (data.max_redemptions !== null && data.times_redeemed >= data.max_redemptions) return null;

  return data;
}
