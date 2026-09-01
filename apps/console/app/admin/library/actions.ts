"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";

/**
 * Library mutations.
 *
 * The library is socialX IP, so every action is staff gated here and the tables
 * carry no client policy at all. A client session cannot read a template even
 * through a malformed query.
 */

function code(n: number) {
  return `SX-${String(n).padStart(4, "0")}`;
}

export async function createTemplate(formData: FormData) {
  const session = await requirePermission("library", "full");
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const pillar = String(formData.get("pillar_key") ?? "").trim();
  if (!title || !pillar) return;

  // Next code in sequence. A gap is harmless; collisions are not, so the unique
  // constraint is the real guard and this is only for readability.
  const { count } = await supabase.from("templates").select("*", { count: "exact", head: true });
  const nextCode = code((count ?? 0) + 1);

  const { data: template, error } = await supabase
    .from("templates")
    .insert({
      code: nextCode,
      title,
      pillar_key: pillar,
      format: String(formData.get("format") ?? "static"),
      master_concept: String(formData.get("master_concept") ?? "").trim() || null,
      status: "draft",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !template) throw new Error(error?.message ?? "Could not create the template.");

  // Version 1, holding the copy law as four separate beats.
  const { data: version } = await supabase
    .from("template_versions")
    .insert({
      template_id: template.id,
      version: 1,
      hook: String(formData.get("hook") ?? "").trim() || null,
      middle_beat: String(formData.get("middle_beat") ?? "").trim() || null,
      outcome: String(formData.get("outcome") ?? "").trim() || null,
      cta: String(formData.get("cta") ?? "").trim() || null,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (version) {
    await supabase.from("templates").update({ current_version_id: version.id }).eq("id", template.id);
  }

  const features = formData.getAll("features").map(String).filter(Boolean);
  if (features.length) {
    await supabase
      .from("template_features")
      .insert(features.map((feature_id) => ({ template_id: template.id, feature_id })));
  }

  revalidatePath("/admin/library");
  redirect(`/admin/library/${template.id}`);
}

/**
 * Saves a new version rather than editing in place.
 *
 * Posts reference a template_version_id, so overwriting copy would silently rewrite
 * history for every client post already built from it. A new version keeps the old
 * one addressable, which is the only way to answer which live posts are running
 * stale copy after HighLevel ships a change.
 */
export async function saveVersion(formData: FormData) {
  const session = await requirePermission("library", "full");
  const supabase = await createClient();

  const templateId = String(formData.get("template_id") ?? "");
  if (!templateId) return;

  const { data: latest } = await supabase
    .from("template_versions")
    .select("version")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { data: version, error } = await supabase
    .from("template_versions")
    .insert({
      template_id: templateId,
      version: nextVersion,
      hook: String(formData.get("hook") ?? "").trim() || null,
      middle_beat: String(formData.get("middle_beat") ?? "").trim() || null,
      outcome: String(formData.get("outcome") ?? "").trim() || null,
      cta: String(formData.get("cta") ?? "").trim() || null,
      changelog: String(formData.get("changelog") ?? "").trim() || null,
      published_at: new Date().toISOString(),
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !version) throw new Error(error?.message ?? "Could not save the version.");

  await supabase.from("templates").update({ current_version_id: version.id }).eq("id", templateId);

  revalidatePath(`/admin/library/${templateId}`);
}

export type DeleteResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Deletes a template outright, guarded by usage.
 *
 * posts.template_version_id is ON DELETE SET NULL, so deleting a template that a
 * client post was built from would quietly blank that post's provenance: the
 * "which live posts run stale copy" question becomes unanswerable. A template in
 * use is therefore refused here regardless of what the UI showed, and the answer
 * for it is status=retired on the detail screen. Versions, feature tags and
 * variants cascade from the template row itself.
 *
 * Takes (prev, formData) because the list drives it through useActionState: a
 * refusal belongs next to the button, not in an error boundary.
 */
export async function deleteTemplate(
  _prev: DeleteResult | null,
  formData: FormData
): Promise<DeleteResult> {
  await requirePermission("library", "full");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing the template." };

  const { data: versions } = await supabase
    .from("template_versions")
    .select("id")
    .eq("template_id", id);
  const versionIds = (versions ?? []).map((v) => v.id);

  if (versionIds.length) {
    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .in("template_version_id", versionIds);
    if (count) {
      return {
        ok: false,
        error: `In use by ${count} client post${count === 1 ? "" : "s"}. Retire it from its detail page instead.`,
      };
    }
  }

  const { data: gone, error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id)
    .select("code")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!gone) return { ok: false, error: "Already deleted." };

  revalidatePath("/admin/library");
  return { ok: true, message: `${gone.code} deleted.` };
}

/**
 * One operation applied to a selection.
 *
 * Publish and retire are plain status writes. Bulk delete reuses the same rule
 * as single delete, applied per template: anything a client post was built from
 * survives, and the result says so, because "deleted 3, kept 2 that are in use"
 * is an answer and a silent partial delete is a mystery.
 */
export async function bulkTemplates(
  _prev: DeleteResult | null,
  formData: FormData
): Promise<DeleteResult> {
  await requirePermission("library", "full");
  const supabase = await createClient();

  const op = String(formData.get("op") ?? "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) return { ok: false, error: "Nothing selected." };

  if (op === "publish" || op === "retire") {
    const status = op === "publish" ? "published" : "retired";
    const { error, count } = await supabase
      .from("templates")
      .update({ status }, { count: "exact" })
      .in("id", ids);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/library");
    return { ok: true, message: `${count ?? 0} template${count === 1 ? "" : "s"} ${status}.` };
  }

  if (op !== "delete") return { ok: false, error: "Unknown operation." };

  const { data: versions } = await supabase
    .from("template_versions")
    .select("id, template_id")
    .in("template_id", ids);
  const versionIds = (versions ?? []).map((v) => v.id);

  const used = new Set<string>();
  if (versionIds.length) {
    const { data: posts } = await supabase
      .from("posts")
      .select("template_version_id")
      .in("template_version_id", versionIds);
    const owner = new Map((versions ?? []).map((v) => [v.id, v.template_id]));
    for (const post of posts ?? []) {
      const t = owner.get(post.template_version_id as string);
      if (t) used.add(t);
    }
  }

  const deletable = ids.filter((id) => !used.has(id));
  if (deletable.length) {
    const { error } = await supabase.from("templates").delete().in("id", deletable);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/library");
  const kept = ids.length - deletable.length;
  if (!deletable.length) {
    return { ok: false, error: `Nothing deleted: all ${kept} selected template${kept === 1 ? " is" : "s are"} in use by client posts. Retire them instead.` };
  }
  return {
    ok: true,
    message:
      `Deleted ${deletable.length}.` +
      (kept ? ` Kept ${kept} in use by client posts; retire ${kept === 1 ? "it" : "them"} instead.` : ""),
  };
}

export async function updateTemplateMeta(formData: FormData) {
  await requirePermission("library", "full");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("templates")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      pillar_key: String(formData.get("pillar_key") ?? "").trim(),
      format: String(formData.get("format") ?? "static"),
      status: String(formData.get("status") ?? "draft"),
      master_concept: String(formData.get("master_concept") ?? "").trim() || null,
    })
    .eq("id", id);

  // Feature tags are replaced wholesale rather than diffed.
  const features = formData.getAll("features").map(String).filter(Boolean);
  await supabase.from("template_features").delete().eq("template_id", id);
  if (features.length) {
    await supabase
      .from("template_features")
      .insert(features.map((feature_id) => ({ template_id: id, feature_id })));
  }

  revalidatePath(`/admin/library/${id}`);
}

/**
 * Marks a HighLevel feature as changed.
 *
 * This is the trigger for the mass update workflow: everything tagged with it
 * becomes visible as needing a copy review, along with the live client posts built
 * from the affected versions.
 */
export async function setFeatureStatus(formData: FormData) {
  await requirePermission("library", "full");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["active", "changed", "deprecated"].includes(status)) return;

  await supabase
    .from("hl_features")
    .update({
      status,
      last_shipped_at: status === "changed" ? new Date().toISOString().slice(0, 10) : undefined,
    })
    .eq("id", id);

  revalidatePath("/admin/library/features");
}

export async function addFeature(formData: FormData) {
  await requirePermission("library", "full");
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await supabase.from("hl_features").insert({ name, slug, status: "active" });

  revalidatePath("/admin/library/features");
}
