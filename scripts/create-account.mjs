#!/usr/bin/env node
/**
 * Creates an account with a password, from the command line.
 *
 *   node scripts/create-account.mjs --email a@b.com --password 'secret' --staff owner
 *   node scripts/create-account.mjs --email a@b.com --password 'secret' --org flowstack-pro-demo
 *
 * The same job the admin panel does at /admin/people, for seeding and for the
 * first staff account, which has to exist before anyone can open the panel.
 *
 * --org takes an organization slug or id. --staff takes owner|ops|content|finance.
 * Exactly one of the two is required: staff get a staff_roles row, clients get an
 * org membership.
 *
 * Pass the password as an argument rather than editing it in here. A password
 * committed to the repo is a password you have to rotate.
 *
 * Re-running for an address that already exists updates the password instead of
 * failing, so this is safe to run twice.
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

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  if (!k?.startsWith("--")) continue;
  args[k.slice(2)] = process.argv[i + 1];
}

const email = args.email?.trim().toLowerCase();
const password = args.password;
const staffRole = args.staff;
const orgRef = args.org;
const fullName = args.name ?? null;

if (!email || !password) {
  console.error("Usage: --email <email> --password <password> [--staff <role> | --org <slug|id>] [--name <full name>]");
  process.exit(1);
}
if (!staffRole && !orgRef) {
  console.error("Pass --staff <owner|ops|content|finance> or --org <slug|id>.");
  process.exit(1);
}
if (staffRole && !["owner", "ops", "content", "finance"].includes(staffRole)) {
  console.error(`Unknown staff role: ${staffRole}`);
  process.exit(1);
}
if (password.length < 10) {
  console.error("A password needs at least 10 characters.");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* Create, or find and update. createUser is the only call that reports "already
   registered", so the lookup only runs when it does. */
let userId = null;
const { data: created, error: createError } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
});

if (created?.user) {
  userId = created.user.id;
  console.log(`created  ${email}`);
} else {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
  if (!found) {
    console.error(`Could not create ${email}: ${createError?.message ?? "unknown error"}`);
    process.exit(1);
  }
  userId = found.id;
  const { error: pwError } = await db.auth.admin.updateUserById(userId, { password });
  if (pwError) {
    console.error(`Found ${email} but could not set the password: ${pwError.message}`);
    process.exit(1);
  }
  console.log(`updated  ${email} (already existed, password reset)`);
}

if (fullName) await db.from("profiles").update({ full_name: fullName }).eq("id", userId);

if (staffRole) {
  // profiles.is_staff is maintained by the staff_roles_sync trigger, not here.
  const { error } = await db
    .from("staff_roles")
    .upsert({ user_id: userId, role: staffRole }, { onConflict: "user_id" });
  if (error) {
    console.error(`  could not grant staff role: ${error.message}`);
    process.exit(1);
  }
  console.log(`         staff, ${staffRole} -> /admin`);
} else {
  const byId = /^[0-9a-f-]{36}$/i.test(orgRef);
  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq(byId ? "id" : "slug", orgRef)
    .maybeSingle();

  if (!org) {
    console.error(`  no organization matches "${orgRef}". The account exists but can reach nothing.`);
    process.exit(1);
  }

  const { error } = await db
    .from("memberships")
    .upsert({ org_id: org.id, user_id: userId, role: args.role ?? "owner" }, { onConflict: "org_id,user_id" });
  if (error) {
    console.error(`  could not add to ${org.name}: ${error.message}`);
    process.exit(1);
  }
  console.log(`         client of ${org.name} -> /portal`);
}
