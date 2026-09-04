"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createServiceClient } from "@/lib/core/supabase/service";
import type { ActionResult } from "../types";

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

/**
 * Publishing a content entry to the unauthenticated API.
 *
 * One row at a time, on purpose. A bulk "publish all" control is exactly the
 * shape of the mistake this flag exists to prevent, and the set is small enough
 * that a per-row toggle costs nobody anything.
 *
 * What this does not do is change the entry's data. Publishing and editing are
 * separate decisions and separate screens, so nobody changes what an entry says
 * while also changing who can read it.
 *
 * Scoped to a site, because a content key identifies a row only together with
 * one. Without the site filter, publishing "hero" would publish every site's
 * hero at once, which is the single worst thing this screen could do quietly.
 */
export async function setPublicAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("settings", "full");

  const siteId = String(formData.get("site_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) {
    return { ok: false, error: "Missing the site this entry belongs to." };
  }

  const key = String(formData.get("key") ?? "").trim();
  if (!KEY_RE.test(key)) return { ok: false, error: "Missing the entry." };

  const next = String(formData.get("next") ?? "") === "true";

  const db = createServiceClient();
  const { error, count } = await db
    .from("site_content")
    .update({ is_public: next }, { count: "exact" })
    .eq("site_id", siteId)
    .eq("key", key);

  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: `"${key}" no longer exists.` };

  revalidatePath("/admin/settings/public-api");
  return {
    ok: true,
    message: next
      ? `"${key}" is now readable by anyone, with no key.`
      : `"${key}" is private again. Only a key with content:read reaches it.`,
  };
}
