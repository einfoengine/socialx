"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Manual publishing receipt.
 *
 * In R2 a human loads approved posts into the client's HL Social Planner and marks
 * them here. R4 replaces this step with the Social Planner API, but the state
 * machine does not change: the portal is already the record of what is scheduled,
 * so the automation later swaps out who performs the action, not what it means.
 */
export async function markScheduled(formData: FormData) {
  const session = await requireStaff();
  const supabase = await createClient();

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  const { data: post } = await supabase
    .from("posts")
    .select("id, org_id, batch_id")
    .eq("id", postId)
    .single();
  if (!post) return;

  await supabase.from("posts").update({ status: "scheduled" }).eq("id", postId);

  // A publish job is recorded even for a manual push, so R4 inherits a complete
  // history rather than starting from an empty table.
  await supabase.from("publish_jobs").insert({
    post_id: postId,
    target: "hl_social_planner",
    status: "confirmed",
    published_at: null,
    attempts: 1,
  });

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    org_id: post.org_id,
    entity: "post",
    entity_id: postId,
    action: "scheduled_manually",
  });

  // When every post in the batch is scheduled, the batch is live.
  const { data: siblings } = await supabase
    .from("posts")
    .select("status")
    .eq("batch_id", post.batch_id);

  if ((siblings ?? []).every((p) => ["scheduled", "published", "skipped"].includes(p.status))) {
    await supabase.from("batches").update({ status: "live" }).eq("id", post.batch_id);
  } else {
    await supabase.from("batches").update({ status: "scheduling" }).eq("id", post.batch_id);
  }

  revalidatePath("/admin/publishing");
}

export async function markPublished(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  await supabase
    .from("posts")
    .update({ status: "published" })
    .eq("id", postId);

  await supabase
    .from("publish_jobs")
    .update({ status: "confirmed", published_at: new Date().toISOString() })
    .eq("post_id", postId);

  revalidatePath("/admin/publishing");
}
