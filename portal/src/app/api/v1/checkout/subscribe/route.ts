import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/core/stripe";
import { createServiceClient } from "@/lib/core/supabase/service";
import { clientIp, spend } from "@/lib/core/ratelimit";
import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";
import { resolveCheckout } from "@/lib/billing/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/checkout/subscribe
 *
 * Creates the subscription behind an embedded checkout and hands back a client
 * secret for the browser to confirm.
 *
 * The subscription is created incomplete, which reserves it without charging
 * anything. Nothing leaves a card until the Payment Element confirms in the
 * browser, and the account is provisioned from the Stripe webhook rather than
 * from this response, so a browser that dies mid-payment cannot lose an order.
 *
 * The caller sends a package, a cycle, add-on keys, contact details and at most a
 * coupon code. It never sends a price, an amount, a percentage or a Stripe
 * identifier. Everything about money is resolved here from plan_prices, which is
 * what makes the locked pricing a property of the system rather than a rule
 * somebody has to remember. A tampered request can at worst buy a different
 * published tier at that tier's real price.
 *
 * Why this lives in the console and not in the website that sells:
 *
 *   Creating a subscription needs the Stripe secret key and a database write.
 *   Putting that in each integrating website means handing every one of them
 *   credentials that reach every other one's data. Here it is behind a scoped
 *   API key, and the site the key belongs to is stamped onto the order, so the
 *   org that eventually gets provisioned is attached to the site that actually
 *   sold it rather than to whichever site this process was configured for.
 */

/* Two budgets, and they sit on top of the general one authenticate() already
   spends rather than duplicating it. That budget prices volume: 300 requests a
   minute per key, which is right for reading content and far too loose for
   creating subscriptions. These price the two things that are specific to this
   endpoint, so do not delete them on the grounds that the API is already
   metered. An address is the thing most worth protecting: repeated attempts on
   one email are either a broken integration or somebody testing stolen cards. */
const IP_BUDGET = { limit: 10, windowSeconds: 60 };
const EMAIL_BUDGET = { limit: 5, windowSeconds: 600 };

type Body = {
  plan?: string;
  cycle?: string;
  code?: string | null;
  noDiscount?: boolean;
  addons?: string[];
  email?: string;
  full_name?: string;
  company?: string;
  phone?: string;
};

export async function POST(request: Request) {
  const auth = await authenticate(request, "checkout:write");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  if (!isStripeConfigured()) {
    return apiError(
      { status: 503, code: "payments_unconfigured", message: "Payments are not configured." },
      auth.origin
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return apiError(
      { status: 400, code: "malformed_body", message: "That request body is not JSON." },
      auth.origin
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const fullName = (body.full_name ?? "").trim();
  const company = (body.company ?? "").trim();
  const phone = (body.phone ?? "").trim();

  /*
   * All four are required. The account is built from exactly these, so a blank
   * one means an organization nobody can name or a client nobody can reach.
   */
  const invalid =
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
      ? "That email address does not look right."
      : fullName.length < 2
        ? "A full name is required."
        : company.length < 2
          ? "A company name is required."
          : phone.replace(/[^0-9]/g, "").length < 7
            ? "A reachable phone number is required."
            : null;

  if (invalid) {
    return apiError({ status: 400, code: "invalid_buyer", message: invalid }, auth.origin);
  }

  /* Metered after validation on purpose. A malformed body is refused above
     without spending anyone's budget, so a broken integration cannot lock out
     the address it is running from. */
  const bucket = auth.caller.keyId ?? auth.caller.site.id;
  const [byIp, byEmail] = await Promise.all([
    spend(`v1:subscribe:ip:${bucket}:${clientIp(request)}`, IP_BUDGET),
    spend(`v1:subscribe:email:${email}`, EMAIL_BUDGET),
  ]);

  if (!byIp.ok || !byEmail.ok) {
    const retryAfter = Math.max(byIp.ok ? 0 : byIp.retryAfter, byEmail.ok ? 0 : byEmail.retryAfter);
    return apiError(
      {
        status: 429,
        code: "rate_limited",
        message:
          "That is more checkout attempts than we can take right now. Wait a minute and try again.",
        headers: { "Retry-After": String(retryAfter) },
      },
      auth.origin
    );
  }

  const stripe = getStripe();

  try {
    const resolved = await resolveCheckout(body.plan ?? "", body.cycle ?? "monthly", body.code, {
      skipAutoDiscount: Boolean(body.noDiscount),
      addonKeys: body.addons ?? [],
    });

    /*
     * Reuse a customer for a returning buyer so their payment methods and
     * history stay on one record instead of fragmenting across duplicates.
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
      /*
       * Which site sold this. Taken from the authenticated key rather than from
       * the request body, because a caller naming its own site would let one
       * site's credential provision clients onto another's books. It travels
       * through Stripe and comes back on the webhook, which is the only moment
       * provisioning can still learn it.
       */
      site_key: auth.caller.site.key,
    };

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: resolved.stripePriceId }],
      ...(resolved.coupon ? { discounts: [{ coupon: resolved.coupon.stripeCouponId }] } : {}),
      /* One-time extras land on the first invoice only. The plan coupon is
         scoped to the plan products, so it cannot discount these. */
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
      // rather than letting a caller render an empty payment form.
      await stripe.subscriptions.cancel(subscription.id).catch(() => undefined);
      return apiError(
        {
          status: 502,
          code: "no_confirmation_secret",
          message: "Stripe did not return anything to confirm. Nothing has been charged.",
        },
        auth.origin
      );
    }

    if (resolved.coupon) {
      /* Best effort. A redemption count that lags is better than a checkout that
         fails because counting it did. */
      const db = createServiceClient();
      await db
        .rpc("increment_coupon_redemption", { coupon_id: resolved.coupon.id })
        .then(() => undefined, () => undefined);
    }

    return apiJson(
      {
        site: auth.caller.site.key,
        client_secret: clientSecret,
        subscription_id: subscription.id,
        list_total: resolved.listTotal,
        total: resolved.total,
        due_today: resolved.dueToday,
        addons: resolved.addons.map((a) => ({ key: a.key, name: a.name, amount: a.amount })),
        coupon: resolved.coupon
          ? { code: resolved.coupon.code, percent_off: resolved.coupon.percentOff }
          : null,
      },
      { caller: auth.caller, origin: auth.origin }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    console.error("[v1/checkout/subscribe]", message);
    return apiError({ status: 400, code: "checkout_failed", message }, auth.origin);
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

export async function OPTIONS(request: Request) {
  return preflight(request);
}
