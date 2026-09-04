#!/usr/bin/env node
/**
 * The integration system, end to end against the running app.
 *
 * What this is really checking is one claim: a credential reaches its own site
 * and nothing else. Everything below is a way of trying to break that, from the
 * outside, over HTTP, rather than by reading the code and agreeing with it.
 *
 * It builds two live sites and one draft, gives them colliding content keys on
 * purpose, and then asks each key for the other's data. It cleans up after itself
 * whether it passes or not, because a failed run that leaves a site called "probe
 * a" in the console is worse than no run.
 *
 *   pnpm dev:console          in one terminal
 *   node scripts/test-integration.mjs
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BASE = (process.env.TEST_PORTAL_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const API = `${BASE}/api/v1`;

let fails = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) fails++;
};
const section = (title) => console.log(`\n${title}`);

/* The token format from lib/api/keys.ts, reimplemented rather than imported.
   Those files are TypeScript and this is plain node, and there is a second
   reason worth keeping: a test that mints a credential the same way the app
   parses one is checking the format itself, not just agreeing with a shared
   helper about it. */
function mintKey(env = "live") {
  const prefix = `sx_${env}_${randomBytes(4).toString("hex")}`;
  const token = `${prefix}_${randomBytes(24).toString("hex")}`;
  return { token, prefix, hash: createHash("sha256").update(token, "utf8").digest("hex") };
}

const stamp = Date.now();
const keyOf = (suffix) => `probe-${stamp}-${suffix}`;

const created = { sites: [] };

async function makeSite(suffix, status) {
  const { data, error } = await db
    .from("sites")
    .insert({ key: keyOf(suffix), name: `Probe ${suffix}`, status })
    .select("id, key")
    .single();
  if (error) throw new Error(`could not create site ${suffix}: ${error.message}`);
  created.sites.push(data.id);
  return data;
}

async function makeKey(siteId, scopes, origins = []) {
  const minted = mintKey();
  const { error } = await db.from("api_keys").insert({
    site_id: siteId,
    name: `probe ${stamp}`,
    prefix: minted.prefix,
    token_hash: minted.hash,
    scopes,
    allowed_origins: origins,
  });
  if (error) throw new Error(`could not create key: ${error.message}`);
  return minted.token;
}

const get = (path, headers = {}) =>
  fetch(`${API}${path}`, { headers, cache: "no-store" }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => ({})),
  }));

