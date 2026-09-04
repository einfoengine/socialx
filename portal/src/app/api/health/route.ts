import { hasDatabase, hasSeparateMigrationRole, migrationConfig } from "@/lib/core/config";
import { pending } from "@/lib/core/db/migrate";
import { pool } from "@/lib/core/db/pool";
import { rlsWeakness } from "@/lib/core/db/actor";
import { isInstalled } from "@/lib/core/install";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is this installation actually working?
 *
 * Two audiences, which is why the response is shaped the way it is rather than
 * being a bare 200.
 *
 * A load balancer or orchestrator needs one bit: should traffic come here. That
 * is the status code. 200 means serve, 503 means do not, and nothing else about
 * the body matters to it.
 *
 * A person debugging at 3am needs the reason. That is the body, and it reports
 * the things that are individually true or false rather than a single verdict,
 * because "unhealthy" without a cause is a second question rather than an answer.
 *
 * ---
 *
 * Deliberately unauthenticated, and deliberately thin.
 *
 * A health check that needs a credential cannot be used by the thing that most
 * needs it, which is infrastructure that has no session. So nothing here reveals
 * anything an attacker gains from: no connection string, no host, no role name,
 * no version. The booleans say whether this portal works, which somebody can
 * already determine by loading a page.
 *
 * The one judgement call is `rls`. Reporting that a deployment is misconfigured
 * does tell an attacker the tenant isolation is off. It is reported anyway,
 * because the operator finding out is worth more than the attacker not knowing:
 * anyone who can already read another tenant's data does not need this endpoint
 * to tell them, and the operator has no other way to be told at all.
 */
export async function GET() {
  const checks: Record<string, boolean | number | string | null> = {
    configured: hasDatabase(),
    reachable: false,
    schema: null,
    installed: false,
    rls: null,
    migrationRole: hasSeparateMigrationRole() ? "separate" : "shared",
  };

  if (!checks.configured) {
    return answer(checks, 503, "No database is configured. Set DATABASE_URL.");
  }

  /* Reachability first, on the serving pool rather than a new connection, so
     this measures what requests actually experience: a pool that cannot hand
     out a connection is down even if a fresh connect would succeed. */
  try {
    const client = await pool().connect();
    try {
      await client.query("select 1");
      checks.reachable = true;
    } finally {
      client.release();
    }
  } catch (error) {
    return answer(
      checks,
      503,
      error instanceof Error ? error.message : "The database could not be reached."
    );
  }

  try {
    const outstanding = await pending(migrationConfig()!, process.cwd());
    checks.schema = outstanding === 0 ? "current" : `${outstanding} pending`;
  } catch {
    /* The migration connection may legitimately not be available at runtime: an
       operator who sets MIGRATION_DATABASE_URL only when deploying is doing the
       right thing. Unknown is not unhealthy. */
    checks.schema = "unknown";
  }

  checks.installed = await isInstalled();
  checks.rls = await rlsWeakness().catch(() => null);

  /*
   * What counts as unhealthy, and what only counts as wrong.
   *
   * An unreachable database or a portal nobody can sign into is not serving, so
   * it is a 503 and traffic should go elsewhere. A pending migration or a
   * privileged connection is a serious misconfiguration that the operator must
   * fix, but the portal is answering requests, and returning 503 for it would
   * take a working system offline to protest about its own settings.
   */
  const healthy = checks.reachable === true && checks.installed === true;

  return answer(
    checks,
    healthy ? 200 : 503,
    healthy ? null : "The portal is not finished installing. See /setup."
  );
}

function answer(
  checks: Record<string, unknown>,
  status: number,
  message: string | null
): Response {
  return Response.json(
    { ok: status === 200, ...checks, ...(message ? { message } : {}) },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        /* A monitoring endpoint in a search index is noise at best. */
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}
