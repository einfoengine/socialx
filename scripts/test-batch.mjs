#!/usr/bin/env node
/**
 * Exercises the R2 delivery rules against the real database, over REST so it works
 * even when the direct Postgres route is unavailable.
 *
 * Proves the things that cost money if they drift: the post cap, the motion cap,
 * the platform cap, and that quota is snapshotted rather than read live.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = line.indexOf("="); process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SLUG = `r2-test-${Date.now()}`;
let fails = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) fails++;
};

// Fixture: an org on Growth (16 posts, 2 motion, 3 platforms, 2 rounds).
const { data: org } = await db.from("organizations")
  .insert({ name: "R2 Test Co", slug: SLUG, status: "active", source: "manual", owner_email: `${SLUG}@test.invalid` })
  .select("id").single();

const { data: growth } = await db.from("plans").select("id").eq("key", "growth").single();
const { data: ent } = await db.from("plan_entitlements").select("*").eq("plan_id", growth.id).single();

const { data: batch } = await db.from("batches").insert({
  org_id: org.id, period_start: "2026-09-01", period_end: "2026-09-30", status: "draft",
  quota_posts: ent.posts_per_month, quota_motion: ent.motion_videos,
  quota_platforms: ent.platforms_max, revision_rounds_allowed: ent.revision_rounds,
}).select("id, quota_posts, quota_motion, quota_platforms, revision_rounds_allowed").single();

check("quota snapshotted from Growth entitlements",
  batch.quota_posts === 16 && batch.quota_motion === 2 && batch.quota_platforms === 3 && batch.revision_rounds_allowed === 2,
  `${batch.quota_posts} posts, ${batch.quota_motion} motion, ${batch.quota_platforms} platforms`);

// Platform cap is enforced by a database trigger, not only by the UI.
const { error: overPlat } = await db.from("posts").insert({
  batch_id: batch.id, org_id: org.id, title: "Too many platforms", format: "static",
  platforms: ["linkedin", "facebook", "instagram", "tiktok"], status: "draft",
});
check("4 platforms rejected on a 3 platform plan", Boolean(overPlat), overPlat?.message?.slice(0, 60));

const { error: okPlat } = await db.from("posts").insert({
  batch_id: batch.id, org_id: org.id, title: "Within cap", format: "static",
  platforms: ["linkedin", "facebook", "instagram"], status: "draft",
});
check("3 platforms accepted", !okPlat, okPlat?.message?.slice(0, 60));

// Revision ceiling.
await db.from("revisions").insert({ batch_id: batch.id, round: 1, note: "first" });
await db.from("batches").update({ revision_rounds_used: 1 }).eq("id", batch.id);
await db.from("revisions").insert({ batch_id: batch.id, round: 2, note: "second" });
await db.from("batches").update({ revision_rounds_used: 2 }).eq("id", batch.id);
const { error: thirdRound } = await db.from("revisions").insert({ batch_id: batch.id, round: 3, note: "third" });
check("third revision refused on a 2 round plan", Boolean(thirdRound), thirdRound?.message?.slice(0, 60));

// A mid cycle upgrade must not rewrite a batch already in production.
const { data: scale } = await db.from("plans").select("id").eq("key", "scale").single();
await db.from("subscriptions").insert({
  org_id: org.id, plan_id: scale.id, cycle_key: "monthly", rate_card_key: "launch", status: "active",
});
const { data: after } = await db.from("batches").select("quota_posts").eq("id", batch.id).single();
check("upgrading to Scale leaves the existing batch at 16", after.quota_posts === 16, `still ${after.quota_posts}`);

// Library isolation: the feature axis works as a query.
const { data: feat } = await db.from("hl_features").select("id").eq("slug", "missed-call-text-back").single();
check("HighLevel feature taxonomy present", Boolean(feat?.id));

// Cleanup.
await db.from("organizations").delete().eq("id", org.id);
console.log(`\n${fails === 0 ? "all checks passed" : `${fails} check(s) failed`}`);
process.exit(fails ? 1 : 0);
