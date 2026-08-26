"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";

/**
 * Journal mutations.
 *
 * Every action calls requirePermission("journal", "full") first. Server actions never pass through
 * proxy.ts, so this is the only thing standing between a POST and the table,
 * with RLS underneath as the floor.
 */

export async function addBuildLogEntry(formData: FormData) {
  await requirePermission("journal", "full");
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await supabase.from("build_log_entries").insert({
    title,
    body: String(formData.get("body") ?? "").trim() || null,
    release: String(formData.get("release") ?? "").trim() || null,
    entry_date: String(formData.get("entry_date") ?? "") || undefined,
    author: String(formData.get("author") ?? "Shariful").trim() || "Shariful",
  });

  revalidatePath("/admin/journal/build-log");
}

export async function addDecision(formData: FormData) {
  await requirePermission("journal", "full");
  const supabase = await createClient();

  const topic = String(formData.get("topic") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  if (!topic || !decision) return;

  await supabase.from("decisions").insert({
    topic,
    decision,
    rationale: String(formData.get("rationale") ?? "").trim() || null,
    decided_on: String(formData.get("decided_on") ?? "") || undefined,
  });

  revalidatePath("/admin/journal/decisions");
}

/**
 * Changing a decision does not overwrite the old one. The previous decision is
 * marked superseded and the new row points back at it, so the history of why
 * something changed stays readable months later.
 */
export async function supersedeDecision(formData: FormData) {
  await requirePermission("journal", "full");
  const supabase = await createClient();

  const oldId = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "").trim();
  if (!oldId || !decision) return;

  const { data: previous } = await supabase
    .from("decisions")
    .select("topic")
    .eq("id", oldId)
    .single();

  await supabase.from("decisions").insert({
    topic: String(formData.get("topic") ?? previous?.topic ?? "").trim(),
    decision,
    rationale: String(formData.get("rationale") ?? "").trim() || null,
    supersedes_id: oldId,
  });

  await supabase.from("decisions").update({ status: "superseded" }).eq("id", oldId);

  revalidatePath("/admin/journal/decisions");
}

export async function addIdea(formData: FormData) {
  await requirePermission("journal", "full");
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await supabase.from("ideas").insert({
    title,
    detail: String(formData.get("detail") ?? "").trim() || null,
    source: "shariful",
  });

  revalidatePath("/admin/journal/ideas");
}

/**
 * Rate an idea.
 *
 * One star always deletes. That is the whole point of the control: it is a
 * discard, not a low score, so a rejected idea never comes back around later.
 * The database constraint refuses to store a 1, so this path cannot silently
 * degrade into keeping it.
 */
export async function rateIdea(formData: FormData) {
  await requirePermission("journal", "full");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  if (!id || !Number.isFinite(rating)) return;

  if (rating === 1) {
    await supabase.from("ideas").delete().eq("id", id);
  } else if (rating >= 2 && rating <= 5) {
    await supabase.from("ideas").update({ rating }).eq("id", id);
  }

  revalidatePath("/admin/journal/ideas");
}

export async function setIdeaStatus(formData: FormData) {
  await requirePermission("journal", "full");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["open", "planned", "building", "shipped", "archived"];
  if (!id || !allowed.includes(status)) return;

  await supabase.from("ideas").update({ status }).eq("id", id);
  revalidatePath("/admin/journal/ideas");
}

export async function deleteIdea(formData: FormData) {
  await requirePermission("journal", "full");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("ideas").delete().eq("id", id);
  revalidatePath("/admin/journal/ideas");
}
