"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Batch assembly.
 *
 * Quota is read from the batch, not from the current plan. It was snapshotted at
 * creation, so a mid cycle upgrade cannot rewrite the terms of work already in
 * production, and a downgrade cannot invalidate posts already built.
 */

async function quotaState(supabase: Awaited<ReturnType<typeof createClient>>, batchId: string) {
  const [{ data: batch }, { data: posts }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, org_id, quota_posts, quota_motion, quota_platforms, status")
      .eq("id", batchId)
      .single(),
    supabase.from("posts").select("id, format").eq("batch_id", batchId),
  ]);

  const used = posts?.length ?? 0;
  const motionUsed = (posts ?? []).filter((p) => p.format === "motion").length;
  return { batch, used, motionUsed };
}

/** Adds a library template to a batch as a customizable post instance. */
export async function addPostFromTemplate(formData: FormData) {
  const session = await requireStaff();
  const supabase = await createClient();

  const batchId = String(formData.get("batch_id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  if (!batchId || !templateId) return;

  const { batch, used, motionUsed } = await quotaState(supabase, batchId);
  if (!batch) return;

  const { data: template } = await supabase
    .from("templates")
    .select("id, title, format, pillar_key, current_version_id, template_versions(id, hook, middle_beat, outcome, cta)")
    .eq("id", templateId)
    .single();

  if (!template) return;

  // The cap is a refusal, not a warning. Going over is a margin leak.
  if (used >= batch.quota_posts) {
    throw new Error(
      `This plan covers ${batch.quota_posts} posts per month and the batch already has ${used}.`
    );
  }
  if (template.format === "motion" && motionUsed >= batch.quota_motion) {
    throw new Error(
      `This plan covers ${batch.quota_motion} motion videos per month and the batch already has ${motionUsed}.`
    );
  }

  const versions = (template.template_versions ?? []) as {
    id: string;
    hook?: string | null;
    middle_beat?: string | null;
    outcome?: string | null;
    cta?: string | null;
  }[];
  const version = versions.find((v) => v.id === template.current_version_id) ?? versions[0];

  // The instance carries a copy of the text so customization never mutates the library.
  const copy = [version?.hook, version?.middle_beat, version?.outcome, version?.cta]
    .filter(Boolean)
    .join("\n\n");

  await supabase.from("posts").insert({
    batch_id: batchId,
    org_id: batch.org_id,
    template_version_id: version?.id ?? null,
    title: template.title,
    format: template.format,
    pillar_key: template.pillar_key,
    copy,
    status: "draft",
    position: used,
    created_by: session.userId,
  });

  revalidatePath(`/admin/batches/${batchId}`);
}

/** A post written from scratch, which is what Scale actually buys. */
export async function addCustomPost(formData: FormData) {
  const session = await requireStaff();
  const supabase = await createClient();

  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return;

  const { batch, used } = await quotaState(supabase, batchId);
  if (!batch) return;
  if (used >= batch.quota_posts) {
    throw new Error(`This plan covers ${batch.quota_posts} posts per month.`);
  }

  await supabase.from("posts").insert({
    batch_id: batchId,
    org_id: batch.org_id,
    template_version_id: null,
    is_custom: true,
    title: String(formData.get("title") ?? "Untitled").trim() || "Untitled",
    format: String(formData.get("format") ?? "static"),
    pillar_key: String(formData.get("pillar_key") ?? "") || null,
    copy: String(formData.get("copy") ?? "").trim() || null,
    status: "draft",
    position: used,
    created_by: session.userId,
  });

  revalidatePath(`/admin/batches/${batchId}`);
}

export async function updatePost(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const batchId = String(formData.get("batch_id") ?? "");
  if (!id) return;

  const platforms = formData.getAll("platforms").map(String).filter(Boolean);
  const scheduled = String(formData.get("scheduled_for") ?? "").trim();

  // The platform cap is also enforced by a database trigger; this is the friendly
  // version of the same rule.
  const { data: batch } = await supabase
    .from("batches")
    .select("quota_platforms")
    .eq("id", batchId)
    .single();

  if (batch && platforms.length > batch.quota_platforms) {
    throw new Error(`This plan covers ${batch.quota_platforms} platforms per post.`);
  }

  await supabase
    .from("posts")
    .update({
      title: String(formData.get("title") ?? "").trim() || null,
      copy: String(formData.get("copy") ?? "").trim() || null,
      platforms,
      scheduled_for: scheduled ? new Date(scheduled).toISOString() : null,
    })
    .eq("id", id);

  revalidatePath(`/admin/batches/${batchId}`);
}

export async function deletePost(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const batchId = String(formData.get("batch_id") ?? "");
  if (!id) return;
  await supabase.from("posts").delete().eq("id", id);
  revalidatePath(`/admin/batches/${batchId}`);
}

/**
 * Hands the batch to the client.
 *
 * Refuses if anything is unscheduled or has no platform, because a batch that
 * reaches a client half-specified wastes a revision round on our own mistake.
 */
export async function submitBatch(formData: FormData) {
  const session = await requireStaff();
  const supabase = await createClient();

  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return;

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, platforms, scheduled_for")
    .eq("batch_id", batchId);

  const incomplete = (posts ?? []).filter(
    (p) => !p.scheduled_for || !p.platforms || p.platforms.length === 0
  );

  if (incomplete.length > 0) {
    throw new Error(
      `${incomplete.length} post${incomplete.length === 1 ? " is" : "s are"} missing a date or a platform.`
    );
  }
  if ((posts ?? []).length === 0) {
    throw new Error("There is nothing in this batch to submit.");
  }

  await supabase
    .from("batches")
    .update({ status: "in_review", submitted_at: new Date().toISOString() })
    .eq("id", batchId);

  await supabase.from("posts").update({ status: "in_review" }).eq("batch_id", batchId);

  const { data: batch } = await supabase.from("batches").select("org_id").eq("id", batchId).single();
  if (batch) {
    await supabase.from("activity_log").insert({
      actor_id: session.userId,
      org_id: batch.org_id,
      entity: "batch",
      entity_id: batchId,
      action: "submitted_for_review",
      diff: { posts: (posts ?? []).length },
    });
  }

  revalidatePath(`/admin/batches/${batchId}`);
}

/** Creates the next month's batch, snapshotting quota from the plan as it stands now. */
export async function createBatch(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const orgId = String(formData.get("org_id") ?? "");
  const month = String(formData.get("month") ?? "");
  if (!orgId || !month) return;

  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!sub?.plan_id) throw new Error("That client has no subscription, so there is no quota to apply.");

  const { data: ent } = await supabase
    .from("plan_entitlements")
    .select("posts_per_month, motion_videos, platforms_max, revision_rounds")
    .eq("plan_id", sub.plan_id)
    .single();

  const { data: batch, error } = await supabase
    .from("batches")
    .insert({
      org_id: orgId,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      status: "draft",
      quota_posts: ent?.posts_per_month ?? 0,
      quota_motion: ent?.motion_videos ?? 0,
      quota_platforms: ent?.platforms_max ?? 1,
      revision_rounds_allowed: ent?.revision_rounds ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/batches");
  if (batch) redirect(`/admin/batches/${batch.id}`);
}
