#!/usr/bin/env node
/**
 * Mints an API key for one site, so a website can talk to the platform.
 *
 *   node scripts/mint-api-key.mjs <site-key> [--name "..."] [--scopes a,b] [--test]
 *   node scripts/mint-api-key.mjs socialx --name "socialX website" \
 *     --scopes content:read,catalog:read,checkout:quote,checkout:write
 *
 * The console at /admin/sites does the same job with a form, and that is the
 * right tool for cutting a key for somebody else. This exists for the first one:
 * a fresh environment has a website that cannot start until it holds a
 * credential, and a credential that can only be minted by signing into an
 * application that is already running is a bootstrap problem.
 *
 * The secret is printed once. It is not stored anywhere, not by this script and
 * not by the platform, which keeps only a SHA-256 of the whole token. Losing it
 * means revoking the key and minting another, which is the intended cost.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

/* Kept in step with lib/api/scopes.ts by hand, because a script
   outside the app cannot import a TypeScript module from inside it. A scope
   typo is caught here rather than becoming a key that silently cannot do the
   one thing it was cut for. */
const SCOPES = [
  "content:read",
  "content:write",
  "catalog:read",
  "orders:read",
  "checkout:quote",
  "checkout:write",
];

/* What a website that sells needs, which is the overwhelmingly common case and
   the reason this script exists. Read the catalogue, read its own copy, price a
   basket, create a subscription. Deliberately no content:write: a website
   renders its copy, it does not edit it, and the console does. */
const DEFAULT_SCOPES = ["content:read", "catalog:read", "checkout:quote", "checkout:write"];

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

const siteKey = process.argv[2];
if (!siteKey || siteKey.startsWith("--")) {
  console.error(
    'Usage: node scripts/mint-api-key.mjs <site-key> [--name "..."] [--scopes a,b] [--test]'
  );
  console.error(`Scopes: ${SCOPES.join(", ")}`);
  process.exit(1);
}

const env = process.argv.includes("--test") ? "test" : "live";
const name = arg("--name") ?? `${siteKey} website`;
const scopes = (arg("--scopes")?.split(",").map((s) => s.trim()).filter(Boolean)) ?? DEFAULT_SCOPES;

const unknown = scopes.filter((s) => !SCOPES.includes(s));
if (unknown.length > 0) {
  console.error(`Unknown scope(s): ${unknown.join(", ")}`);
  console.error(`Known scopes: ${SCOPES.join(", ")}`);
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set. This script cannot run without it.");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: site, error: siteError } = await db
  .from("sites")
  .select("id, key, name, status")
  .eq("key", siteKey.trim().toLowerCase())
  .maybeSingle();

if (siteError) {
  console.error(`Could not read the site registry: ${siteError.message}`);
  process.exit(1);
}
if (!site) {
  const { data: all } = await db.from("sites").select("key, status").order("key");
  console.error(`No site is registered under "${siteKey}".`);
  if (all?.length) {
    console.error(`Registered: ${all.map((s) => `${s.key} (${s.status})`).join(", ")}`);
  } else {
    console.error("The registry is empty. Register a site at /admin/sites first.");
  }
  process.exit(1);
}

/* Same shape as lib/api/keys.ts: 8 hex of prefix, 48 hex of secret, and the
   table holds a SHA-256 of the whole token rather than the token. */
const prefix = `sx_${env}_${randomBytes(4).toString("hex")}`;
const token = `${prefix}_${randomBytes(24).toString("hex")}`;
const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

const { error } = await db.from("api_keys").insert({
  name,
  prefix,
  token_hash: tokenHash,
  scopes,
  /* Empty: a key minted from a terminal is for a server, and an empty allowlist
     means no browser may use it at all. Add origins in the console if this key
     is ever meant to be called from a page. */
  allowed_origins: [],
  site_id: site.id,
  note: "Minted with scripts/mint-api-key.mjs",
});

if (error) {
  console.error(`Could not create the key: ${error.message}`);
  process.exit(1);
}

console.log(`\n  Site     ${site.name} (${site.key})${site.status === "active" ? "" : `  [${site.status}: credentials are refused until this is active]`}`);
console.log(`  Name     ${name}`);
console.log(`  Scopes   ${scopes.join(", ")}`);
console.log(`  Prefix   ${prefix}`);
console.log(`\n  Shown once, and never recoverable. Put it in site/.env.local:\n`);
console.log(`  PORTAL_API_KEY=${token}\n`);
