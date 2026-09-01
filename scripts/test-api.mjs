#!/usr/bin/env node
/**
 * End to end check of the content API after migration 0024.
 *
 *   pnpm dev:console          # in one terminal
 *   pnpm test:api             # in another
 *
 * Proves the things that cannot be proven by reading the code, because they only
 * happen when a real request meets a real row:
 *
 *   1. a key with no origins works server side and is refused from a browser
 *   2. a key with an origin list works from a listed domain and only that one
 *   3. an unlisted domain is refused by this server, not merely denied CORS
 *   4. scopes are enforced, so a read-only key cannot write
 *   5. a public entry answers with no credential and a private one 404s
 *   6. revoking takes effect on the very next request
 *
 * Everything it creates is prefixed and deleted at the end, so it never touches
 * a real key or a real content entry.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
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

const BASE = (process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3001").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const ALLOWED = "https://example-allowed.test";
const BLOCKED = "https://example-blocked.test";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failed = false;
const report = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed = true;
};

/** Mints the same shape apps/console/lib/api/keys.ts does. */
function mint(env = "test") {
  const prefix = `sx_${env}_${randomBytes(4).toString("hex")}`;
  const token = `${prefix}_${randomBytes(24).toString("hex")}`;
  return { prefix, token, tokenHash: createHash("sha256").update(token, "utf8").digest("hex") };
}

async function call(path, { token, origin, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  if (body) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${API}${path}`, { method, headers, body });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* 204 and other empty bodies. */
    }
    return { status: res.status, json, cors: res.headers.get("access-control-allow-origin") };
  } catch (e) {
    return { status: 0, json: null, cors: null, error: e.message };
  }
}

// The console has to be running; everything below is meaningless otherwise.
const reach = await call("/me");
if (reach.status === 0) {
  console.error(`Cannot reach ${API}. Start the console with pnpm dev:console.`);
  process.exit(1);
}

const serverKey = mint();
const browserKey = mint();
const readOnlyKey = mint();
const CONTENT_PUBLIC = "smoke-api-public";
const CONTENT_PRIVATE = "smoke-api-private";

const cleanup = async () => {
  await db.from("api_keys").delete().in("prefix", [serverKey.prefix, browserKey.prefix, readOnlyKey.prefix]);
  await db.from("site_content").delete().in("key", [CONTENT_PUBLIC, CONTENT_PRIVATE]);
};

try {
  const { error: seedErr } = await db.from("api_keys").insert([
    { name: "smoke server side", prefix: serverKey.prefix, token_hash: serverKey.tokenHash,
      scopes: ["content:read", "content:write"], allowed_origins: [] },
    { name: "smoke browser", prefix: browserKey.prefix, token_hash: browserKey.tokenHash,
      scopes: ["content:read", "content:write"], allowed_origins: [ALLOWED] },
    { name: "smoke read only", prefix: readOnlyKey.prefix, token_hash: readOnlyKey.tokenHash,
      scopes: ["content:read"], allowed_origins: [] },
  ]);
  report("seed keys", !seedErr, seedErr?.message);
  if (seedErr) throw new Error("cannot continue without keys");

  const { error: cErr } = await db.from("site_content").insert([
    { key: CONTENT_PUBLIC, data: { hello: "world" }, description: "smoke test", is_public: true },
    { key: CONTENT_PRIVATE, data: { secret: true }, description: "smoke test", is_public: false },
  ]);
  report("seed content", !cErr, cErr?.message);

  // 1. Server side key: no origin, works. With an origin, refused.
  let r = await call("/me", { token: serverKey.token });
  report("server key authenticates", r.status === 200 && r.json?.authenticated === true, `status ${r.status}`);

  r = await call("/me", { token: serverKey.token, origin: BLOCKED });
  report(
    "server key refuses any browser origin",
    r.status === 403 && r.json?.error?.code === "origin_not_allowed",
    `status ${r.status}`
  );

  // 2 and 3. Domain allowlist: the listed one passes, anything else does not.
  r = await call("/me", { token: browserKey.token, origin: ALLOWED });
  report(
    "listed domain is allowed, and gets that exact origin back",
    r.status === 200 && r.cors === ALLOWED,
    `status ${r.status}, cors ${r.cors}`
  );

  r = await call("/me", { token: browserKey.token, origin: BLOCKED });
  report(
    "unlisted domain is refused by the server, not just by CORS",
    r.status === 403 && r.json?.error?.code === "origin_not_allowed" && r.cors !== BLOCKED,
    `status ${r.status}, cors ${r.cors}`
  );

  // 4. Scopes.
  r = await call(`/content/${CONTENT_PRIVATE}`, {
    token: readOnlyKey.token, method: "PUT", body: JSON.stringify({ data: { nope: true } }),
  });
  report(
    "read only key cannot write",
    r.status === 403 && r.json?.error?.code === "missing_scope",
    `status ${r.status}`
  );

  r = await call(`/content/${CONTENT_PRIVATE}`, {
    token: serverKey.token, method: "PUT", body: JSON.stringify({ data: { written: true } }),
  });
  report("write scope writes", r.status === 200 && r.json?.written === true, `status ${r.status}`);

  const { data: after } = await db.from("site_content").select("data").eq("key", CONTENT_PRIVATE).maybeSingle();
  report("the write landed", after?.data?.written === true);

  // 5. The public surface.
  r = await call(`/content/${CONTENT_PUBLIC}`);
  report("public entry answers with no credential", r.status === 200, `status ${r.status}`);

  r = await call(`/content/${CONTENT_PRIVATE}`);
  report(
    "private entry is invisible without a key, as 404 not 403",
    r.status === 404,
    `status ${r.status}`
  );

  r = await call("/content");
  const listed = (r.json?.data ?? []).map((e) => e.key);
  report(
    "public list omits private entries",
    listed.includes(CONTENT_PUBLIC) && !listed.includes(CONTENT_PRIVATE)
  );

  r = await call("/content", { token: readOnlyKey.token });
  const listedWithKey = (r.json?.data ?? []).map((e) => e.key);
  report("a key sees private entries too", listedWithKey.includes(CONTENT_PRIVATE));

  // 6. Revocation, effective immediately.
  await db.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("prefix", serverKey.prefix);
  r = await call("/me", { token: serverKey.token });
  report(
    "a revoked key stops working on the next request",
    r.status === 401 && r.json?.error?.code === "key_revoked",
    `status ${r.status}`
  );
} finally {
  await cleanup();
  console.log("cleaned up");
}

process.exit(failed ? 1 : 0);
