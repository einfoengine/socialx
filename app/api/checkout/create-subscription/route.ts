import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { resolveCheckout } from "@/lib/billing/resolve";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Creates the subscription behind the embedded checkout.
 *
 * The subscription is created incomplete, which reserves it and hands back a
 * client secret the Payment Element confirms in the browser. Nothing is charged
 * until that confirmation succeeds, and provisioning waits for the webhook rather
 * than for this response, so a browser that dies mid-payment cannot lose an order.
 *
 * The browser sends a package, a cycle, an email, and at most a coupon code. It
 * never sends a price. Everything about money is resolved here.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  let body: {
    plan?: string; cycle?: string; code?: string; noDiscount?: boolean; addons?: string[];
    email?: string; fullName?: string; company?: string; phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const fullName = (body.fullName ?? "").trim();
  const company = (body.company ?? "").trim();
  const phone = (body.phone ?? "").trim();

  /*
   * All four are required. The account is created from exactly these, so a blank
   * one means an organization nobody can name or a client nobody can reach.
   */
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
  }
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Please give your full name." }, { status: 400 });
  }
  if (company.length < 2) {
    return NextResponse.json({ error: "Please give your company name." }, { status: 400 });
  }
  if (phone.replace(/[^0-9]/g, "").length < 7) {
    return NextResponse.json({ error: "Please give a phone number we can reach you on." }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    const resolved = await resolveCheckout(body.plan ?? "", body.cycle ?? "monthly", body.code, {
      skipAutoDiscount: Boolean(body.noDiscount),
      addonKeys: body.addons ?? [],
    });

    /*
     * Reuse a customer for a returning buyer so their payment methods and history
     * stay on one record instead of fragmenting across duplicates.
     */
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer =
      existing.data[0] ??
      (await stripe.customers.create({
        email,
        name: company,
        phone,
        metadata: { source: "socialx_checkout", contact_name: fullName },
      }));

    if (existing.data[0]) {
      await stripe.customers
        .update(customer.id, { name: company, phone, metadata: { contact_name: fullName } })
        .catch(() => undefined);
    }

    const metadata = {
      plan_key: resolved.planKey,
      cycle_key: resolved.cycleKey,
      rate_card_key: resolved.coupon?.code.startsWith("LAUNCH") ? "launch" : "regular",
      plan_price_id: resolved.planPriceId,
      coupon_code: resolved.coupon?.code ?? "",
      addon_keys: resolved.addons.map((a) => a.key).join(","),
      buyer_email: email,
      buyer_name: fullName,
      buyer_company: company,
      buyer_phone: phone,
    };

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: resolved.stripePriceId }],
      ...(resolved.coupon ? { discounts: [{ coupon: resolved.coupon.stripeCouponId }] } : {}),
      /* One-time extras land on the first invoice only. The plan coupon is scoped
         to the plan products, so it cannot discount these. */
      ...(resolved.addons.length > 0
        ? { add_invoice_items: resolved.addons.map((a) => ({ price: a.stripePriceId })) }
        : {}),
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      // confirmation_secret is the current shape; payment_intent is kept for older
      // API versions so a version bump does not silently return nothing to confirm.
      expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"],
      metadata,
    });

    const clientSecret = extractClientSecret(subscription);
    if (!clientSecret) {
      // Nothing to confirm means nothing would ever be charged. Fail loudly here
      // rather than showing an empty payment form.
      await stripe.subscriptions.cancel(subscription.id).catch(() => undefined);
      return NextResponse.json(
        { error: "Stripe did not return anything to confirm. Nothing has been charged." },
        { status: 502 }
      );
    }

    if (resolved.coupon) {
      const db = createServiceClient();
      await db
        .rpc("increment_coupon_redemption", { coupon_id: resolved.coupon.id })
        .then(() => undefined, () => undefined);
    }

    return NextResponse.json({
      clientSecret,
      subscriptionId: subscription.id,
      listTotal: resolved.listTotal,
      total: resolved.total,
      dueToday: resolved.dueToday,
      addons: resolved.addons.map((a) => ({ key: a.key, name: a.name, amount: a.amount })),
      coupon: resolved.coupon ? { code: resolved.coupon.code, percentOff: resolved.coupon.percentOff } : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    console.error("[checkout] create-subscription:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** The client secret, wherever this API version decided to put it. */
function extractClientSecret(subscription: Stripe.Subscription): string | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;

  const withSecret = invoice as Stripe.Invoice & {
    confirmation_secret?: { client_secret?: string } | null;
    payment_intent?: Stripe.PaymentIntent | string | null;
  };

  if (withSecret.confirmation_secret?.client_secret) {
    return withSecret.confirmation_secret.client_secret;
  }

  const pi = withSecret.payment_intent;
  if (pi && typeof pi !== "string" && pi.client_secret) return pi.client_secret;

  return null;
}
