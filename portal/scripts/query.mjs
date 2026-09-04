#!/usr/bin/env node
/**
 * One-off SQL against the project database. Read-only by habit, not by enforcement.
 *
 *   node scripts/query.mjs "select count(*) from decisions"
 */
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const sql = process.argv[2];
if (!sql) { console.error('Usage: node scripts/query.mjs "select ..."'); process.exit(1); }

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const r = await c.query(sql);
  console.table(r.rows);
} finally {
  await c.end();
}
