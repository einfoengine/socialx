"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/dal/session";

/**
 * Viewing a client's portal as socialX.
 *
 * A preview, not an impersonation. The staff member stays signed in as
 * themselves, the portal simply resolves to the chosen org, and every portal
 * mutation refuses while the cookie is set. Nothing the client would see as
 * "you approved this" can be produced from here.
 *
 * Gated on the Clients permission rather than on being staff, so the access
 * matrix governs this the same way it governs the Clients screen itself.
 */
export async function viewClientPortal(formData: FormData) {
  const access = await requirePermission("clients", "view");

  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) redirect("/admin/clients");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) redirect("/admin/clients");

  // Looking at a client's portal is worth a record, the same as any other action
  // taken against their account.
  await supabase.from("activity_log").insert({
    actor_id: access.userId,
    org_id: orgId,
    entity: "organization",
    entity_id: orgId,
    action: "viewed_client_portal",
  });

  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Short lived on purpose: a forgotten preview that silently persists is how
    // someone ends up reading the wrong org's screens a week later.
    maxAge: 60 * 60,
  });

  redirect("/portal");
}

/** Ends the preview and goes back to the client's admin record. */
export async function exitClientPortal() {
  const jar = await cookies();
  const orgId = jar.get(VIEW_AS_COOKIE)?.value;
  jar.delete(VIEW_AS_COOKIE);
  redirect(orgId ? `/admin/clients/${orgId}` : "/admin/clients");
}
