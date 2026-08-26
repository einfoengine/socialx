#!/usr/bin/env node
/**
 * Mints a ready-to-click sign-in link for a seeded account.
 *
 *   node scripts/dev-login-link.mjs admin@socialx.demo
 *   node scripts/dev-login-link.mjs --all
 *
 * The demo accounts use unroutable .demo addresses, so no magic-link email can
 * ever reach them. The service role can mint the same token Supabase would have
 * emailed, and the callback accepts it as ?token_hash=. Nothing here bypasses
 * auth: the token is issued by Supabase and verified by Supabase.
 *
 * Links are single use and expire, so run this again rather than saving one.
 */
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

const BASE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
const DEMO = ["admin@socialx.demo", "staff@socialx.demo", "nathan@flowstackpro.demo"];

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/dev-login-link.mjs <email> | --all");
  process.exit(1);
}
const emails = arg === "--all" ? DEMO : [arg];

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

for (const email of emails) {
  // Staff have no membership, so sending them at /portal would only bounce them.
  const { data: profile } = await admin
    .from("profiles")
    .select("is_staff, full_name")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    console.error(`\n${email}\n  No profile. Create the user first.`);
    continue;
  }

  const next = profile.is_staff ? "/admin" : "/portal";
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE}/auth/callback` },
  });

  if (error) {
    console.error(`\n${email}\n  Could not mint a link: ${error.message}`);
    continue;
  }

  const url = new URL(`${BASE}/auth/callback`);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", next);

  console.log(`\n${profile.full_name ?? email}  <${email}>`);
  console.log(`  lands on ${next}`);
  console.log(`  ${url.toString()}`);
}
console.log("");
