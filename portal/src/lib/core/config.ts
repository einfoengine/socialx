import "server-only";

import { readFileSync } from "node:fs";

/**
 * Everything this installation needs to reach its database.
 *
 * Read from the environment, and only from the environment. There is no config
 * file and nothing here writes to disk, which is a deliberate reversal: an
 * earlier version had a setup form writing `config/portal.json`, and that is
 * wrong for every deployment that is not a single box. A file on one instance's
 * local disk is invisible to the second instance, absent on an autoscaled one,
 * and impossible on a read-only container filesystem. Every secret manager worth
 * using injects environment variables, so the file was bypassed on any serious
 * deployment anyway.
 *
 * Read through the accessors rather than at module scope. Every database client
 * in this codebase is built lazily inside the function that uses it, so nothing
 * captures a value at import time and a restart is the only thing needed to pick
 * up a change.
 *
 * ---
 *
 * Two connections, not one, and this is the part most installs get wrong.
 *
 * The application and the migration runner want opposite things from a database
 * role. Migrations create tables, so they need DDL. The application must never
 * have DDL, and more importantly must not be a superuser or table owner, because
 * Postgres exempts those from every row level security policy silently. One URL
 * doing both jobs means either the migrations cannot run or the application is
 * exempt from its own security model.
 *
 *   DATABASE_URL             the application. portal_app. No DDL, no exemption.
 *   MIGRATION_DATABASE_URL   migrations. An owner or admin role.
 *
 * MIGRATION_DATABASE_URL falls back to DATABASE_URL, because on a first install
 * there is no portal_app yet: the role is created by the migrations themselves.
 * The expected sequence is to point both at an owner connection, migrate, then
 * narrow DATABASE_URL to portal_app and restart.
 */

export type SslMode =
  /** Verify against the system CA store, or DATABASE_CA_CERT when given. */
  | "verify"
  /** Encrypt without verifying. A downgrade; prefer supplying the CA. */
  | "no-verify"
  /** No TLS. Only correct over a loopback or a private network you trust. */
  | "disable";

export type DatabaseConfig = {
  url: string;
  ssl: SslMode;
  /** PEM for the provider's certificate authority, when verifying against one. */
  caCert: string | null;
  poolMax: number;
  /** Milliseconds a single statement may run before the server cancels it. */
  statementTimeoutMs: number;
  /** Milliseconds a transaction may sit idle before the server ends it. */
  idleTransactionTimeoutMs: number;
};

/* ---------------- reading the environment ---------------- */

/**
 * A value, or the contents of the file a `_FILE` variant points at.
 *
 * Docker secrets and Kubernetes both mount secrets as files and expect the
 * application to read them, because a value in an environment variable is
 * visible in `docker inspect`, in `/proc/<pid>/environ`, and in a crash dump.
 * Supporting the convention costs six lines and is the difference between
 * working with a secret manager and working around one.
 */
function env(name: string): string {
  const fromFile = (process.env[`${name}_FILE`] ?? "").trim();
  if (fromFile) {
    try {
      return readFileSync(fromFile, "utf8").trim();
    } catch {
      /* A named secret file that cannot be read is a deployment error, but
         throwing here would take down the page that explains it. Falling through
         to the plain variable, and then to "unconfigured", surfaces it as the
         setup screen rather than a crash. */
    }
  }
  return (process.env[name] ?? "").trim();
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const text = env(name);
  /* Emptiness has to be checked before Number(), because Number("") is 0 rather
     than NaN. Without this an unset variable is not "use the default", it is
     "use zero", which then clamps to the minimum. That is how an unset statement
     timeout became one second instead of fifteen. */
  if (!text) return fallback;

  const raw = Number(text);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), min), max);
}

function sslMode(): SslMode {
  const raw = env("DATABASE_SSL").toLowerCase();
  return raw === "disable" || raw === "no-verify" || raw === "verify" ? raw : "verify";
}

/**
 * The provider's CA certificate, when one is supplied.
 *
 * This is the correct fix for the error that sends most people to
 * `no-verify`. DigitalOcean, RDS, Azure and Aiven all publish a CA bundle;
 * supplying it means the connection is both encrypted and authenticated, which
 * `no-verify` is not. `no-verify` encrypts and then trusts whoever answered,
 * which stops passive eavesdropping and not an active attacker.
 */
function caCert(): string | null {
  const inline = env("DATABASE_CA_CERT");
  if (inline) return inline.includes("BEGIN CERTIFICATE") ? inline : null;
  return null;
}

function buildConfig(url: string): DatabaseConfig {
  return {
    url,
    ssl: sslMode(),
    caCert: caCert(),
    poolMax: intEnv("DATABASE_POOL_MAX", 10, 1, 100),
    /*
     * Fifteen seconds. Long enough for the slowest legitimate report on this
     * schema, short enough that a runaway query cannot hold a pooled connection
     * until the pool is empty and every request is queued behind it. Without
     * this, one bad query takes the whole portal down rather than one request.
     */
    statementTimeoutMs: intEnv("DATABASE_STATEMENT_TIMEOUT_MS", 15_000, 1_000, 600_000),
    /*
     * Thirty seconds. Guards the worse version of the same failure: a
     * transaction left open by a request that died holds its locks, and other
     * writers block on it indefinitely. Postgres ends it instead.
     */
    idleTransactionTimeoutMs: intEnv("DATABASE_IDLE_TX_TIMEOUT_MS", 30_000, 1_000, 600_000),
  };
}

/* ---------------- the two connections ---------------- */

/** The connection the application serves requests on, or null when unset. */
export function databaseConfig(): DatabaseConfig | null {
  /* POSTGRES_URL is accepted because Vercel and a few others set that name. */
  const url = env("DATABASE_URL") || env("POSTGRES_URL");
  return url ? buildConfig(url) : null;
}

/**
 * The connection migrations run on.
 *
 * Falls back to the application's, because on a first install portal_app does
 * not exist yet: it is created by migration 0031. Pointing both at an owner
 * connection, migrating, then narrowing DATABASE_URL is the expected sequence.
 */
export function migrationConfig(): DatabaseConfig | null {
  const url = env("MIGRATION_DATABASE_URL");
  if (url) return buildConfig(url);
  return databaseConfig();
}

/** Is there a connection string at all? */
export function hasDatabase(): boolean {
  return databaseConfig() !== null;
}

/** True when migrations are configured to run on a different role than serving. */
export function hasSeparateMigrationRole(): boolean {
  return Boolean(env("MIGRATION_DATABASE_URL"));
}
