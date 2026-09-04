import { createServiceClient } from "@/lib/core/supabase/service";
import { authorizedCron, cronRefusal } from "@/lib/api/cron";
import { externalCollectionEnabled, importBillingFeed } from "@/lib/billing/external";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Bounded, so one invocation cannot run past its own timeout. A site that does
   not get its turn this tick gets it on the next one, and the sync history is
   where falling behind is visible. */
const SITES_PER_RUN = 20;

/**
 * The billing import, on a schedule.
 *
 * Fetch now on a site record covers the case where somebody is watching. This
 * covers the other 23 hours: a client who cancelled last night, an invoice paid
 * this morning, a card that failed over the weekend. Without something calling
 * this, "billing is imported from your feed" is a button rather than a feature,
 * and the portal shows whatever was true the last time an operator happened to
 * press it.
 *
 * Hourly is the shape this was built for. More often than that is polling
 * somebody else's system for changes that mostly did not happen; less often and
 * a client sees a payment they made yesterday still missing today.
 *
 * Under /api/internal, like the webhook drain: not versioned, not part of the
 * integration surface, no API key opens it, and the same CRON_SECRET.
 */
async function run(request: Request): Promise<Response> {
  if (!authorizedCron(request)) return cronRefusal();

  /* The platform switch is read first so that turning it off actually stops the
     outbound requests, rather than stopping them one site at a time inside
     twenty imports that each had to reach a database to find out. */
  if (!(await externalCollectionEnabled())) {
    return Response.json(
      { ran: 0, skipped: "external collection is switched off platform-wide" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const db = createServiceClient();

  /* cross-site: the scheduler is the one caller with no site of its own. It
     exists to visit every site that has asked to be visited. */
  const { data: sites } = await db
    .from("sites")
    .select("id, key")
    .eq("status", "active")
    .eq("payment_collection", "external")
    .not("billing_feed_url", "is", null)
    .order("key")
    .limit(SITES_PER_RUN);

  const results = [];
  for (const site of sites ?? []) {
    /* Sequential rather than in parallel. These are outbound requests to other
       people's systems on a schedule nobody is watching, and twenty at once is
       how a scheduled job turns into something an integrator notices. */
    const summary = await importBillingFeed({ siteId: site.id as string, kind: "schedule" });
    results.push({
      site: site.key,
      ok: summary.ok,
      subscriptions: summary.subscriptionsWritten,
      invoices: summary.invoicesWritten,
      skipped: summary.skipped,
      error: summary.error,
    });
  }

  return Response.json(
    { ran: results.length, results },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

/* GET as well as POST, because most schedulers issue a GET and cannot be told
   otherwise. Importing is idempotent: every row is keyed on what the feed calls
   it, so running twice writes the same rows twice rather than two of them. */
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
