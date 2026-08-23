"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveCheckout } from "./resolve";

/**
 * Starts a Stripe Checkout session.
 *
 * The browser sends a plan key and a cycle key. It never sends a price, an amount,
 * or a rate card. All three are resolved here from plan_prices, which is what makes
 * the locked pricing a property of the system rather than a rule someone has to
 * remember. A tampered form can at worst pick a different published tier.
 */
export async function startCheckout(formData: FormData) {
  const planKey = String(formData.get("plan") ?? "").trim();
  const cycleKey = String(formData.get("cycle") ?? "monthly").trim();
  const code = String(formData.get("code") ?? "").trim() || null;

  const url = await checkoutUrl(planKey, cycleKey, code);
  redirect(url);
}

/**
 * Builds a Stripe Checkout Session and returns its URL.
 *
 * Shared by the pricing form and the link route, so a shared checkout link and
 * the button on the site cannot drift apart in what they charge.
 *
 * The browser sends a package, a cycle, and at most a coupon code. It never sends
 * a price, an amount, or a percentage: all three are resolved server side, which
 * is what keeps the locked pricing a property of the system rather than a rule
 * somebody has to remember.
 */
export async function checkoutUrl(
  planKey: string,
  cycleKey: string,
  code?: string | null
): Promise<string> {
  const resolved = await resolveCheckout(planKey, cycleKey, code);
  const origin = await siteOrigin();
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: resolved.stripePriceId, quantity: 1 }],
    success_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#gw-pricing`,
    /*
     * discounts and allow_promotion_codes are mutually exclusive in Stripe
     * Checkout. The discount has to apply on its own rather than waiting for
     * someone to type a code, so it goes here and customer-entered codes stay off.
     */
    ...(resolved.coupon
      ? { discounts: [{ coupon: resolved.coupon.stripeCouponId }] }
      : { allow_promotion_codes: false }),
    billing_address_collection: "auto",
    subscription_data: {
      metadata: {
        plan_key: resolved.planKey,
        cycle_key: resolved.cycleKey,
        rate_card_key: resolved.coupon?.code.startsWith("LAUNCH") ? "launch" : "regular",
        plan_price_id: resolved.planPriceId,
        coupon_code: resolved.coupon?.code ?? "",
      },
    },
    metadata: {
      plan_key: resolved.planKey,
      cycle_key: resolved.cycleKey,
      rate_card_key: resolved.coupon?.code.startsWith("LAUNCH") ? "launch" : "regular",
      plan_price_id: resolved.planPriceId,
      coupon_code: resolved.coupon?.code ?? "",
    },
  });

  if (!session.url) throw new Error("Stripe returned a session with no URL.");

  if (resolved.coupon) {
    // Best effort: a redemption count that lags is better than a checkout that
    // fails because counting it did.
    const db = createServiceClient();
    await db.rpc("increment_coupon_redemption", { coupon_id: resolved.coupon.id }).then(
      () => undefined,
      () => undefined
    );
  }

  return session.url;
}

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
