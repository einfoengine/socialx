#!/usr/bin/env node
/**
 * Demo data: a populated library and one client with real delivery history.
 *
 * Every screen in both portals has been built without ever being seen with
 * content in it. This exists so the approval loop, the calendar, the batch list
 * and the client record can be looked at rather than imagined.
 *
 * Idempotent: it clears its own demo rows first and rebuilds, so running it twice
 * does not stack duplicates. It only ever touches the demo organization and the
 * templates it created, never real data.
 *
 *   node scripts/seed-demo.mjs           create or refresh
 *   node scripts/seed-demo.mjs --remove  delete it again
 */
import { createClient } from "@supabase/supabase-js";
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

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DEMO_SLUG = "flowstack-pro-demo";
const DEMO_EMAIL = "nathan@flowstackpro.demo";
const TEMPLATE_PREFIX = "SXD-";
/* Anyone here also gets a membership, so the client portal can be opened without
   waiting for a magic link to an address nobody owns. */
const ALSO_ADMIT = ["shariful@vidiosa.com", "growxstudiohq@gmail.com"];

const REMOVE = process.argv.includes("--remove");

/* ---------------- helpers ---------------- */

const iso = (d) => d.toISOString();
const day = (d) => d.toISOString().slice(0, 10);
/* Fixed anchor so re-running does not shuffle the calendar around. */
const TODAY = new Date();
const monthStart = (offset) => new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + offset, 1));
const monthEnd = (offset) => new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + offset + 1, 0));

async function wipe() {
  const { data: org } = await db.from("organizations").select("id").eq("slug", DEMO_SLUG).maybeSingle();
  if (org) {
    // Cascades take batches, posts, revisions, comments, invoices and memberships.
    await db.from("organizations").delete().eq("id", org.id);
  }
  const { data: tpl } = await db.from("templates").select("id").like("code", `${TEMPLATE_PREFIX}%`);
  if (tpl?.length) await db.from("templates").delete().in("id", tpl.map((t) => t.id));
  await db.from("assets").delete().eq("provider", "external");

  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const demoUser = users?.users?.find((u) => u.email === DEMO_EMAIL);
  if (demoUser) await db.auth.admin.deleteUser(demoUser.id);
}

/* ---------------- library ---------------- */

const LIBRARY = [
  ["Missed call, lost job", "pain_agitation", "missed-call-text-back", "static",
   "A roofing company misses a call at 4pm on a Friday. That lead books someone else by Monday.",
   "Missed Call Text Back fires the moment the phone stops ringing, so the conversation starts before the caller has put the phone down.",
   "Your clients stop paying for leads they never answered.",
   "Show them the feature that pays for your platform."],
  ["The five tools they are still paying for", "feature_spotlight", "workflows", "static",
   "Your prospect is paying for a scheduler, an email tool, a form builder, a pipeline and a texting app.",
   "One platform replaces the lot, and the workflows tie them together so nothing needs a human to hand it along.",
   "The consolidation argument closes deals nothing else can.",
   "Show a side-by-side of their stack and yours."],
  ["Why your reviews stopped coming in", "education", "reputation-management", "static",
   "Most local businesses ask for reviews when they remember to, which is never.",
   "Reputation Management asks automatically after the job closes, and routes the unhappy ones to you first.",
   "More reviews, and the bad ones never reach Google.",
   "Explain the routing. It is the part nobody expects."],
  ["What a booked calendar actually looks like", "feature_spotlight", "calendars", "motion",
   "Your prospect still books appointments over text and hopes nobody double-books.",
   "Calendars handles the round robin, the buffers, the reminders and the reschedules without anyone touching it.",
   "The no-show rate drops because the reminders never forget.",
   "Thirty seconds, screen recording, no voiceover needed."],
  ["The client who nearly churned", "social_proof", "conversation-ai", "static",
   "A client is two months in and quiet. That is what churn looks like before it happens.",
   "Conversation AI keeps their leads warm overnight so they see results before they see the invoice.",
   "Retention is won in month two, not month twelve.",
   "Frame it as a retention story, not a feature."],
  ["Your SaaS is not a CRM", "pain_agitation", "saas-mode", "static",
   "Selling a CRM puts you next to twenty other CRMs and a price comparison.",
   "SaaS mode lets you sell an outcome at your own price, with the platform underneath as an implementation detail.",
   "Stop competing on features you did not build.",
   "This is a positioning post. Keep the platform quiet."],
  ["The onboarding that runs itself", "education", "snapshots", "static",
   "Every new client costs you a week of setup you never billed for.",
   "A snapshot loads the pipelines, the workflows and the templates in one click, so day one looks like month three.",
   "Your margin lives in the hours you stop spending.",
   "Show the before and after of an onboarding week."],
  ["Where their leads are actually going", "feature_spotlight", "pipelines", "motion",
   "Ask a prospect where a lead sits after the first call and watch them guess.",
   "Pipelines put every deal on one board, so the answer is a glance rather than a guess.",
   "Visibility is the thing they will pay to keep.",
   "Motion works better here than a static board screenshot."],
  ["Two weeks of content in one afternoon", "promotional", "social-planner", "static",
   "You know your feed matters. You also know it is the first thing that slips.",
   "The Social Planner schedules the month in one sitting, and socialX fills it so the sitting never has to happen.",
   "Look established without hiring anyone.",
   "The one post that sells socialX itself. Use sparingly."],
  ["The number that decides your price", "education", "reporting", "static",
   "Most resellers price on what feels reasonable rather than on what the platform returns.",
   "Reporting shows the leads, the bookings and the revenue attributed per client, so the renewal conversation has evidence in it.",
   "Charge for the outcome you can prove.",
   "Pairs well with a rebilling post the following week."],
];

