import { createServiceClient } from "@/lib/core/supabase/service";
import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/content
 *
 * The catalogue: every entry this caller may read, without the bodies. A page
 * that needs one blob should ask for it by key rather than pull the whole set
 * and throw most of it away.
 *
 * The read runs with the service role, which is correct and worth stating
 * plainly: authorization already happened in authenticate(), and site_content
 * has no anon policy for RLS to apply on an anonymous caller's behalf anyway.
 * Both pieces of scoping that matter are eq() calls below rather than policies:
 * the site, which no caller can widen, and public-only, which is what an
 * anonymous caller is limited to.
 *
 * The site filter is not an optimization and not a convenience. It is the line
 * that stops one integrated website reading another's copy, and it is applied
 * before the credential's own scopes are considered relevant.
 *
 * Paged, and the reason is not performance. An unpaged list is a single request
 * that returns the shape of everything a site has, which is the request a
 * scraper makes first and a website never makes at all: a page asks for the two
 * entries it renders. Capping the answer does not stop anyone determined, it
 * makes taking the whole index cost as many requests as it has pages, and those
 * requests are counted.
 */

/* Matches /api/v1/orders, so a caller learns one paging convention rather than
   one per endpoint. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
export async function GET(request: Request) {
  const auth = await authenticate(request, "content:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const params = new URL(request.url).searchParams;

  const limitRaw = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const offsetRaw = Number(params.get("offset") ?? 0);
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

  const db = createServiceClient();
  let query = db
    .from("site_content")
    .select("key, description, is_public, updated_at", { count: "exact" })
    .eq("site_id", auth.caller.site.id)
    .order("key")
    .range(offset, offset + limit - 1);

  if (auth.caller.publicOnly) query = query.eq("is_public", true);

  const { data, error, count } = await query;
  if (error) {
    return apiError(
      { status: 503, code: "unavailable", message: "Content could not be read." },
      auth.origin
    );
  }

  return apiJson(
    {
      site: auth.caller.site.key,
      total: count ?? 0,
      limit,
      offset,
      data: (data ?? []).map((row) => ({
        key: row.key,
        description: row.description,
        public: row.is_public,
        updated_at: row.updated_at,
      })),
    },
    { caller: auth.caller, origin: auth.origin }
  );
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
