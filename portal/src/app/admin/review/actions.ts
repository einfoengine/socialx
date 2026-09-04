"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";

export async function resolveRevision(formData: FormData) {
  await requirePermission("review", "full");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("revisions")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);

  // When every note in a batch is resolved, the batch goes back into production so
  // it can be resubmitted. It does not jump straight to review: someone still has to
  // do the work the note asked for.
  const { data: rev } = await supabase.from("revisions").select("batch_id").eq("id", id).single();
  if (rev) {
    const { data: remaining } = await supabase
      .from("revisions")
      .select("id")
      .eq("batch_id", rev.batch_id)
      .eq("status", "open");

    if ((remaining ?? []).length === 0) {
      await supabase.from("batches").update({ status: "in_production" }).eq("id", rev.batch_id);
    }
  }

  revalidatePath("/admin/review");
}
