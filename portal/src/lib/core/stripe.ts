import "server-only";

import Stripe from "stripe";

/**
 * Stripe client. Server only, and lazily constructed so the marketing site still
 * builds and serves in an environment with no Stripe key.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  cached = new Stripe(key, {
    // Pinning the version means a Stripe-side upgrade cannot silently change
    // the shape of a webhook payload underneath us.
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
    appInfo: { name: "socialX portal" },
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Stripe recurring intervals for each billing cycle.
 *
 * Quarterly and half yearly are month-based with an interval_count, not their own
 * interval type. Yearly is a real year rather than 12 months so renewal dates land
 * on the same calendar date.
 */
export const CYCLE_INTERVAL: Record<
  string,
  { interval: "month" | "year"; interval_count: number }
> = {
  monthly: { interval: "month", interval_count: 1 },
  quarterly: { interval: "month", interval_count: 3 },
  half: { interval: "month", interval_count: 6 },
  yearly: { interval: "year", interval_count: 1 },
};

/** Stable identifier for a price, so syncing is idempotent across runs. */
export function lookupKey(planKey: string, cycleKey: string, rateCardKey: string): string {
  return `sx_${planKey}_${cycleKey}_${rateCardKey}`;
}
