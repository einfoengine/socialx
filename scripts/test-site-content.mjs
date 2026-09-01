#!/usr/bin/env node
/**
 * Round-trips the website content store after migration 0023.
 *
 *   pnpm test:site-content
 *
 * Proves four things in order: the service role can write an entry the way the
 * console's actions do, the site's read path returns exactly what was stored,
 * the anon key is refused (no client policy exists, so a browser can never read
 * this table directly), and the cleanup delete works. Uses a throwaway key so
 * it never touches real content.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const KEY = "smoke-test-entry";
const VALUE = { headline: "hello", items: [1, 2, 3], nested: { ok: true } };
let failed = false;
const report = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed = true;
};

const { error: wErr } = await service.from("site_content").upsert({ key: KEY, data: VALUE, description: "smoke test, safe to delete" });
report("service role writes", !wErr, wErr?.message);

const { data: r, error: rErr } = await service.from("site_content").select("data").eq("key", KEY).maybeSingle();
report("site read path returns the stored value", !rErr && JSON.stringify(r?.data) === JSON.stringify(VALUE));

const { data: aData, error: aErr } = await anon.from("site_content").select("key").eq("key", KEY);
// RLS with no anon policy answers with an empty set, not an error.
report("anon key is refused", Boolean(aErr) || (aData ?? []).length === 0);

const { error: dErr } = await service.from("site_content").delete().eq("key", KEY);
report("cleanup delete", !dErr, dErr?.message);

process.exit(failed ? 1 : 0);
