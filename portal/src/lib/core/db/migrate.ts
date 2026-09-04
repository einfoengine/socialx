import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";

import { withCandidate } from "./pool";
import type { DatabaseConfig } from "../config";

/**
 * Applying the schema, from inside the application.
 *
 * `scripts/db.mjs` already does this from a terminal, and it stays: an operator
 * who deploys with DATABASE_URL set and never opens a browser needs a command,
 * not a screen. This is the same job reachable from the setup flow, because the
 * install path this product is built for is "clone it, run it, open it", and
 * telling somebody at that point to go back to a terminal and run a second
 * command is the step where installs get abandoned.
 *
 * The two share the directory and the ledger rather than the code. Duplicating
 * about forty lines is the smaller cost: `db.mjs` runs on plain node with no
 * bundler and no TypeScript, and making one of them import the other would mean
 * either a build step for the script or a runtime dependency on node's type
 * stripping from the application.
 *
 * Everything here runs on a caller-supplied connection rather than the pool.
 * During setup the pool may not exist yet, and the connection being migrated is
 * a candidate the operator has not committed to.
 */

/** Where the SQL lives, relative to the app root. */
const MIGRATIONS_DIR = "db/migrations";

export type MigrationResult = {
  applied: string[];
  skipped: string[];
  /** Set when a file failed. Everything after it was not attempted. */
  failure: { file: string; message: string } | null;
};

