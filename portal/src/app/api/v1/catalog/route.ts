import { createServiceClient } from "@/lib/core/supabase/service";
import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/catalog
 *
 * What is for sale: the plans, what each one entitles a client to, and the price
 * of every plan and billing cycle on every rate card.
 *
 * This exists because the alternative is a pricing page with the numbers typed
 * into it. That page is always eventually wrong, and it is wrong in the most
 * expensive possible direction, because the number a buyer read is the number
 * they expect to be charged. Rendering from here means a price changes in one
 * place and every integrated website agrees with checkout the same day.
 *
 * The catalogue is not site-scoped, and that is a deliberate property of this
 * platform rather than an oversight. Every site resells the same delivery
 * service, so there is one set of plans and one set of prices; what differs per
 * site is the brand around them. A site that ever needs its own catalogue is a
 * schema change and a bigger decision than an endpoint.
 *
 * Inactive rows are omitted rather than flagged. A caller rendering a pricing
 * page wants what it can sell; a retired plan on that page is a support ticket.
 */
/**
 * `?plan=<key>` additionally returns everything a checkout screen needs for that
 * one package: its selling copy, the add-ons it may be offered, and the standing
 * discount on every cycle.
 *
 * Those three used to be three direct queries in the website's own checkout
 * page, against a database it should never have been holding a key to. Folding
 * them in here is what let that page become an ordinary consumer of this API,
 * and it costs an unfiltered caller nothing: without the parameter the response
 * is exactly what it was.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, "catalog:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const db = createServiceClient();

  const wantedPlan = new URL(request.url).searchParams.get("plan")?.trim().toLowerCase() || null;

  const [plansRes, cyclesRes, cardsRes, pricesRes] = await Promise.all([
    db
      .from("plans")
      .select(
        "id, key, name, tagline, includes, sort, plan_entitlements(posts_per_month, motion_videos, platforms_max, revision_rounds, first_batch_days, customization_level, monthly_call)"
      )
      .eq("is_active", true)
      .order("sort"),
    db.from("billing_cycles").select("key, months, label, sort").order("sort"),
    db.from("rate_cards").select("key, label, active_from, active_to, sort").eq("is_active", true).order("sort"),
    db
      .from("plan_prices")
      .select("plan_id, cycle_key, rate_card_key, discount_pct, monthly_amount, total_amount, currency")
      .eq("is_active", true),
  ]);

  if (plansRes.error || cyclesRes.error || cardsRes.error || pricesRes.error) {
    return apiError(
      { status: 503, code: "unavailable", message: "The catalogue could not be read." },
      auth.origin
    );
  }

  /* Prices are grouped under their plan rather than returned as a flat list with
     ids in it. A caller rendering a plan card should not have to build this index
     itself, and plan_id is an internal identifier that no integrator should be
     joining on in the first place. */
  const pricesByPlan = new Map<string, Record<string, unknown>[]>();
  for (const price of pricesRes.data ?? []) {
    const planId = price.plan_id as string;
    const list = pricesByPlan.get(planId) ?? [];
    list.push({
      cycle: price.cycle_key,
      rate_card: price.rate_card_key,
      /* Cents, stated in the field name, because a float here is how a $597 plan
         becomes $596.99 in somebody's currency formatter. */
      monthly_amount_cents: price.monthly_amount,
      total_amount_cents: price.total_amount,
      discount_pct: Number(price.discount_pct),
      currency: price.currency,
    });
    pricesByPlan.set(planId, list);
  }

  const plans = (plansRes.data ?? []).map((plan) => {
    const raw = plan.plan_entitlements;
    const ent = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;

    return {
      key: plan.key,
      name: plan.name,
      tagline: plan.tagline ?? null,
      /* The selling bullets, stored as written in the console. Shape is the
         caller's to interpret: an array of { text, highlight? }. */
      includes: plan.includes ?? [],
      entitlements: ent
        ? {
            posts_per_month: ent.posts_per_month,
            motion_videos: ent.motion_videos,
            platforms_max: ent.platforms_max,
            /* Null is unlimited, not zero, and the field name says so because a
               consumer defaulting a null to 0 would advertise the opposite of
               what the top tier actually sells. */
            revision_rounds: ent.revision_rounds,
            first_batch_days: ent.first_batch_days,
            customization_level: ent.customization_level,
            monthly_call: ent.monthly_call,
          }
        : null,
      prices: pricesByPlan.get(plan.id as string) ?? [],
    };
  });

  /*
   * The per-plan extras, fetched only when a plan was named.
   *
   * add_ons is filtered by applies_to_plans here rather than returned whole and
   * filtered by the caller, because "which extras may this package be sold" is a
   * rule of the offer and not a display concern. A rush is offered on Starter and
   * Growth only, since Scale already ships in five days on a priority queue and
   * charging it for speed it already has would be a con. A caller that filtered
   * this itself would be one refactor away from selling it anyway.
   */
  let addons: { key: string; name: string; description: string; amount: number }[] = [];
  let discounts: { cycle: string; percent_off: number }[] = [];

  if (wantedPlan) {
    const [addonsRes, discountsRes] = await Promise.all([
      db
        .from("addons")
        .select("key, name, description, amount, applies_to_plans")
        .eq("is_active", true)
        .not("stripe_price_id", "is", null)
        .order("sort"),
      /* The standing offer per cycle, so a price ladder can render every rung
         without a round trip for each one. */
      db
        .from("coupons")
        .select("cycle_key, percent_off")
        .eq("kind", "launch")
        .eq("auto_apply", true)
        .eq("is_active", true),
    ]);

    addons = (addonsRes.data ?? [])
      .filter((a) => {
        const applies = (a.applies_to_plans as string[] | null) ?? [];
        return applies.length === 0 || applies.includes(wantedPlan);
      })
      .map((a) => ({
        key: a.key as string,
        name: a.name as string,
        description: (a.description as string) ?? "",
        amount: a.amount as number,
      }));

    discounts = (discountsRes.data ?? []).map((d) => ({
      cycle: d.cycle_key as string,
      percent_off: Number(d.percent_off),
    }));
  }

  return apiJson(
    {
      site: auth.caller.site.key,
      checkout_url: auth.caller.site.checkoutUrl,
      ...(wantedPlan ? { add_ons: addons, standing_discounts: discounts } : {}),
      cycles: (cyclesRes.data ?? []).map((c) => ({
        key: c.key,
        months: c.months,
        label: c.label,
      })),
      rate_cards: (cardsRes.data ?? []).map((c) => ({
        key: c.key,
        label: c.label,
        active_from: c.active_from,
        active_to: c.active_to,
      })),
      plans,
    },
    { caller: auth.caller, origin: auth.origin }
  );
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
