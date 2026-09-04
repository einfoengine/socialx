"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import {
  ACCESS_LEVELS,
  SECTION_KEYS,
  isLockedRole,
  type AccessLevel,
  type SectionKey,
} from "@/lib/sections";
import type { StaffRole } from "@/lib/core/types/db";

const ROLES: StaffRole[] = ["owner", "ops", "content", "finance"];

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Writes the whole matrix in one go.
 *
 * requirePermission("settings", "full") is the gate, and the write also has to
 * pass the owner-only RLS policy on staff_permissions, so a staff member with
 * Settings access who is not an owner still cannot change who can reach what.
 * The trigger on the table refuses to demote the owner role whatever gets here.
 */
export async function savePermissionsAction(
  _prev: SaveResult | null,
  formData: FormData
): Promise<SaveResult> {
  await requirePermission("settings", "full");

  const rows: { role: StaffRole; section: SectionKey; level: AccessLevel }[] = [];

  for (const role of ROLES) {
    // The owner column is not editable, so nothing posted for it is trusted.
    if (isLockedRole(role)) continue;

    for (const section of SECTION_KEYS) {
      const raw = String(formData.get(`${role}.${section}`) ?? "");
      if (!ACCESS_LEVELS.includes(raw as AccessLevel)) {
        return { ok: false, error: `"${raw}" is not an access level.` };
      }
      rows.push({ role, section, level: raw as AccessLevel });
    }
  }

  if (rows.length === 0) return { ok: false, error: "Nothing to save." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_permissions")
    .upsert(rows, { onConflict: "role,section" });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("owner role keeps full access")
        ? "The owner role keeps full access to every section."
        : error.message,
    };
  }

  /* Every admin screen reads these on render, so the whole tree is stale. */
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Access updated. It applies on their next page load." };
}