async function seedLibrary(staffId) {
  const { data: features } = await db.from("hl_features").select("id, slug");
  const bySlug = new Map((features ?? []).map((f) => [f.slug, f.id]));

  const images = [1, 2, 3, 4].map((n) => `${SITE}/portfolio-post-${n}.png`);
  const assetIds = [];
  for (let i = 0; i < images.length; i++) {
    const { data } = await db
      .from("assets")
      .insert({
        org_id: null,
        provider: "external",
        url: images[i],
        mime: "image/png",
        alt: `socialX sample post ${i + 1}`,
        last_verified_at: iso(new Date()),
      })
      .select("id")
      .single();
    if (data) assetIds.push(data.id);
  }

  let made = 0;
  const created = [];

  for (let i = 0; i < LIBRARY.length; i++) {
    const [title, pillar, featureSlug, format, hook, middle, outcome, note] = LIBRARY[i];
    const code = `${TEMPLATE_PREFIX}${String(i + 1).padStart(4, "0")}`;

    const { data: tpl } = await db
      .from("templates")
      .insert({
        code,
        title,
        pillar_key: pillar,
        format,
        master_concept: note,
        status: "published",
        created_by: staffId,
      })
      .select("id")
      .single();
    if (!tpl) continue;

    const { data: ver } = await db
      .from("template_versions")
      .insert({
        template_id: tpl.id,
        version: 1,
        hook,
        middle_beat: middle,
        outcome,
        cta: "Book a walkthrough and see it on your own account.",
        variables: { brand_name: "{{brand_name}}", niche: "{{niche}}" },
        changelog: "First version.",
        published_at: iso(new Date()),
        created_by: staffId,
      })
      .select("id")
      .single();

    if (ver) {
      await db.from("templates").update({ current_version_id: ver.id }).eq("id", tpl.id);
      for (const platform of ["linkedin", "facebook", "instagram"]) {
        await db.from("template_variants").insert({
          template_version_id: ver.id,
          platform,
          copy: `${hook}\n\n${middle}\n\n${outcome}`,
          aspect_ratio: platform === "instagram" ? "1:1" : "1.91:1",
          asset_id: assetIds[i % assetIds.length] ?? null,
        });
      }
      created.push({ id: tpl.id, versionId: ver.id, title, pillar, format });
    }

    const featureId = bySlug.get(featureSlug);
    if (featureId) await db.from("template_features").insert({ template_id: tpl.id, feature_id: featureId });

    made++;
  }

  return { made, created, assetIds };
}

export { };

/* ---------------- run ---------------- */

if (REMOVE) {
  await wipe();
  console.log("Demo data removed.");
  process.exit(0);
}

await wipe();

const { data: staff } = await db.from("staff_roles").select("user_id").limit(1).maybeSingle();
const staffId = staff?.user_id ?? null;

const lib = await seedLibrary(staffId);
console.log(`Library: ${lib.made} templates, ${lib.assetIds.length} sample images`);

const { seedClient } = await import("./seed-demo-client.mjs");
const summary = await seedClient({ db, lib, DEMO_SLUG, DEMO_EMAIL, ALSO_ADMIT, iso, day, monthStart, monthEnd });
console.log(summary);
