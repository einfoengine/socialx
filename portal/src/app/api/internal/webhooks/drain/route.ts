import { drain } from "@/lib/core/webhooks";
import { authorizedCron, cronRefusal } from "@/lib/api/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* One batch is bounded so a scheduled invocation cannot run past its own
   timeout. Falling behind is visible in the delivery log and self-corrects on
   the next tick; a killed function mid-batch is not. */
const BATCH = 50;

/**
 * The retry engine.
 *
 * Delivery is attempted inline, in `after()`, on the request that emitted the
 * event, so an endpoint that is up hears about things immediately. This route
 * exists for every case where that attempt did not work: the receiver was
 * deploying, the network blinked, their certificate expired over a weekend.
 * Without something on a schedule, "we retry with backoff" is a comment rather
 * than a behaviour, because nothing would ever run the second attempt.
 *
 * Under /api/internal rather than /api/v1 on purpose. It is not part of the
 * integration surface, it is not versioned, no key opens it, and no integrator
 * should ever call it. Point a scheduler at it every five minutes.
 *
 * Authenticated by a shared secret rather than by an API key, because the caller
 * is infrastructure and has no site. The check itself lives in lib/api/cron.ts,
 * shared with the billing import, which runs on the same schedule and answers to
 * the same secret.
 */

async function run(request: Request): Promise<Response> {
  if (!authorizedCron(request)) return cronRefusal();

  const result = await drain({ limit: BATCH });

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/* GET as well as POST, because most schedulers, including Vercel Cron, issue a
   GET and cannot be told otherwise. Draining is idempotent in the way that
   matters: a delivered row is never picked up twice. */
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
