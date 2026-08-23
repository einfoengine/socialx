#!/usr/bin/env node
/**
 * Seeds the HighLevel feature taxonomy over the REST API.
 *
 * Exists because the direct Postgres route is IPv6 only and unreliable from some
 * networks, while PostgREST over HTTPS is not. Pure inserts do not need a Postgres
 * socket, so this path works when scripts/db.mjs cannot connect.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

for (const f of [".env.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = line.indexOf("="); process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const FEATURES = [
  ["Social Planner", "social-planner"],
  ["Missed Call Text Back", "missed-call-text-back"],
  ["Reputation Management", "reputation-management"],
  ["Conversation AI", "conversation-ai"],
  ["Voice AI", "voice-ai"],
  ["Workflows", "workflows"],
  ["Pipelines and Opportunities", "pipelines"],
  ["Calendars and Booking", "calendars"],
  ["Funnels and Websites", "funnels-websites"],
  ["Forms and Surveys", "forms-surveys"],
  ["Email Marketing", "email-marketing"],
  ["SMS Marketing", "sms-marketing"],
  ["Payments and Invoicing", "payments-invoicing"],
  ["Memberships and Courses", "memberships-courses"],
  ["Communities", "communities"],
  ["Blogs", "blogs"],
  ["Affiliate Manager", "affiliate-manager"],
  ["Reporting and Dashboards", "reporting"],
  ["Snapshots", "snapshots"],
  ["SaaS Mode and Rebilling", "saas-mode"],
  ["WhatsApp", "whatsapp"],
  ["Proposals and Estimates", "proposals-estimates"],
  ["Documents and Contracts", "documents-contracts"],
  ["Mobile App", "mobile-app"],
  ["Custom Objects", "custom-objects"],
  ["Ad Manager", "ad-manager"],
  ["White Label App Builder", "white-label-app"],
];

const { error } = await db
  .from("hl_features")
  .upsert(FEATURES.map(([name, slug]) => ({ name, slug, status: "active" })), { onConflict: "slug" });

if (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
}

const { count } = await db.from("hl_features").select("*", { count: "exact", head: true });
console.log(`hl_features: ${count} rows`);
if (count < 27) {
  console.error("Expected at least 27 features.");
  process.exit(1);
}
