import "server-only";

import { hasDatabase } from "./config";
import { isInstalled } from "./install";

/**
 * What state this installation is in, and what the operator has to do next.
 *
 * There was a setup wizard here, with a form for the connection string and a
 * one-time token to stop a stranger reaching it first. Both are gone, and the
 * reasoning is worth keeping because it argues against the obvious design.
 *
 * A form that writes the database connection is wrong for the deployments this
 * product actually has to survive. The config file it writes lives on one
 * instance's local disk, so a second instance never sees it and an autoscaled
 * one comes up blank. Container filesystems are frequently read-only, so the
 * write fails outright. And every real secret manager, Vault, Doppler, AWS
 * Secrets Manager, injects environment variables, so on any serious deployment
 * the form is bypassed anyway.
 *
 * That leaves it useful only on a single box, which is exactly where editing one
 * line of a dotfile was never the hard part. It was an attack surface bought for
 * nothing.
 *
 * So configuration comes from the environment, the way configuration does. This
 * module's whole job is now to answer "where is this install stuck" so the page
 * at /setup can print the specific next command rather than a wall of
 * documentation.
 */

export type SetupStage =
  /** No connection string. Nothing works until DATABASE_URL is set. */
  | "database"
  /** Connected, but the schema is not applied yet. */
  | "schema"
  /** Migrated, but nobody can sign in. Resolved on the next server start. */
  | "owner"
  /** Ready. */
  | "done";

/**
 * Where this install is.
 *
 * Both inputs are passed in rather than read here, and that is deliberate: this
 * module has to work when there is no database at all, which is the entire first
 * stage. Asking a database whether it has been migrated is not something the
 * "there is no database" branch can do.
 */
export function stageOf(input: {
  pendingMigrations: number | null;
  hasOwner: boolean;
}): SetupStage {
  if (!hasDatabase()) return "database";
  /* Null means the question could not be answered, which on a configured install
     means the database is unreachable. Reporting "schema" is the honest answer:
     the operator's next move is to look at the connection either way. */
  if (input.pendingMigrations === null || input.pendingMigrations > 0) return "schema";
  if (!input.hasOwner) return "owner";
  return "done";
}

/** True when a request should be sent to the instructions page. */
export async function needsSetup(): Promise<boolean> {
  return !(await isInstalled());
}