function migrationFiles(appRoot: string): string[] {
  return readdirSync(join(appRoot, MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * The ledger.
 *
 * Keyed on filename, not on a checksum or an ordinal. Filename is what the
 * operator sees, what the directory sorts by, and what a person means when they
 * ask whether 0031 has run. A checksum would additionally catch a migration
 * edited after it applied, which is worth having and is not worth the failure
 * mode: a whitespace change to an applied file would refuse to deploy.
 */
async function ensureLedger(client: pg.Client): Promise<void> {
  await client.query(`
    create table if not exists schema_migrations (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    )
  `);
}

/**
 * Applies every migration that has not run yet.
 *
 * Each file runs in its own transaction, so a failure rolls that file back
 * cleanly and leaves the ones before it applied. That is deliberate rather than
 * a compromise: wrapping the whole run in one transaction would mean a failure
 * on file thirty discards twenty-nine successful ones, and re-running from
 * scratch on a database that is now half-built is worse than stopping where the
 * problem is and saying which file it was.
 *
 * Never throws for a SQL error. The setup screen has to render the failure next
 * to the connection string that produced it, and an exception crossing a server
 * action boundary arrives at the browser as an unhelpful digest.
 */
export async function migrate(
  config: DatabaseConfig,
  appRoot: string = process.cwd()
): Promise<MigrationResult> {
  const result: MigrationResult = { applied: [], skipped: [], failure: null };

  return withCandidate(config, async (client) => {
    /*
     * One migration run at a time, across every process on every machine.
     *
     * Without this, two deploys starting together both read an empty ledger and
     * both try to create the same table. One wins, the other fails partway, and
     * the operator is left with a database in a state neither run intended. It
     * is not hypothetical: a rolling deploy of two replicas does exactly this,
     * and so does an impatient person running the command twice.
     *
     * A session-level advisory lock is the right instrument because it is held
     * by the connection and released when the connection ends, including when
     * the process is killed. There is no lock row to clean up afterwards and no
     * way to leave the schema locked by crashing.
     *
     * The number is arbitrary but must be stable: it is the identity of "the
     * migration lock for this application" and any other value is a different
     * lock protecting nothing.
     */
    const LOCK = 8_314_907_112_004_551;

    const { rows: locked } = await client.query<{ got: boolean }>(
      "select pg_try_advisory_lock($1) as got",
      [LOCK]
    );

    if (!locked[0]?.got) {
      result.failure = {
        file: "(lock)",
        message:
          "Another migration run is already in progress on this database. Wait for it to finish, then try again.",
      };
      return result;
    }

    try {
      return await applyAll(client, appRoot, result);
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => undefined);
    }
  });
}

/** The run itself, once the lock is held. */
async function applyAll(
  client: pg.Client,
  appRoot: string,
  result: MigrationResult
): Promise<MigrationResult> {
  {
    await ensureLedger(client);

    const { rows } = await client.query<{ filename: string }>(
      "select filename from schema_migrations"
    );
    const done = new Set(rows.map((r) => r.filename));

    for (const file of migrationFiles(appRoot)) {
      if (done.has(file)) {
        result.skipped.push(file);
        continue;
      }

      const sql = readFileSync(join(appRoot, MIGRATIONS_DIR, file), "utf8");

      try {
        await client.query("begin");
        await client.query(sql);
        await client.query(
          "insert into schema_migrations (filename) values ($1) on conflict do nothing",
          [file]
        );
        await client.query("commit");
        result.applied.push(file);
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        result.failure = {
          file,
          message: error instanceof Error ? error.message : String(error),
        };
        /* Stop rather than continue. Migrations depend on the ones before them,
           so carrying on after a failure produces a cascade of errors that bury
           the one that actually matters. */
        break;
      }
    }

    return result;
  }
}

/** How many migrations are waiting, without applying any. */
export async function pending(
  config: DatabaseConfig,
  appRoot: string = process.cwd()
): Promise<number> {
  return withCandidate(config, async (client) => {
    await ensureLedger(client);
    const { rows } = await client.query<{ filename: string }>(
      "select filename from schema_migrations"
    );
    const done = new Set(rows.map((r) => r.filename));
    return migrationFiles(appRoot).filter((f) => !done.has(f)).length;
  });
}

/**
 * The oldest PostgreSQL this schema runs on.
 *
 * 13 rather than something older for one concrete reason: `gen_random_uuid()`
 * moved into core in 13, and every table in this schema defaults its primary key
 * to it. On 12 and below it needs the pgcrypto extension, which a managed
 * provider may not permit installing, so the install would fail on the first
 * migration with an error about a missing function rather than about the version.
 */
const MIN_MAJOR = 13;

export type Probe = {
  ok: boolean;
  /** Server version, when the connection succeeded. */
  version?: string;
  /** Parsed major version, for the minimum check. */
  major?: number;
  /** The role the connection string authenticates as. */
  role?: string;
  /** True when that role is exempt from row level security. */
  privileged?: boolean;
  canCreateSchema?: boolean;
  error?: string;
};

/**
 * Tests a connection string before anything is written to disk.
 *
 * Reports three separate things, because they fail for different reasons and
 * need different advice:
 *
 *   Reachability. Wrong host, wrong password, a firewall, TLS refused.
 *
 *   Whether the role can create tables. Migrations are DDL; a connection with
 *   only DML rights connects perfectly and then fails on the first file, which
 *   looks like a broken migration rather than a permissions problem.
 *
 *   Whether the role is exempt from row level security. This is the one worth
 *   the most care, because it is invisible: a superuser connection works, every
 *   screen renders, and tenant isolation is simply not applied. Postgres reports
 *   no error for it, ever. Detecting it here is the only place the operator will
 *   be told.
 */
export async function probe(config: DatabaseConfig): Promise<Probe> {
  try {
    return await withCandidate(config, async (client) => {
      /* `pg_roles` and `has_schema_privilege` are Postgres catalog objects, so a
         connection to something that merely speaks a similar dialect fails here
         rather than halfway through the migrations. */
      const { rows } = await client.query(`
        select version() as version,
               current_setting('server_version_num')::int as version_num,
               current_user as role,
               coalesce((select rolsuper or rolbypassrls
                           from pg_roles where rolname = current_user), false) as privileged,
               has_schema_privilege(current_user, 'public', 'CREATE') as can_create
      `);
      const row = rows[0] as {
        version: string; version_num: number; role: string;
        privileged: boolean; can_create: boolean;
      };

      const major = Math.floor(row.version_num / 10000);

      if (major < MIN_MAJOR) {
        return {
          ok: false,
          major,
          version: row.version.split(" ").slice(0, 2).join(" "),
          error: `This is PostgreSQL ${major}. The portal needs ${MIN_MAJOR} or later: every table defaults its primary key to gen_random_uuid(), which is only in core from 13 onwards.`,
        };
      }

      return {
        ok: true,
        major,
        /* Just the release, not the whole build banner with the compiler in it. */
        version: row.version.split(" ").slice(0, 2).join(" "),
        role: row.role,
        privileged: row.privileged,
        canCreateSchema: row.can_create,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error: friendlyError(error),
    };
  }
}

/**
 * Turns a driver error into something an operator can act on.
 *
 * The raw messages are accurate and unhelpful. "self signed certificate in
 * certificate chain" is the single most common first-attempt failure against a
 * managed provider, and the fix is one setting rather than anything to do with
 * the connection string, so it is worth saying so directly.
 */
function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/self.signed certificate|unable to verify the first certificate/i.test(message)) {
    return "The server's TLS certificate could not be verified. Many managed providers use a self-signed certificate: set the SSL mode to 'no-verify'.";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return "That host could not be resolved. Check the hostname in the connection string.";
  }
  if (/ECONNREFUSED/i.test(message)) {
    return "The connection was refused. Check the port, and that the server accepts connections from this machine.";
  }
  if (/ETIMEDOUT|timeout/i.test(message)) {
    return "The connection timed out. A firewall or an IP allowlist is the usual cause.";
  }
  if (/password authentication failed|SASL/i.test(message)) {
    return "The username or password was rejected.";
  }
  if (/database .* does not exist/i.test(message)) {
    return message + ". Create it first, or point at one that exists.";
  }
  if (/no pg_hba\.conf entry/i.test(message)) {
    return "The server refused this connection's SSL mode. Try switching between 'verify' and 'disable'.";
  }

  /*
   * Not a Postgres server at all.
   *
   * Worth catching explicitly, because the failure is otherwise baffling: the
   * driver speaks the Postgres wire protocol at something that does not, and the
   * error is about a malformed packet rather than about the obvious mistake. The
   * portal is Postgres-only and says so here rather than letting somebody spend
   * an afternoon on it.
   */
  if (/parse|protocol|Unexpected|invalid message|not a valid|ECONNRESET/i.test(message)) {
    return `${message}. If this is MySQL, MariaDB, SQLite or SQL Server, that is the problem: the portal is PostgreSQL only. Its entire authorization model is Postgres row level security, which no other engine provides.`;
  }

  return message;
}
