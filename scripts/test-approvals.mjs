#!/usr/bin/env node
/**
 * Exercises the R3 approval and revision rules against the real database.
 *
 * The revision ceiling is the single edge that carries the commercial difference
 * between Starter, Growth, and Scale, so it is worth proving rather than assuming.
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

let fails = 0;
const check = (l, ok, d = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${d ? `  (${d})` : ""}`); if (!ok) fails++; };
const SLUG = `r3-${Date.now()}`;

const { data: org } = await db.from("organizations")
  .insert({ name: "R3 Test", slug: SLUG, status: "active", source: "manual", owner_email: `${SLUG}@test.invalid` })
  .select("id").single();

// Growth shaped: 2 rounds.
const { data: batch } = await db.from("batches").insert({
  org_id: org.id, period_start: "2026-10-01", period_end: "2026-10-31",
  status: "in_review", quota_posts: 16, quota_motion: 2, quota_platforms: 3,
  revision_rounds_allowed: 2, revision_rounds_used: 0,
}).select("id").single();

const { data: posts } = await db.from("posts").insert([
  { batch_id: batch.id, org_id: org.id, title: "Post A", format: "static", status: "in_review", platforms: ["linkedin"] },
  { batch_id: batch.id, org_id: org.id, title: "Post B", format: "static", status: "in_review", platforms: ["facebook"] },
  { batch_id: batch.id, org_id: org.id, title: "Post C", format: "motion", status: "in_review", platforms: ["instagram"] },
]).select("id, title");

// Round 1: three notes in one submission must all carry round 1.
for (const p of posts.slice(0, 2)) {
  await db.from("revisions").insert({ batch_id: batch.id, post_id: p.id, round: null, note: `change ${p.title}` });
}
await db.from("revisions").insert({ batch_id: batch.id, post_id: null, round: null, note: "overall note" });
await db.from("batches").update({ revision_rounds_used: 1, status: "changes_requested" }).eq("id", batch.id);
// The action also flips the flagged posts, which is what keeps them out of a later
// batch-wide approval. Mirror that here or the approval assertion below is testing
// a state the application never actually produces.
await db.from("posts").update({ status: "changes_requested" }).in("id", posts.slice(0, 2).map((p) => p.id));

const { data: r1 } = await db.from("revisions").select("round").eq("batch_id", batch.id);
check("three notes in one submission all carry round 1",
  r1.length === 3 && r1.every((r) => r.round === 1), `rounds ${r1.map(r => r.round).join(",")}`);

// Round 2.
await db.from("revisions").insert({ batch_id: batch.id, post_id: posts[0].id, round: null, note: "second pass" });
await db.from("batches").update({ revision_rounds_used: 2 }).eq("id", batch.id);
const { data: r2 } = await db.from("revisions").select("round").eq("batch_id", batch.id).eq("round", 2);
check("second submission is round 2", r2.length === 1);

// Round 3 must be refused by the trigger.
const { error: third } = await db.from("revisions")
  .insert({ batch_id: batch.id, post_id: posts[0].id, round: null, note: "third pass" });
check("third round refused on a Growth batch", Boolean(third), third?.message?.slice(0, 58));

// Scale: NULL means unlimited, not zero.
const { data: scaleBatch } = await db.from("batches").insert({
  org_id: org.id, period_start: "2026-11-01", period_end: "2026-11-30", status: "in_review",
  quota_posts: 24, quota_motion: 4, quota_platforms: 4, revision_rounds_allowed: null, revision_rounds_used: 0,
}).select("id").single();

let unlimitedOk = true;
for (let i = 1; i <= 6; i++) {
  const { error } = await db.from("revisions").insert({ batch_id: scaleBatch.id, round: null, note: `round ${i}` });
  if (error) unlimitedOk = false;
  await db.from("batches").update({ revision_rounds_used: i }).eq("id", scaleBatch.id);
}
check("Scale accepted 6 rounds with no ceiling", unlimitedOk);

// Approval transition.
await db.from("batches").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", batch.id);
await db.from("posts").update({ status: "approved" }).eq("batch_id", batch.id).eq("status", "in_review");
const { data: approvedPosts } = await db.from("posts").select("status").eq("batch_id", batch.id);
check("batch approval skips posts the client sent back",
  approvedPosts.filter((p) => p.status === "approved").length === 1 &&
  approvedPosts.filter((p) => p.status === "changes_requested").length === 2,
  `${approvedPosts.filter(p => p.status === "approved").length} approved, ${approvedPosts.filter(p => p.status === "changes_requested").length} still flagged`);

await db.from("organizations").delete().eq("id", org.id);
console.log(`\n${fails === 0 ? "all checks passed" : `${fails} failed`}`);
process.exit(fails ? 1 : 0);
