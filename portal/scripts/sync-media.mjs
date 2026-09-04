#!/usr/bin/env node
/**
 * Imports the HighLevel media library into the assets table.
 *
 * socialX stores links, not bytes. This records what exists in HighLevel so the
 * batch builder can pick from it without hitting the HighLevel API on every render,
 * and so a file that later disappears becomes detectable instead of a silently
 * broken preview.
 *
 *   node scripts/sync-media.mjs [--verify]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = line.indexOf("="); process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
}

const VERIFY = process.argv.includes("--verify");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const LOCATION = process.env.HL_MEDIA_LOCATION_ID;
const KEY = process.env.HL_API_KEY;

function mimeOf(name = "") {
  const ext = name.split("?")[0].split(".").pop()?.toLowerCase();
  return { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp",
           gif:"image/gif", svg:"image/svg+xml", mp4:"video/mp4", mov:"video/quicktime" }[ext] ?? null;
}

const res = await fetch(
  `https://services.leadconnectorhq.com/medias/files?altId=${LOCATION}&altType=location&type=file&limit=100&sortBy=createdAt&sortOrder=desc`,
  { headers: { Authorization: `Bearer ${KEY}`, Version: "2021-07-28", Accept: "application/json" } }
);
if (!res.ok) { console.error("HighLevel returned", res.status, await res.text()); process.exit(1); }

const body = await res.json();
const files = body.files ?? body.medias ?? [];
console.log(`HighLevel library: ${files.length} file(s)`);

let imported = 0, skipped = 0;
for (const f of files) {
  const fileId = f._id ?? f.id;
  if (!fileId || !f.url) { skipped++; continue; }

  const { data: existing } = await db.from("assets").select("id").eq("hl_file_id", fileId).maybeSingle();
  if (existing) { skipped++; continue; }

  const { error } = await db.from("assets").insert({
    org_id: null,                 // socialX library asset
    provider: "highlevel",
    url: f.url,
    hl_location_id: LOCATION,
    hl_file_id: fileId,
    mime: mimeOf(f.name ?? f.url),
    bytes: f.size ?? null,
    alt: f.name ?? null,
    last_verified_at: new Date().toISOString(),
  });
  if (error) console.error(`  could not import ${f.name}: ${error.message}`);
  else { imported++; console.log(`  imported  ${f.name}`); }
}
console.log(`imported ${imported}, already known ${skipped}`);

// The link checker. A HighLevel URL is only as durable as the file behind it.
if (VERIFY) {
  const { data: assets } = await db
    .from("assets").select("id, url, alt")
    .eq("provider", "highlevel")
    .order("last_verified_at", { ascending: true, nullsFirst: true })
    .limit(50);

  let broken = 0;
  for (const a of assets ?? []) {
    const alive = await fetch(a.url, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
    await db.from("assets")
      .update({ last_verified_at: new Date().toISOString(), is_broken: !alive })
      .eq("id", a.id);
    if (!alive) { broken++; console.log(`  BROKEN  ${a.alt ?? a.id}`); }
  }
  console.log(`verified ${(assets ?? []).length}, broken ${broken}`);
}
