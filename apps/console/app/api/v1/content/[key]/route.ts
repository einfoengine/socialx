import { createServiceClient } from "@socialx/core/supabase/service";
import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

/* The same ceiling the console enforces on a paste. Stated in both places
   because a write that arrives over the API never passes through that form. */
const MAX_BYTES = 256 * 1024;

/**
 * GET /api/v1/content/{key}
 *
 * One entry, with its JSON.
 *
 * A private entry answers 404 rather than 403 to a public caller. That is the
 * deliberate choice: a 403 would confirm the key exists, which turns this route
 * into a way to enumerate what socialX has not published yet. To a caller with
 * no credential, a private entry is indistinguishable from one that was never
 * created.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/content/[key]">) {
  const auth = await authenticate(request, "content:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const { key } = await ctx.params;
  if (!KEY_RE.test(key)) {
    return apiError(
      { status: 400, code: "bad_key", message: "That is not a content key." },
      auth.origin
    );
  }

  const db = createServiceClient();
  let query = db
    .from("site_content")
    .select("key, data, description, is_public, updated_at")
    .eq("key", key);

  if (auth.caller.publicOnly) query = query.eq("is_public", true);

  const { data, error } = await query.maybeSingle();
  if (error) {
    return apiError(
      { status: 503, code: "unavailable", message: "Content could not be read." },
      auth.origin
    );
  }
  if (!data) {
    return apiError(
      { status: 404, code: "not_found", message: `No entry named "${key}".` },
      auth.origin
    );
  }

  return apiJson(
    {
      key: data.key,
      data: data.data,
      description: data.description,
      public: data.is_public,
      updated_at: data.updated_at,
    },
    { caller: auth.caller, origin: auth.origin }
  );
}

/**
 * PUT /api/v1/content/{key}
 *
 * Replaces an entry's JSON body. Needs the content:write scope, which no public
 * caller can hold.
 *
 * Deliberately narrow. It cannot create an entry, cannot delete one, and cannot
 * change is_public. Creating and publishing are decisions with a blast radius on
 * the marketing site, so they stay in the console where a person makes them.
 * What this is for is the case that actually recurs: a value that some other
 * system already knows and should keep up to date on its own.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/content/[key]">) {
  const auth = await authenticate(request, "content:write");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const { key } = await ctx.params;
  if (!KEY_RE.test(key)) {
    return apiError(
      { status: 400, code: "bad_key", message: "That is not a content key." },
      auth.origin
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BYTES) {
    return apiError(
      { status: 413, code: "too_large", message: `An entry is capped at ${MAX_BYTES / 1024}KB.` },
      auth.origin
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return apiError(
      { status: 400, code: "bad_json", message: "The request body is not valid JSON." },
      auth.origin
    );
  }

  /* Accept either { "data": ... } or the blob on its own, because both readings
     of "PUT the content" are reasonable and guessing wrong costs an integrator
     an afternoon. An object carrying a data key is treated as the envelope. */
  const payload =
    body !== null && typeof body === "object" && !Array.isArray(body) && "data" in body
      ? (body as { data: unknown }).data
      : body;

  const db = createServiceClient();
  const { error, count } = await db
    .from("site_content")
    .update({ data: payload, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("key", key);

  if (error) {
    return apiError(
      { status: 503, code: "unavailable", message: "The entry could not be written." },
      auth.origin
    );
  }
  if (!count) {
    return apiError(
      {
        status: 404,
        code: "not_found",
        message: `No entry named "${key}". Create it in the console first.`,
      },
      auth.origin
    );
  }

  return apiJson({ key, written: true }, { caller: auth.caller, origin: auth.origin });
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
