import { NextResponse, type NextRequest } from "next/server";
import { platform, PlatformError } from "@/lib/platform";

/**
 * What a given package, cycle and code would cost.
 *
 * This route used to resolve the price itself, against the platform's database,
 * with the service role. It forwards to POST /api/v1/checkout/quote now and owns
 * none of that logic: one place decides what a checkout charges, and it is the
 * same place the payment is created from.
 *
 * Why this route still exists at all, rather than the browser calling the
 * platform directly: the credential. Quoting needs `checkout:quote`, which is a
 * real key with real scopes, and a key in a browser bundle is a key handed to
 * every visitor. So the browser talks to its own origin, and the key stays on
 * this server. That is also why the platform's origin allowlist is not involved
 * here: this is a server-to-server call with no Origin header.
 *
 * Rate limiting moved to the platform with the logic. Both the quote budget and
 * the stricter coupon-code budget are enforced there, which is the right place
 * for them: they protect the coupon table, and the coupon table is not this
 * application's to protect.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  plan?: string;
  cycle?: string;
  code?: string;
  noDiscount?: boolean;
  addons?: string[];
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const quote = await platform().quote({
      plan: body.plan ?? "",
      cycle: body.cycle ?? "monthly",
      code: body.code,
      noDiscount: Boolean(body.noDiscount),
      addons: body.addons ?? [],
    });

    /* Rekeyed to what CheckoutClient already reads. The API speaks snake_case
       because that is the convention every other integrator meets; this app's
       own components predate it and there is no reason to churn them. */
    return NextResponse.json({
      listTotal: quote.list_total,
      total: quote.total,
      saving: quote.saving,
      addons: quote.addons,
      addonTotal: quote.addon_total,
      dueToday: quote.due_today,
      coupon: quote.coupon
        ? { code: quote.coupon.code, percentOff: quote.coupon.percent_off }
        : null,
      autoApplied: quote.auto_applied,
      codeRejected: quote.code_rejected,
    });
  } catch (err) {
    if (err instanceof PlatformError) {
      /* The platform's own status and message are passed through, so a 429 stays
         a 429 and the buyer is told to wait rather than told the package was
         wrong. Retry-After is not forwarded: this route's caller is a form that
         retries on a click, not a scheduler. */
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not price that right now." }, { status: 502 });
  }
}
