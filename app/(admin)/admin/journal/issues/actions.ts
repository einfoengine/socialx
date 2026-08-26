"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["open", "in_progress", "blocked", "resolved", "wont_fix"] as const;
export type IssueStatus = (typeof STATUSES)[number];

/**
 * Moves one issue along. The only mutation this screen needs: the backlog is
 * worked one item at a time, and what changes is where each one stands.
 */
export async function setIssueStatus(formData: FormData) {
  await requirePermission("journal", "full");

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status as IssueStatus)) return;

  const supabase = await createClient();
  await supabase.from("issues").update({ status }).eq("id", id);

  revalidatePath("/admin/journal/issues");
}
