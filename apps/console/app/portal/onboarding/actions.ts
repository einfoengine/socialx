"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg, assertNotViewingAs } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";
import { createServiceClient } from "@socialx/core/supabase/service";

/**
 * Onboarding.
 *
 * Replaces the embedded HighLevel survey at /onbording. The difference that matters
 * is not the styling: this writes into brand_profiles and brand_platforms, so the
 * batch builder can actually read it. Form submissions sitting in HighLevel could not
 * be used by anything downstream.
 */
export async function saveOnboarding(formData: FormData) {
  const session = await requireOrg();
  assertNotViewingAs(session);
  const supabase = await createClient();

  const platforms = formData.getAll("platforms").map(String).filter(Boolean);

  // Entitlements cap how many platforms this plan may run.
  const service = createServiceClient();
  const { data: sub } = await service
    .from("subscriptions")
    .select("plan_id")
    .eq("org_id", session.orgId)
    .maybeSingle();

  let cap = 4;
  if (sub?.plan_id) {
    const { data: ent } = await service
      .from("plan_entitlements")
      .select("platforms_max")
      .eq("plan_id", sub.plan_id)
      .maybeSingle();
    if (ent) cap = ent.platforms_max;
  }

  const chosen = platforms.slice(0, cap);

  const niches = String(formData.get("niches") ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const banned = String(formData.get("banned_words") ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  await supabase.from("brand_profiles").upsert(
    {
      org_id: session.orgId,
      brand_name: String(formData.get("brand_name") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      voice_notes: String(formData.get("voice_notes") ?? "").trim() || null,
      positioning: String(formData.get("positioning") ?? "").trim() || null,
      icp_notes: String(formData.get("icp_notes") ?? "").trim() || null,
      niches,
      banned_words: banned,
      approver_name: String(formData.get("approver_name") ?? "").trim() || null,
      approver_email: String(formData.get("approver_email") ?? "").trim() || null,
      colors: {
        primary: String(formData.get("color_primary") ?? "").trim() || null,
        secondary: String(formData.get("color_secondary") ?? "").trim() || null,
      },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );

  // Replace the platform set rather than accumulating stale rows.
  await supabase.from("brand_platforms").delete().eq("org_id", session.orgId);
  if (chosen.length > 0) {
    await supabase.from("brand_platforms").insert(
      chosen.map((p) => ({ org_id: session.orgId, platform: p, is_active: true }))
    );
  }

  // Their HighLevel subaccount, if they know it. Optional: it can be filled later.
  const hlLocation = String(formData.get("hl_location_id") ?? "").trim();

  await service
    .from("organizations")
    .update({
      status: "active",
      hl_location_id: hlLocation || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.orgId);

  await service.from("activity_log").insert({
    actor_id: session.userId,
    org_id: session.orgId,
    entity: "brand_profile",
    action: "onboarding_completed",
    diff: { platforms: chosen, niches },
  });

  revalidatePath("/portal");
  redirect("/portal?onboarded=1");
}
