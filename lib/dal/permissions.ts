import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, type StaffSession } from "@/lib/dal/session";
import {
  emptyPermissions,
  satisfies,
  type AccessLevel,
  type PermissionMap,
  type SectionKey,
} from "@/lib/permissions";
import type { StaffRole } from "@/lib/types/db";

/**
 * Section permissions for the signed-in staff member.
 *
 * This sits on top of requireStaff, which answers "are you socialX at all". This
 * file answers "which of our screens are yours". Same doctrine as the rest of the
 * DAL: server actions are public endpoints that never pass through proxy.ts, so
 * the check on the page that rendered a form proves nothing about who posts it.
 * Every action re-checks.
 *
 * Reads go through the caller's own session, so RLS applies: staff_permissions is
 * readable by staff and writable only by an owner.
 */

export type StaffAccess = StaffSession & {
  permissions: PermissionMap;
  /** The role actually granted to this account, ignoring any preview. */
  realRole: StaffRole;
  /** True while an owner is looking at the admin through another role. */
  viewingAsRole: boolean;
};

/** Cookie naming the staff role an owner is previewing. */
export const VIEW_ROLE_COOKIE = "sx-view-role";

const STAFF_ROLES: StaffRole[] = ["owner", "ops", "content", "finance"];

export const getStaffAccess = cache(async (): Promise<StaffAccess> => {
  const session = await requireStaff();

  /*
   * Role preview. An owner can look at the admin as ops, content or finance to
   * check what that role actually reaches.
   *
   * Two rules make this safe rather than a privilege hole. Only an owner may
   * preview, and owner is never a preview target, so the effective role is
   * always narrower than the real one. Nothing here can widen access.
   */
  const jar = await cookies();
  const requested = jar.get(VIEW_ROLE_COOKIE)?.value as StaffRole | undefined;
  const canPreview =
    session.staffRole === "owner" &&
    !!requested &&
    requested !== "owner" &&
    STAFF_ROLES.includes(requested);

  const effectiveRole = canPreview ? (requested as StaffRole) : session.staffRole;

  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_permissions")
    .select("section, level")
    .eq("role", effectiveRole);

  // A section with no row reads as "none", so a screen added before its
  // permission row exists is closed rather than open.
  const permissions = emptyPermissions();
  for (const row of data ?? []) {
    if (row.section in permissions) {
      permissions[row.section as SectionKey] = row.level as AccessLevel;
    }
  }
  return {
    ...session,
    staffRole: effectiveRole,
    realRole: session.staffRole,
    viewingAsRole: canPreview,
    permissions,
  };
});

/**
 * Gate for an admin page or action. Redirects rather than throwing, so a staff
 * member who follows a stale link lands somewhere real instead of on an error.
 */
export async function requirePermission(
  section: SectionKey,
  needed: "view" | "full" = "view"
): Promise<StaffAccess> {
  const access = await getStaffAccess();
  if (!satisfies(access.permissions[section], needed)) redirect("/admin/no-access");
  return access;
}

/** Non-redirecting check, for conditionally rendering a control. */
export async function can(
  section: SectionKey,
  needed: "view" | "full" = "view"
): Promise<boolean> {
  const access = await getStaffAccess();
  return satisfies(access.permissions[section], needed);
}

/** The whole matrix, for the settings screen. Owner-only by RLS on write. */
export async function readMatrix(): Promise<Record<StaffRole, PermissionMap>> {
  const supabase = await createClient();
  const { data } = await supabase.from("staff_permissions").select("role, section, level");

  const roles: StaffRole[] = ["owner", "ops", "content", "finance"];
  const matrix = Object.fromEntries(roles.map((r) => [r, emptyPermissions()])) as Record<
    StaffRole,
    PermissionMap
  >;
  for (const row of data ?? []) {
    const role = row.role as StaffRole;
    if (matrix[role] && row.section in matrix[role]) {
      matrix[role][row.section as SectionKey] = row.level as AccessLevel;
    }
  }
  return matrix;
}
