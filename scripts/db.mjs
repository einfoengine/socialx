#!/usr/bin/env node
/**
 * Migration and test runner.
 *
 * Supabase's REST API cannot run DDL, so this connects straight to Postgres with
 * SUPABASE_DB_URL. Each file runs inside its own transaction, so a failure rolls
 * that file back cleanly instead of leaving the schema half applied.
 *
 *   node scripts/db.mjs migrate    run supabase/migrations in order
 *   node scripts/db.mjs seed       run supabase/seed
 *   node scripts/db.mjs test       run supabase/tests (each rolls itself back)
 *   node scripts/db.mjs all        migrate, then seed, then test
 *   node scripts/db.mjs status     list applied migrations
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

// Load .env.local without a dependency.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Add it to .env.local.");
  console.error("Supabase dashboard > Project Settings > Database > Connection string > URI");
  process.exit(1);
}

const cmd = process.argv[2] ?? "all";

function newClient() {
  return new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
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
    for (const f of filesIn("supabase/migrations")) {
      await runFile("supabase/migrations", f, { track: true });
    }
    console.log("");
  }

  if (cmd === "seed" || cmd === "all") {
    console.log("Seed:");
    // Seeds are idempotent upserts, so they re-run on purpose.
    for (const f of filesIn("supabase/seed")) {
      await runFile("supabase/seed", f, { track: true, allowRerun: true });
    }
    console.log("");
  }

  if (cmd === "test" || cmd === "all") {
    console.log("Tests (each rolls itself back):");
    for (const f of filesIn("supabase/tests")) {
      await runFile("supabase/tests", f);
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
