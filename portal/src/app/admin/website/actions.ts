"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requirePermission } from "@/lib/dal/permissions";
import { createServiceClient } from "@/lib/core/supabase/service";
import { drain, emit } from "@/lib/core/webhooks";

/**
 * Website content management.
 *
 * Every action takes the site it is acting on and filters by it, and that is not
 * defensive coding: content keys are unique per site rather than globally, so a
 * write without a site would either update every website that happens to use the
 * same key or update whichever one Postgres reached first. The site id arrives as
 * a form field, which makes it caller-supplied input, so each action checks the
 * permission that gates this whole screen before it uses it.
 *
 * Each entry is a named blob of JSON a website renders. Writes happen
 * here with the service role after a permission check, so RLS needs no write
 * policy on the table at all; the same doctrine as coupons and people. Every
 * action re-checks, because a server action is a public endpoint that never
 * passes through proxy.ts.
 *
 * JSON is validated by actually parsing it, and what is stored is the parsed
 * value re-serialized, never the raw text. That means what the site reads is
 * exactly what jsonb holds, with no trailing commas or comments to disagree
 * about later.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

/* Two guards, both about the site's render path. Depth-limiting stops a
   pathological blob from stack-overflowing whatever walks it; the size cap keeps
   a single entry from bloating every page that reads it. */
const MAX_BYTES = 256 * 1024;
const MAX_DEPTH = 24;

function depthOf(v: unknown, d = 0): number {
  if (d > MAX_DEPTH || v === null || typeof v !== "object") return d;
  const vals = Array.isArray(v) ? v : Object.values(v as object);
  let max = d;
  for (const x of vals) max = Math.max(max, depthOf(x, d + 1));
  return max;
}

function parsePayload(raw: string): { data: unknown } | { error: string } {
  if (!raw.trim()) return { error: "The JSON body is empty." };
  if (new TextEncoder().encode(raw).length > MAX_BYTES) {
    return { error: `An entry is capped at ${MAX_BYTES / 1024}KB.` };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { error: `That is not valid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }
  if (depthOf(data) > MAX_DEPTH) {
    return { error: `JSON nested deeper than ${MAX_DEPTH} levels.` };
  }
  return { data };
}

function readSiteId(formData: FormData): string | null {
  const value = String(formData.get("site_id") ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/**
 * Tells the site's own endpoints that a value it renders has changed.
 *
 * After the response, never before it. A content save is the operator's action
 * and its success cannot depend on whether somebody else's server is up.
 */
function announce(siteId: string, key: string): void {
  after(async () => {
    await emit(siteId, "content.updated", { key, source: "console" });
    await drain({ siteId });
  });
}

export async function createEntryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requirePermission("website", "full");

  const siteId = readSiteId(formData);
  if (!siteId) return { ok: false, error: "Missing the site this entry belongs to." };

  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!KEY_RE.test(key)) {
    return { ok: false, error: "A key is 2 to 63 lowercase letters, digits and hyphens." };
  }

  const parsed = parsePayload(String(formData.get("data") ?? ""));
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const db = createServiceClient();
  const { data: clash } = await db
    .from("site_content")
    .select("key")
    .eq("site_id", siteId)
    .eq("key", key)
    .maybeSingle();
  if (clash) return { ok: false, error: `"${key}" already exists on this site. Edit it below.` };

  const { error } = await db.from("site_content").insert({
    site_id: siteId,
    key,
    data: parsed.data,
    description,
    updated_by: session.userId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/website");
  announce(siteId, key);
  return { ok: true, message: `"${key}" created. The site can read it now.` };
}

export async function updateEntryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requirePermission("website", "full");

  const siteId = readSiteId(formData);
  if (!siteId) return { ok: false, error: "Missing the site this entry belongs to." };

  const key = String(formData.get("key") ?? "").trim();
  if (!KEY_RE.test(key)) return { ok: false, error: "Missing the entry." };

  const parsed = parsePayload(String(formData.get("data") ?? ""));
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const description = String(formData.get("description") ?? "").trim() || null;

  const db = createServiceClient();
  const { error, count } = await db
    .from("site_content")
    .update(
      { data: parsed.data, description, updated_by: session.userId, updated_at: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("site_id", siteId)
    .eq("key", key);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: `"${key}" no longer exists.` };

  revalidatePath("/admin/website");
  announce(siteId, key);
  return { ok: true, message: `"${key}" saved.` };
}

export async function deleteEntryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("website", "full");

  const siteId = readSiteId(formData);
  if (!siteId) return { ok: false, error: "Missing the site this entry belongs to." };

  const key = String(formData.get("key") ?? "").trim();
  if (!KEY_RE.test(key)) return { ok: false, error: "Missing the entry." };

  const db = createServiceClient();
  const { error } = await db
    .from("site_content")
    .delete()
    .eq("site_id", siteId)
    .eq("key", key);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/website");
  return { ok: true, message: `"${key}" deleted. Anything on the site reading it falls back to its default.` };
}
