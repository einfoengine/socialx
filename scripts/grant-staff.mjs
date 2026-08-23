#!/usr/bin/env node
/**
 * Creates (or finds) an auth user and grants them a socialX staff role.
 *
 *   node scripts/grant-staff.mjs someone@example.com [owner|ops|content|finance]
 *
 * Uses the service role key, so it needs no email round trip. The user still signs
 * in normally with a magic link afterwards.
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

const email = process.argv[2];
const role = process.argv[3] ?? "owner";
if (!email) {
  console.error("Usage: node scripts/grant-staff.mjs <email> [owner|ops|content|finance]");
  process.exit(1);
}
if (!["owner", "ops", "content", "finance"].includes(role)) {
  console.error(`Unknown role "${role}".`);
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Find an existing user before creating one, so re-running is safe.
let userId = null;
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (found) {
  userId = found.id;
  console.log(`Found existing auth user for ${email}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) {
    console.error("Could not create the user:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Created auth user for ${email}`);
}

// The on_auth_user_created trigger makes the profile; make sure it is there.
const { error: profileErr } = await admin
  .from("profiles")
  .upsert({ id: userId, email }, { onConflict: "id" });
if (profileErr) {
  console.error("Profile upsert failed:", profileErr.message);
  process.exit(1);
}

const { error: roleErr } = await admin
  .from("staff_roles")
  .upsert({ user_id: userId, role }, { onConflict: "user_id" });
if (roleErr) {
  console.error("Granting the staff role failed:", roleErr.message);
  process.exit(1);
}

// staff_roles has a trigger that flips profiles.is_staff; confirm it fired.
const { data: check } = await admin
  .from("profiles")
  .select("is_staff")
  .eq("id", userId)
  .single();

console.log(`Granted "${role}". profiles.is_staff = ${check?.is_staff}`);
console.log(`\n${email} can now sign in at /login and will land on /admin.`);
