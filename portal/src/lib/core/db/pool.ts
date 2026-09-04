import "server-only";

import pg from "pg";
import { databaseConfig, type DatabaseConfig, type SslMode } from "../config";

/**
 * The connection to whatever database this installation was pointed at.
 *
 * The premise that collapses most of this work: Supabase is Postgres. It hands
 * out a connection string, and everything the application does through PostgREST
 * it can do over that connection instead. So there is no Supabase driver and no
 * Postgres driver to choose between. There is one driver, and Supabase is one of
 * the URLs you can give it, alongside DigitalOcean, RDS, Neon, and a container
 * on the same host.
 *
 * ---
 *
 * What makes this survivable in production, as opposed to merely working:
 *
 *   Server-side timeouts. Set as connection parameters rather than issued as
 *   statements, so they apply from the first query on every connection including
 *   ones the pool creates later to meet demand. A client-side timeout would
 *   abandon the request and leave the query running.
 *
 *   An application_name. It costs nothing and it is the difference between
 *   `pg_stat_activity` naming the culprit and showing twenty identical rows when
 *   somebody is trying to work out what is hammering their database at 3am.
 *
 *   A keyed pool. Reconfiguring drains the old one rather than leaking it.
 *
 *   An error handler on the pool. Without one, an idle client erroring is an
 *   unhandled 'error' event on an EventEmitter, which takes the process down.
 *   A database restart or a pooler recycling connections is normal and must not
 *   kill the server.
 */

/* Postgres returns int8 as a string, because a bigint does not fit a JS number.
   Every count in this application is small and wants to be a number, and the
   alternative is Number(row.count) at three hundred call sites. numeric is
   deliberately NOT parsed: it holds money and discount percentages, where a
   float is the wrong answer. */
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

type Keyed = { pool: pg.Pool; key: string };

let current: Keyed | null = null;

function keyOf(c: DatabaseConfig): string {
  return [c.url, c.ssl, c.caCert ?? "", c.poolMax, c.statementTimeoutMs, c.idleTransactionTimeoutMs].join("|");
}

/**
 * TLS settings.
 *
 * Three modes because managed providers are genuinely inconsistent, and the
 * usual advice, "just set rejectUnauthorized false", turns transport encryption
 * into a coin flip against an active attacker.
 *
 * A supplied CA is the right answer and is checked first. `no-verify` remains
 * available because some providers still do not publish one, but it is a
 * downgrade and named so that choosing it is visible in the environment rather
 * than buried in code.
 */
export function sslFor(mode: SslMode, caCert: string | null): pg.ConnectionConfig["ssl"] {
  if (mode === "disable") return false;
  if (mode === "no-verify") return { rejectUnauthorized: false };
  if (caCert) return { rejectUnauthorized: true, ca: caCert };
  return { rejectUnauthorized: true };
}

/**
 * Connection parameters sent at startup.
 *
 * `options` is a libpq feature: these are applied by the server as the session
 * begins, so they are in force for the first query rather than after a round
 * trip the application would have to remember to make.
 */
function startupOptions(config: DatabaseConfig): string {
  /* Defended against a partial config, because the failure is otherwise
     miserable to diagnose: an undefined here produces
     `-c statement_timeout=undefined`, which the server rejects at connection
     time with an error about the parameter rather than about the caller. */
  return [
    `-c statement_timeout=${timeout(config.statementTimeoutMs, 15_000)}`,
    `-c idle_in_transaction_session_timeout=${timeout(config.idleTransactionTimeoutMs, 30_000)}`,
  ].join(" ");
}

function timeout(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.trunc(value as number) : fallback;
}

function build(config: DatabaseConfig): pg.Pool {
  const pool = new pg.Pool({
    connectionString: config.url,
    ssl: sslFor(config.ssl, config.caCert),
    max: config.poolMax,
    application_name: "socialx-portal",
    options: startupOptions(config),
    /* A caller waiting on a connection is a caller holding a request open. Fail
       in a way a route can turn into a 503 rather than hanging until the
       platform's own timeout kills the whole response. */
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    /* Managed providers and poolers drop idle sockets without saying so.
       Keepalives stop the first query after a quiet period failing. */
    keepAlive: true,
  });

  pool.on("error", () => {
    /* Deliberately empty. The pool discards the broken client itself and the
       next caller gets a fresh one; the only job here is to stop node treating
       it as fatal. */
  });

  return pool;
}

/**
 * The pool for the currently configured database.
 *
 * Throws when nothing is configured, and the message matters: this is what an
 * operator sees if a route needing data is reached before setup, and it should
 * point at the fix rather than read like a crash.
 */
export function pool(): pg.Pool {
  const config = databaseConfig();
  if (!config) {
    throw new Error(
      "No database is configured. Set DATABASE_URL in portal/.env.local and restart. See /setup."
    );
  }

  const key = keyOf(config);
  if (current && current.key === key) return current.pool;

  if (current) {
    /* Drain in the background: ending synchronously would abort queries still in
       flight from requests that started before the change. */
    const stale = current.pool;
    void stale.end().catch(() => undefined);
  }

  current = { pool: build(config), key };
  return current.pool;
}

/** Closes the pool, if there is one. For tests and deliberate reconfiguration. */
export async function closePool(): Promise<void> {
  const existing = current;
  current = null;
  if (existing) await existing.pool.end().catch(() => undefined);
}

/**
 * Opens a one-off connection to a database this installation is not serving on.
 *
 * Used by the migration runner and by the posture checks. Separate from `pool()`
 * because testing or migrating a candidate must not disturb the pool serving
 * traffic, and must not leave a pool behind for a connection nobody kept.
 *
 * The caller always gets the client back and is always responsible for ending
 * it, which is why this is a callback rather than something returning a client.
 */
export async function withCandidate<T>(
  config: DatabaseConfig,
  work: (client: pg.Client) => Promise<T>
): Promise<T> {
  const client = new pg.Client({
    connectionString: config.url,
    ssl: sslFor(config.ssl, config.caCert),
    application_name: "socialx-portal-admin",
    /* Migrations legitimately run longer than a request, so the statement
       timeout that protects the serving pool would abort them. The idle guard
       still applies. */
    options: `-c idle_in_transaction_session_timeout=${timeout(config.idleTransactionTimeoutMs, 30_000)}`,
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Is this error worth trying again?
 *
 * A pooled connection can be closed under the application by three routine
 * events: the database restarting, a connection pooler recycling backends, and a
 * cloud provider failing over. In all three the socket is gone, the query never
 * reached the server, and a retry succeeds immediately on a fresh connection.
 *
 * The list is deliberately about the transport, never about SQL. A constraint
 * violation, a permission denial, or a statement timeout are answers, and
 * retrying an answer just produces it again more slowly. 57P01 and 57P03 are
 * included because they are the server saying "I am going away" and "I am not
 * ready yet", which are the same situation from the other side.
 */
export function isTransient(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code && ["57P01", "57P02", "57P03", "08000", "08003", "08006", "08001", "08004"].includes(code)) {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /ECONNRESET|EPIPE|Connection terminated|socket hang up|server closed the connection/i.test(
    message
  );
}
