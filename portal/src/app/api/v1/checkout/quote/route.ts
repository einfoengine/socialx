import { clientIp, limitHeaders, spend } from "@/lib/core/ratelimit";
import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";
import { resolveCheckout } from "@/lib/billing/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/checkout/quote
 *
 * What a given package, cycle, set of add-ons and coupon code would cost.
 *
 * This exists so a checkout screen never computes a price. The number a buyer
 * reads and the number Stripe charges come out of the same call, and the browser
 * is never told a figure it could edit. It replaces the site-side preview route,
 * which reached into Postgres to do the same job.
 *
 * Never public, and the reason is worth stating rather than assuming. Read what
 * this answers to an anonymous caller: it takes a code and says whether that code
 * is real and what it takes off. That is a coupon oracle. Left open, a script
 * walks LAUNCH50, SUMMER25 and every other guessable string and comes away with a
 * working list of every live discount on the platform, which is money rather than
 * data. So it carries its own scope, `checkout:quote`, and an anonymous caller is
 * refused before any of the logic below runs.
 *
 * Nothing here redeems anything. A quote has no side effect on a coupon's
 * remaining redemptions; only creating a subscription does.
 */

/* Two budgets, not one, and they measure different things.
 *
 * A real buyer flips through cycles and ticks add-ons a dozen times while making
 * up their mind, and must never see a refusal for it. Presenting many distinct
 * codes is a different activity with only one plausible purpose, so codes get
 * their own much stricter allowance. */
const QUOTE_BUDGET = { limit: 120, windowSeconds: 60 };
const CODE_BUDGET = { limit: 12, windowSeconds: 60 };

type Body = {
  plan?: string;
  cycle?: string;
  code?: string | null;
  noDiscount?: boolean;
  addons?: string[];
};

export async function POST(request: Request) {
  const auth = await authenticate(request, "checkout:quote");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return apiError(
      { status: 400, code: "malformed_body", message: "That request body is not JSON." },
      auth.origin
    );
  }

  /*
   * Metered per key and per caller IP together, so one site's runaway loop
   * cannot spend another site's allowance, and a single key handed to many
   * browsers still meters each of them.
   */
  const bucket = `${auth.caller.keyId ?? auth.caller.site.id}:${clientIp(request)}`;

  const overall = await spend(`v1:quote:${bucket}`, QUOTE_BUDGET);
  if (!overall.ok) {
    return apiError(
      {
        status: 429,
        code: "rate_limited",
        message: "Too many quotes. Give it a moment.",
      },
      auth.origin
    );
  }

  if (body.code) {
    const codes = await spend(`v1:quote:code:${bucket}`, CODE_BUDGET);
    if (!codes.ok) {
      /* Deliberately not "that code was wrong". Saying which of the two things
         happened would tell a guessing run to slow down rather than stop, and
         tell it exactly how much to slow down by. */
      return apiError(
        {
          status: 429,
          code: "rate_limited",
          message: "Too many code attempts. Wait a minute, or ask us to apply it.",
        },
        auth.origin
      );
    }
  }

  try {
    const r = await resolveCheckout(body.plan ?? "", body.cycle ?? "monthly", body.code, {
      skipAutoDiscount: Boolean(body.noDiscount),
      addonKeys: body.addons ?? [],
    });

    return apiJson(
      {
        site: auth.caller.site.key,
        /* Cents throughout, said in the field names, because a float here is how
           a $597 plan becomes $596.99 in somebody's currency formatter.
           No Stripe identifiers: a price id or a coupon id on this response
           would let a caller assemble its own charge against this account. */
        list_total: r.listTotal,
        total: r.total,
        saving: r.listTotal - r.total,
        addon_total: r.addons.reduce((sum, a) => sum + a.amount, 0),
        due_today: r.dueToday,
        addons: r.addons.map((a) => ({ key: a.key, name: a.name, amount: a.amount })),
        coupon: r.coupon ? { code: r.coupon.code, percent_off: r.coupon.percentOff } : null,
        auto_applied: r.autoApplied,
        /* A code was typed and did not survive validation. The screen says so
           rather than silently charging list price and hoping nobody notices. */
        code_rejected: Boolean(body.code) && !r.coupon,
      },
      {
        caller: auth.caller,
        origin: auth.origin,
        headers: limitHeaders(overall),
      }
    );
  } catch (err) {
    return apiError(
      {
        status: 400,
        code: "unknown_package",
        message: err instanceof Error ? err.message : "Unknown package.",
      },
      auth.origin
    );
  }
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
