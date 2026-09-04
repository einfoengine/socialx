import { createServiceClient } from "@/lib/core/supabase/service";
import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Paged, because a site with a thousand clients asking for all of them once a
   minute is a slow endpoint for everybody including itself. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/v1/orders
 *
 * This site's subscriptions: who bought, on what plan, and what state their
 * billing is in.
 *
 * The reason this is worth an endpoint rather than a webhook alone: webhooks tell
 * you what changed, and a website that has been down, or that is being built
 * today against six months of existing customers, needs what is true. Events for
 * the delta, this for the state. Integrations that have only one of the two end
 * up reconstructing the other badly.
 *
 * Scoped to the site through the buying organization, which is where the
 * relationship actually lives. A subscription has no site of its own: it belongs
 * to an org, and the org was sold by a site. Filtering on the join rather than
 * denormalizing a site_id onto subscriptions means there is one place that
 * relationship can be wrong, and moving a client between sites stays a single
 * update.
 *
 * Never public. `orders:read` cannot be held by an anonymous caller, and the
 * response carries a customer's email address.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, "orders:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const params = new URL(request.url).searchParams;

  const limitRaw = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const offsetRaw = Number(params.get("offset") ?? 0);
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

  const status = params.get("status");

  const db = createServiceClient();

  let query = db
    .from("subscriptions")
    .select(
      "id, status, cycle_key, rate_card_key, current_period_start, current_period_end, cancel_at_period_end, started_at, canceled_at, created_at, plans(key, name), organizations!inner(id, name, slug, status, owner_email, site_id)",
      { count: "exact" }
    )
    .eq("organizations.site_id", auth.caller.site.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;

  if (error) {
    return apiError(
      { status: 503, code: "unavailable", message: "Orders could not be read." },
      auth.origin
    );
  }

  const one = <T>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? value[0] ?? null : value;

  return apiJson(
    {
      site: auth.caller.site.key,
      total: count ?? 0,
      limit,
      offset,
      data: (data ?? []).map((row) => {
        const org = one(row.organizations as Record<string, unknown> | Record<string, unknown>[]);
        const plan = one(row.plans as Record<string, unknown> | Record<string, unknown>[]);

        return {
          id: row.id,
          status: row.status,
          plan: plan?.key ?? null,
          plan_name: plan?.name ?? null,
          cycle: row.cycle_key,
          rate_card: row.rate_card_key,
          current_period_start: row.current_period_start,
          current_period_end: row.current_period_end,
          cancel_at_period_end: row.cancel_at_period_end,
          started_at: row.started_at,
          canceled_at: row.canceled_at,
          organization: org
            ? {
                id: org.id,
                name: org.name,
                slug: org.slug,
                status: org.status,
                owner_email: org.owner_email,
              }
            : null,
        };
      }),
    },
    { caller: auth.caller, origin: auth.origin }
  );
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
