import { NextResponse, type NextRequest } from "next/server";
import { platform, PlatformError } from "@/lib/platform";

/**
 * Creates the subscription behind the embedded checkout.
 *
 * Everything this route used to do itself now happens on the platform: resolving
 * the price, finding or creating the Stripe customer, creating the incomplete
 * subscription, counting the coupon redemption. This application no longer holds
 * a Stripe secret key or a database credential, and cannot charge anybody on its
 * own.
 *
 * What is unchanged is the contract with the browser. The Payment Element still
 * receives a client secret and still confirms it, so nothing is charged until
 * that confirmation succeeds, and provisioning still waits for the Stripe
 * webhook rather than for this response. A browser that dies mid-payment cannot
 * lose an order.
 *
 * The browser sends a package, a cycle, add-ons, contact details, and at most a
 * coupon code. It has never sent a price and still does not.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  plan?: string;
  cycle?: string;
  code?: string;
  noDiscount?: boolean;
  addons?: string[];
  email?: string;
  fullName?: string;
  company?: string;
  phone?: string;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const result = await platform().subscribe({
      plan: body.plan ?? "",
      cycle: body.cycle ?? "monthly",
      code: body.code,
      noDiscount: Boolean(body.noDiscount),
      addons: body.addons ?? [],
      email: (body.email ?? "").trim(),
      full_name: (body.fullName ?? "").trim(),
      company: (body.company ?? "").trim(),
      phone: (body.phone ?? "").trim(),
    });

    return NextResponse.json({
      clientSecret: result.client_secret,
      subscriptionId: result.subscription_id,
      listTotal: result.list_total,
      total: result.total,
      dueToday: result.due_today,
      addons: result.addons,
      coupon: result.coupon
        ? { code: result.coupon.code, percentOff: result.coupon.percent_off }
        : null,
    });
  } catch (err) {
    if (err instanceof PlatformError) {
      /*
       * Validation messages are written to be read by a buyer, so they are
       * passed through as they are. The one case worth rewording is a timeout:
       * "the platform is unreachable" is true and useless to somebody holding a
       * card, and the honest thing to say is that nothing was charged, which is
       * guaranteed because a subscription that was never confirmed never bills.
       */
      const message =
        err.code === "unreachable"
          ? "We could not reach the payment service. Nothing has been charged. Try again in a moment."
          : err.message;
      return NextResponse.json({ error: message }, { status: err.status });
    }
    console.error("[checkout] create-subscription:", err);
    return NextResponse.json(
      { error: "Something went wrong and nothing has been charged." },
      { status: 502 }
    );
  }
}
