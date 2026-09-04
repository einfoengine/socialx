#!/usr/bin/env node
/**
 * Migration and test runner.
 *
 * Supabase's REST API cannot run DDL, so this connects straight to Postgres with
 * SUPABASE_DB_URL. Each file runs inside its own transaction, so a failure rolls
 * that file back cleanly instead of leaving the schema half applied.
 *
 *   node scripts/db.mjs migrate    run db/migrations in order
 *   node scripts/db.mjs seed       run db/seed
 *   node scripts/db.mjs test       run db/tests (each rolls itself back)
 *   node scripts/db.mjs all        migrate, then seed, then test
 *   node scripts/db.mjs status     list applied migrations
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/*
 * Everything is resolved from this file rather than from the working directory.
 *
 * The scripts used to sit at the repo root and read "supabase/migrations",
 * which worked only when run from exactly one place. They live with the app that
 * owns the database now, and the app is meant to be deployable on its own, so
 * "where am I" has to be answered from the module's own location. The same
 * command then works from the repo root, from inside portal/, and from a copy
 * of portal/ extracted somewhere else entirely.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const DB = join(APP, "db");

// Load .env.local without a dependency.
/* Walk up looking for the env file, so a repo-root .env.local is found from
   inside the app, and an app-local one is found when the app stands alone. */
const envCandidates = [];
for (const dir of [process.cwd(), APP, resolve(APP, "..", ".."), resolve(HERE, "..", "..", "..")]) {
  envCandidates.push(join(dir, ".env.local"), join(dir, ".env"));
}
for (const file of envCandidates) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

/*
 * DATABASE_URL first, because that is what the application itself reads and
 * what every host already sets. SUPABASE_DB_URL is kept as a fallback so an
 * existing install that only ever set that one keeps working: this script used
 * to require it, and silently ignoring it now would break the one command
 * people have in their shell history.
 */
/* MIGRATION_DATABASE_URL first: migrations need DDL, and the role the
   application serves on deliberately cannot create tables. */
const url =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("No database URL. Set DATABASE_URL in portal/.env.local.");
  console.error("");
  console.error("  DATABASE_URL=postgres://user:password@host:5432/dbname");
  console.error("");
  console.error("Migrations create tables, so this needs a connection that may do DDL.");
  console.error("portal_app deliberately cannot: use an owner or admin connection here.");
  process.exit(1);
}

const cmd = process.argv[2] ?? "all";

function newClient() {
  return new pg.Client({
    connectionString: url,
    /* Matches the application's own DATABASE_SSL handling, so the script and the
       server cannot disagree about whether a given database is reachable.
       Verification is the default; a provider with a self-signed certificate is
       an explicit DATABASE_SSL=no-verify rather than a blanket exemption. */
    ssl:
      process.env.DATABASE_SSL === "disable"
        ? false
        : process.env.DATABASE_SSL === "no-verify"
          ? { rejectUnauthorized: false }
          : process.env.DATABASE_CA_CERT
            ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
            : { rejectUnauthorized: true },
    connectionTimeoutMillis: 20000,
    // Supabase's direct host is IPv6 only and the route to it can be flaky from
    // some networks. Keepalives stop an idle socket being reaped mid-migration.
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
  });
}

let client = newClient();

/**
 * Reconnects on a dropped socket.
 *
 * ECONNRESET partway through a migration run is a network problem, not a schema
 * problem, and aborting the whole run for it means re-reasoning about what applied.
 * The ledger makes retries safe, so the useful behaviour is to reconnect and carry on.
 */
async function withReconnect(fn, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const transient = /ECONNRESET|ETIMEDOUT|EPIPE|Connection terminated|timeout expired|socket hang up/i.test(
        err.message ?? ""
      );
      if (!transient || i === attempts) throw err;

      const wait = 2000 * i;
      console.log(`  ...connection dropped (${err.code ?? "reset"}), retrying in ${wait / 1000}s`);
      try { await client.end(); } catch { /* already gone */ }
      await new Promise((r) => setTimeout(r, wait));
      client = newClient();
      await client.connect();
      await client.query(LEDGER);
    }
  }
}

/** Records which migrations have run, so re-running is safe. */
const LEDGER = `
  create table if not exists schema_migrations (
    filename   text primary key,
    applied_at timestamptz not null default now()
  );
  -- PostgREST exposes every public table, and this one lists internal filenames.
  -- RLS on with no policy means only the service role and this runner can see it.
  alter table schema_migrations enable row level security;
`;

function filesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
}

async function runFile(dir, file, opts = {}) {
  return withReconnect(() => runFileOnce(dir, file, opts));
}

async function runFileOnce(dir, file, { track = false, allowRerun = false } = {}) {
  const sql = readFileSync(join(dir, file), "utf8");

  if (track && !allowRerun) {
    const { rows } = await client.query("select 1 from schema_migrations where filename = $1", [file]);
    if (rows.length) {
      console.log(`  skip     ${file}  (already applied)`);
      return "skipped";
    }
  }

  try {
    await client.query("begin");
    await client.query(sql);
    if (track) {
      await client.query(
        "insert into schema_migrations (filename) values ($1) on conflict do nothing",
        [file]
      );
    }
    await client.query("commit");
    console.log(`  ok       ${file}`);
    return "ok";
  } catch (err) {
    await client.query("rollback");
    console.error(`  FAILED   ${file}`);
    console.error(`           ${err.message}`);
    if (err.position) {
      // Point at the offending line so the fix is obvious.
      const upto = sql.slice(0, Number(err.position));
      const line = upto.split("\n").length;
      console.error(`           at line ${line}: ${sql.split("\n")[line - 1]?.trim()}`);
    }
    throw err;
  }
}

async function main() {
  await client.connect();
  const { rows: [info] } = await client.query("select current_database() db, version()");
  console.log(`Connected to ${info.db}\n`);

  await client.query(LEDGER);

  if (cmd === "status") {
    const { rows } = await client.query(
      "select filename, applied_at from schema_migrations order by filename"
    );
    if (!rows.length) console.log("No migrations applied yet.");
    for (const r of rows) console.log(`  ${r.filename}  ${r.applied_at.toISOString()}`);
    return;
  }

  if (cmd === "migrate" || cmd === "all") {
    console.log("Migrations:");
    for (const f of filesIn(join(DB, "migrations"))) {
      await runFile(join(DB, "migrations"), f, { track: true });
    }
    console.log("");
  }

  if (cmd === "seed" || cmd === "all") {
    console.log("Seed:");
    // Seeds are idempotent upserts, so they re-run on purpose.
    for (const f of filesIn(join(DB, "seed"))) {
      await runFile(join(DB, "seed"), f, { track: true, allowRerun: true });
    }
    console.log("");
  }

  if (cmd === "test" || cmd === "all") {
    console.log("Tests (each rolls itself back):");
    for (const f of filesIn(join(DB, "tests"))) {
      await runFile(join(DB, "tests"), f);
    }
    console.log("");
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("\nRun aborted:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