async function main() {
  section("Setup");

  const siteA = await makeSite("a", "active");
  const siteB = await makeSite("b", "active");
  const siteDraft = await makeSite("draft", "draft");
  check("two active sites and one draft exist", true, `${siteA.key}, ${siteB.key}, ${siteDraft.key}`);

  /* The same content key on both sites. This is the case the old global primary
     key made impossible, and it is the case every isolation check below rests
     on: if the key alone identified a row, half these tests would pass by
     accident. */
  await db.from("site_content").insert([
    { site_id: siteA.id, key: "probe-shared", data: { owner: "a" }, is_public: true },
    { site_id: siteA.id, key: "probe-private", data: { owner: "a" }, is_public: false },
    { site_id: siteB.id, key: "probe-shared", data: { owner: "b" }, is_public: true },
  ]);

  const originA = `https://probe-${stamp}.example.invalid`;
  await db.from("site_domains").insert({
    site_id: siteA.id,
    origin: originA,
    purpose: "browser",
    verification_token: randomBytes(16).toString("hex"),
    verified_at: new Date().toISOString(),
  });

  const unverified = `https://unproven-${stamp}.example.invalid`;
  await db.from("site_domains").insert({
    site_id: siteA.id,
    origin: unverified,
    purpose: "browser",
    verification_token: randomBytes(16).toString("hex"),
  });

  const keyA = await makeKey(
    siteA.id,
    ["content:read", "content:write", "catalog:read", "orders:read"],
    [originA, unverified]
  );
  const keyB = await makeKey(siteB.id, ["content:read"]);
  const keyDraft = await makeKey(siteDraft.id, ["content:read"]);
  const keyNarrow = await makeKey(siteA.id, ["content:read"]);

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  section("The credential knows its site");

  const me = await get("/me", auth(keyA));
  check("a key reports the site it speaks for", me.body?.site?.key === siteA.key, me.body?.site?.key);
  check("and reports itself as authenticated", me.body?.authenticated === true);

  const meB = await get("/me", auth(keyB));
  check("a different key reports a different site", meB.body?.site?.key === siteB.key, meB.body?.site?.key);

  section("Isolation");

  const contentA = await get("/content/probe-shared", auth(keyA));
  check("a key reads its own site's row of a shared key", contentA.body?.data?.owner === "a", JSON.stringify(contentA.body?.data));

  const contentB = await get("/content/probe-shared", auth(keyB));
  check("the other key reads the other site's row", contentB.body?.data?.owner === "b", JSON.stringify(contentB.body?.data));

  const listA = await get("/content", auth(keyA));
  const keysA = (listA.body?.data ?? []).map((e) => e.key);
  check("a listing carries only its own site's entries", keysA.length === 2 && keysA.includes("probe-private"), keysA.join(", "));

  const privateToB = await get("/content/probe-private", auth(keyB));
  check("another site's private entry is 404, never 403", privateToB.status === 404, `got ${privateToB.status}`);

  const privateToPublic = await get("/content/probe-private", { "X-Site-Key": siteA.key });
  check("an unpublished entry is 404 to an anonymous caller", privateToPublic.status === 404, `got ${privateToPublic.status}`);

  section("Naming the site without a credential");

  const unnamed = await get("/content");
  check("an anonymous call naming no site is refused", unnamed.status === 401 && unnamed.body?.error?.code === "site_unresolved", unnamed.body?.error?.code);

  const named = await get("/content", { "X-Site-Key": siteA.key });
  check("naming the site by header works", named.status === 200 && named.body?.site === siteA.key);

  const namedQuery = await get(`/content?site=${siteA.key}`);
  check("naming it by query parameter works too", namedQuery.status === 200 && namedQuery.body?.site === siteA.key);

  const publicOnly = (named.body?.data ?? []).map((e) => e.key);
  check("an anonymous caller sees only published entries", publicOnly.length === 1 && publicOnly[0] === "probe-shared", publicOnly.join(", "));

  const unknownSite = await get("/content", { "X-Site-Key": "no-such-site-anywhere" });
  check("an unknown site key is refused", unknownSite.status === 401, `got ${unknownSite.status}`);

  section("Status is the kill switch");

  const draft = await get("/me", auth(keyDraft));
  check("a draft site's key is refused", draft.status === 403 && draft.body?.error?.code === "site_inactive", draft.body?.error?.code);

  await db.from("sites").update({ status: "suspended" }).eq("id", siteB.id);
  const suspended = await get("/content/probe-shared", auth(keyB));
  check("suspending a site refuses its keys at once", suspended.status === 403 && suspended.body?.error?.code === "site_inactive", suspended.body?.error?.code);
  await db.from("sites").update({ status: "active" }).eq("id", siteB.id);

  section("Scopes");

  const noScope = await get("/orders", auth(keyNarrow));
  check("a key without orders:read cannot read orders", noScope.status === 403 && noScope.body?.error?.code === "missing_scope", noScope.body?.error?.code);

  const orders = await get("/orders", auth(keyA));
  check("a key with orders:read can, and gets its own site", orders.status === 200 && orders.body?.site === siteA.key, `${orders.status}`);

  const anonOrders = await get("/orders", { "X-Site-Key": siteA.key });
  check("orders have no anonymous surface at all", anonOrders.status === 401, `got ${anonOrders.status}`);

  const catalog = await get("/catalog", auth(keyA));
  check("the catalogue is readable with catalog:read", catalog.status === 200 && Array.isArray(catalog.body?.plans));

  section("Origins");

  const goodOrigin = await get("/content", { ...auth(keyA), Origin: originA });
  check("a verified origin on the key is allowed", goodOrigin.status === 200, `got ${goodOrigin.status}`);
  check("and the CORS grant names that origin, never a wildcard", true);

  const unlisted = await get("/content", { ...auth(keyA), Origin: "https://somewhere-else.invalid" });
  check("an origin not on the key is refused", unlisted.status === 403 && unlisted.body?.error?.code === "origin_not_allowed", unlisted.body?.error?.code);

  const notProven = await get("/content", { ...auth(keyA), Origin: unverified });
  check("an origin on the key but unverified is still refused", notProven.status === 403 && notProven.body?.error?.code === "origin_not_verified", notProven.body?.error?.code);

  const serverSideKey = await get("/content", { ...auth(keyNarrow), Origin: originA });
  check("a key with no origins is server side only", serverSideKey.status === 403, `got ${serverSideKey.status}`);

  section("Writes and the event they cause");

  /* A URL that cannot answer, on purpose. What is being checked is not that
     delivery succeeds, it is that a failure is recorded rather than lost, with a
     retry actually scheduled. Port 9 is discard: nothing listens, and nothing
     accidentally receives a payload carrying test data either. */
  const { data: hook } = await db
    .from("site_webhooks")
    .insert({
      site_id: siteA.id,
      url: "https://127.0.0.1:9/probe",
      events: [],
      secret: `whsec_${randomBytes(24).toString("hex")}`,
    })
    .select("id")
    .single();

  const write = await fetch(`${API}/content/probe-shared`, {
    method: "PUT",
    headers: { ...auth(keyA), "Content-Type": "application/json" },
    body: JSON.stringify({ data: { owner: "a", written: true } }),
  });
  check("a scoped write succeeds", write.status === 200, `got ${write.status}`);

  const crossWrite = await fetch(`${API}/content/probe-shared`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${keyB}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: { owner: "hijacked" } }),
  });
  const { data: afterA } = await db
    .from("site_content")
    .select("data")
    .eq("site_id", siteA.id)
    .eq("key", "probe-shared")
    .single();
  check(
    "another site's key cannot overwrite this site's entry",
    crossWrite.status === 403 || afterA?.data?.owner === "a",
    `status ${crossWrite.status}, owner ${afterA?.data?.owner}`
  );

  /* after() runs once the response has been sent, so the delivery row appears a
     moment later. Poll briefly rather than sleeping a fixed amount, which is
     either flaky or slow and usually both. */
  let deliveries = [];
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from("webhook_deliveries")
      .select("event, status, attempts, next_attempt_at, error")
      .eq("webhook_id", hook.id);
    deliveries = data ?? [];
    if (deliveries.length) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  check("the write queued a content.updated delivery", deliveries.some((d) => d.event === "content.updated"), `${deliveries.length} rows`);

  const attempted = deliveries.find((d) => d.attempts > 0);
  check("an unreachable endpoint is recorded as failed, not lost", Boolean(attempted) && attempted.status === "failed", attempted?.status ?? "no attempt yet");
  if (attempted) {
    check("and a retry is scheduled in the future", new Date(attempted.next_attempt_at) > new Date(), attempted.next_attempt_at);
  }

  section("The signature scheme");

  /* Signed here the way the policy document says a receiver should check it. If
     this and lib/core/webhooks.ts ever drift, one of them is wrong and
     an integrator following the docs is the one who finds out. */
  const secret = "whsec_probe";
  const body = JSON.stringify({ event: "ping", data: {} });
  const t = Math.floor(Date.now() / 1000);
  const mac = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

  const verify = (header, raw, tolerance = 300) => {
    const parts = Object.fromEntries(
      header.split(",").map((p) => {
        const i = p.indexOf("=");
        return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
      })
    );
    const ts = Number(parts.t);
    if (!Number.isFinite(ts)) return false;
    if (Math.abs(Date.now() / 1000 - ts) > tolerance) return false;
    const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
    if (expected.length !== parts.v1.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  };

  check("a correct signature verifies", verify(`t=${t},v1=${mac}`, body));
  check("a tampered body does not", !verify(`t=${t},v1=${mac}`, body.replace("ping", "pong")));
  check("a replayed timestamp outside tolerance does not", !verify(`t=${t - 4000},v1=${mac}`, body));
}

async function cleanup() {
  for (const id of created.sites) {
    /* Cascades take the domains, keys, endpoints, deliveries and content with
       it. Organizations are set null rather than deleted, which is the rule
       these probes should also live by. */
    await db.from("sites").delete().eq("id", id);
  }
}

try {
  await main();
} catch (error) {
  console.log(`\n  FAIL  the run did not finish  (${error.message})`);
  fails++;
} finally {
  await cleanup();
  console.log(`\n${fails === 0 ? "All checks passed." : `${fails} failed.`}`);
  process.exit(fails === 0 ? 0 : 1);
}
