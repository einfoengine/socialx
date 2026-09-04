import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Who is allowed to run the scheduled work.
 *
 * The callers under /api/internal are infrastructure. They have no site, no
 * session and no API key, so the credential is a shared secret rather than
 * anything this platform issued. Two routes now depend on that being checked the
 * same way, which is one more than should have its own copy: a second
 * implementation is a second place for the constant-time comparison to quietly
 * become an ===.
 *
 * Unset means closed, not open. A deploy that forgot CRON_SECRET should stop
 * running its schedules, loudly and by doing nothing, rather than expose the
 * endpoints to whoever finds them.
 */
export function authorizedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = /^bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? "";
  /* Length first, because timingSafeEqual throws on a mismatch rather than
     returning false. The length of a secret is not the secret. */
  if (presented.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(presented, "utf8"), Buffer.from(expected, "utf8"));
}

/** The one refusal these routes give, in the shape the API uses everywhere. */
export function cronRefusal(): Response {
  return Response.json(
    { error: { code: "unauthorized", message: "This endpoint is not part of the public API." } },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
