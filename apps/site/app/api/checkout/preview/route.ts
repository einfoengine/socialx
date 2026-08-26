import { NextResponse, type NextRequest } from "next/server";
import { resolveCheckout } from "@/lib/billing/resolve";

/**
 * What a given package, cycle and code would cost.
 *
 * Used when the buyer changes cycle or applies a code, so the summary always
 * shows the number Stripe will charge rather than one the browser worked out.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: {
    plan?: string; cycle?: string; code?: string;
    noDiscount?: boolean; addons?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const r = await resolveCheckout(body.plan ?? "", body.cycle ?? "monthly", body.code, {
      skipAutoDiscount: Boolean(body.noDiscount),
      addonKeys: body.addons ?? [],
    });
    return NextResponse.json({
      listTotal: r.listTotal,
      total: r.total,
      saving: r.listTotal - r.total,
      addons: r.addons.map((a) => ({ key: a.key, name: a.name, amount: a.amount })),
      addonTotal: r.addons.reduce((s2, a) => s2 + a.amount, 0),
      dueToday: r.dueToday,
      coupon: r.coupon ? { code: r.coupon.code, percentOff: r.coupon.percentOff } : null,
      autoApplied: r.autoApplied,
      /* A code that was typed but did not survive validation. The form says so
         rather than silently charging list price and hoping nobody notices. */
      codeRejected: Boolean(body.code) && !r.coupon,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown package." },
      { status: 400 }
    );
  }
}
