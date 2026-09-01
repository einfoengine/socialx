import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me
 *
 * What this credential is and what it may do. Nothing here is secret: it is the
 * key's own name, scopes and origin list read back to whoever already holds it.
 *
 * It exists because the first question after wiring up a key is always "is it
 * even reaching the right place", and answering that against a real endpoint
 * mixes the credential question up with whatever else that endpoint does. This
 * one has no other job.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, "content:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  return apiJson(
    {
      authenticated: auth.caller.kind === "key",
      name: auth.caller.name,
      scopes: auth.caller.scopes,
      allowed_origins: auth.caller.allowedOrigins,
      public_only: auth.caller.publicOnly,
    },
    { caller: auth.caller, origin: auth.origin }
  );
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
