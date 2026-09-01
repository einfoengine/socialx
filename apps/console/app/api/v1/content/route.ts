import { createServiceClient } from "@socialx/core/supabase/service";
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
 * The scoping that matters, public callers see only public entries, is the
 * eq() below rather than a policy.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, "content:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const db = createServiceClient();
  let query = db
    .from("site_content")
    .select("key, description, is_public, updated_at")
    .order("key");

  if (auth.caller.publicOnly) query = query.eq("is_public", true);

  const { data, error } = await query;
  if (error) {
    return apiError(
      { status: 503, code: "unavailable", message: "Content could not be read." },
      auth.origin
    );
  }

  return apiJson(
    {
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
