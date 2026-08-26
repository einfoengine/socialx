"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffAccess, VIEW_ROLE_COOKIE } from "@/lib/dal/permissions";
import { VIEW_AS_COOKIE } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";
import type { StaffRole } from "@socialx/core/types/db";

/**
 * Switching whose eyes you are looking through.
 *
 * These live outside both route areas on purpose. Viewing as a client is
 * started from /admin and exited from /portal, so putting them under either one
 * makes the other import across the boundary. The client portal has no business
 * depending on an admin route's module.
 *
 * Only a staff owner may use any of it, checked here rather than trusted from
 * the form.
 */

const STAFF_ROLES: StaffRole[] = ["ops", "content", "finance"];

export async function setViewAs(formData: FormData) {
  const session = await getStaffAccess();
  // realRole, not staffRole: an owner previewing ops must still be able to
  // switch back, and staffRole is the previewed one.
  if (session.realRole !== "owner") redirect("/admin");

  const value = String(formData.get("view") ?? "").trim();
  const jar = await cookies();

  if (value === "self") {
    jar.delete(VIEW_ROLE_COOKIE);
    jar.delete(VIEW_AS_COOKIE);
    redirect("/admin");
  }

  const secure = process.env.NODE_ENV === "production";

  if (value.startsWith("role:")) {
    const role = value.slice(5) as StaffRole;
    if (!STAFF_ROLES.includes(role)) redirect("/admin");

    // A role preview and a client preview are different places to be standing.
    jar.delete(VIEW_AS_COOKIE);
    jar.set(VIEW_ROLE_COOKIE, role, {
      httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60,
    });
    redirect("/admin");
  }

  if (value.startsWith("org:")) {
    await startClientPreview(value.slice(4));
  }

  redirect("/admin");
}

/** Entry point from a client's admin record. */
export async function viewClientPortal(formData: FormData) {
  const session = await getStaffAccess();
  if (session.permissions.clients === "none") redirect("/admin");
  await startClientPreview(String(formData.get("org_id") ?? "").trim());
  redirect("/admin/clients");
}

/** Ends the preview and goes back to the client's admin record. */
export async function exitClientPortal() {
  const jar = await cookies();
  const orgId = jar.get(VIEW_AS_COOKIE)?.value;
  jar.delete(VIEW_AS_COOKIE);
  redirect(orgId ? `/admin/clients/${orgId}` : "/admin/clients");
}

/* Shared by both entry points, so the audit record and the cookie shape cannot
   drift apart depending on which control was used. */
async function startClientPreview(orgId: string): Promise<never> {
  if (!orgId) redirect("/admin/clients");

  const session = await getStaffAccess();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations").select("id").eq("id", orgId).maybeSingle();
  if (!org) redirect("/admin/clients");

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    org_id: orgId,
    entity: "organization",
    entity_id: orgId,
    action: "viewed_client_portal",
  });

  const jar = await cookies();
  jar.delete(VIEW_ROLE_COOKIE);
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
