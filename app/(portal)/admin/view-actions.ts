"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffAccess, VIEW_ROLE_COOKIE } from "@/lib/dal/permissions";
import { VIEW_AS_COOKIE } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/types/db";

const STAFF_ROLES: StaffRole[] = ["ops", "content", "finance"];

/**
 * The one place the view switcher writes to.
 *
 * Three destinations: back to your own account, the admin seen through a
 * narrower staff role, or a client's portal read only. Only a staff owner may
 * use any of it, checked here rather than trusted from the form.
 */
export async function setViewAs(formData: FormData) {
  const session = await getStaffAccess();
  // realRole, not staffRole: an owner previewing ops must still be able to
  // switch back, and staffRole is the previewed one.
  if (session.realRole !== "owner") redirect("/admin");

  const value = String(formData.get("view") ?? "").trim();
  const jar = await cookies();

  // Self. Clear both previews and go home.
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
    const orgId = value.slice(4);
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations").select("id").eq("id", orgId).maybeSingle();
    if (!org) redirect("/admin");

    await supabase.from("activity_log").insert({
      actor_id: session.userId,
      org_id: orgId,
      entity: "organization",
      entity_id: orgId,
      action: "viewed_client_portal",
    });

    jar.delete(VIEW_ROLE_COOKIE);
    jar.set(VIEW_AS_COOKIE, orgId, {
      httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60,
    });
    redirect("/portal");
  }

  redirect("/admin");
}
