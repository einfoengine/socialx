"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/supabase/server";

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
