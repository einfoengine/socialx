import "server-only";

import { hasDatabase } from "./config";

/**
 * Whether this installation is finished, asked of the database rather than a file.
 *
 * There used to be an `installedAt` timestamp in a config file on disk. That was
 * a second source of truth for something the database already knows, and the two
 * could disagree in the way that matters most: a file claiming the install was
 * finished, sitting next to a database with no accounts in it, locks the
 * operator out of their own portal with no way back in.
 *
 * So the question is asked directly. An install is finished when somebody can
 * sign in as an owner. That single condition implies everything else worth
 * checking, which is why it is the only one here: an owner row cannot exist
 * unless the schema was applied, and the schema cannot have been applied unless
 * the connection works.
 *
 * ---
 *
 * Cached, one way only.
 *
 * A `true` is cached for the life of the process and never re-checked, because
 * an installation does not become uninstalled. That makes this free on every
 * request after the first, which matters: proxy.ts calls it on every request
 * that is not a static asset.
 *
 * A `false` is never cached. An install in progress is expected to become
 * finished, usually within a minute of somebody reading the setup page, and
 * caching the negative would mean the portal kept showing setup instructions
 * until it was restarted.
 *
 * An error is also never cached, and reports "not installed". That is the
 * deliberate choice: a database that has gone down mid-life sends visitors to
 * /setup, which detects the unreachable connection and says so. The alternative,
 * assuming the install is fine, sends them to a portal where every page throws.
 * One of those explains itself.
 */

let installed = false;

export async function isInstalled(): Promise<boolean> {
  if (installed) return true;
  if (!hasDatabase()) return false;

  try {
    /* Imported here rather than at module scope so that a build with no database
       configured does not construct a pool while evaluating this module. */
    const { one } = await import("./db/sql");
    const { asSystem } = await import("./db/actor");

    const row = await asSystem("startup: check whether the install is finished", () =>
      one<{ n: number }>`
        select count(*)::int as n
          from portal_users u
          join staff_roles s on s.user_id = u.id
         where s.role = 'owner'
           and u.disabled_at is null
      `
    );

    if ((row?.n ?? 0) > 0) {
      installed = true;
      return true;
    }
    return false;
  } catch {
    /* Missing tables, unreachable server, bad credentials. All of them mean the
       same thing to a caller deciding whether to serve the portal or the
       instructions: not yet. */
    return false;
  }
}

/** Forgets a cached `true`. For tests, and for a deliberate reconfiguration. */
export function forgetInstallState(): void {
  installed = false;
}
