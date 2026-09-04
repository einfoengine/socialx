import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me
 *
 * What this credential is, what it may do, and which site it speaks for. Nothing
 * here is secret: it is the key's own name, scopes and origin list read back to
 * whoever already holds it.
 *
 * It exists because the first two questions after wiring up a key are always "is
 * it even reaching the right place" and "whose data am I about to get", and
 * answering either against a real endpoint mixes the credential question up with
 * whatever else that endpoint does. This one has no other job.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, "content:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const { caller } = auth;

  return apiJson(
    {
      authenticated: caller.kind === "key",
      name: caller.name,
      scopes: caller.scopes,
      allowed_origins: caller.allowedOrigins,
      public_only: caller.publicOnly,
      /* The site is echoed back on purpose. A key pasted into the wrong
         environment authenticates perfectly and then reads somebody else's
         content, and this is the one line that makes that obvious. */
      site: { key: caller.site.key, name: caller.site.name },
    },
    { caller, origin: auth.origin }
  );
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
