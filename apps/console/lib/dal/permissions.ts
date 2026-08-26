import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@socialx/core/supabase/server";
import { createClient as createSupabase } from "@socialx/core/supabase/server";
import { type Session } from "@/lib/dal/session";
import {
  emptyPermissions,
  satisfies,
  type AccessLevel,
  type PermissionMap,
  type SectionKey,
} from "@/lib/sections";
import type { StaffRole } from "@socialx/core/types/db";

/**
 * Section permissions for the signed-in staff member.
 *
 * This answers both "are you socialX at all" and, in the same round trip, which
 * file answers "which of our screens are yours". Same doctrine as the rest of the
 * DAL: server actions are public endpoints that never pass through proxy.ts, so
 * the check on the page that rendered a form proves nothing about who posts it.
 * Every action re-checks.
 *
 * Reads go through the caller's own session, so RLS applies: staff_permissions is
 * readable by staff and writable only by an owner.
 */

export type StaffAccess = Session & {
  staffRole: StaffRole;
  permissions: PermissionMap;
  /** The role actually granted to this account, ignoring any preview. */
  realRole: StaffRole;
  /** True while an owner is looking at the admin through another role. */
  viewingAsRole: boolean;
  /* Every organization, for the owner's view switcher. Empty for everyone else.
     Carried back by staff_context so the layout does not make a second trip to
     a database that is 300ms away. */
  orgs: { id: string; name: string }[];
};

/** Cookie naming the staff role an owner is previewing. */
export const VIEW_ROLE_COOKIE = "sx-view-role";

const STAFF_ROLES: StaffRole[] = ["owner", "ops", "content", "finance"];

export const getStaffAccess = cache(async (): Promise<StaffAccess> => {
  const supabase = await createSupabase();

  /*
   * One call instead of three. staff_context returns is_staff, the real role,
   * the effective role once any preview is applied, and the permission map,
   * because each of those used to be its own network round trip.
   *
   * The preview rules live in the function too: only an owner may preview and
   * owner is never the target, so what comes back can only ever be narrower
   * than the caller's real role.
   */
  const jar = await cookies();
  const requested = jar.get(VIEW_ROLE_COOKIE)?.value ?? null;

  /*
   * getClaims, not getUser.
   *
   * This project signs tokens with ES256 and publishes a JWKS, so getClaims
   * fetches the public key once, caches it, and verifies the signature in
   * process with WebCrypto. It checks exp itself and falls back to a real
   * getUser call if the token is ever symmetric or WebCrypto is missing, so an
   * unverifiable token is never waved through.
   *
   * What this gives up is revocation latency: a session killed server side
   * stays usable until its token expires, at most an hour. That is acceptable
   * here for one specific reason. Postgres already works this way. PostgREST
   * verifies the same JWT locally and never asks the Auth server either, so
   * every query already trusted a valid unexpired token. getUser was buying the
   * app layer a guarantee the data layer underneath it never had.
   *
   * What has NOT been given up: staff_context reads staff_roles and
   * staff_permissions live on every request, so revoking a role, changing the
   * matrix, or deleting the account all take effect on the very next page load
   * no matter what the token says.
   */
  const [claimsRes, ctxRes] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.rpc("staff_context", { preview_role: requested }),
  ]);

  const claims = claimsRes.data?.claims;
  if (claimsRes.error || !claims?.sub) redirect("/login");
  const user = { userId: claims.sub as string, email: (claims.email as string) ?? null };
  const { data } = ctxRes;
  const ctx = (data ?? {}) as {
    is_staff?: boolean;
    real_role?: StaffRole;
    effective_role?: StaffRole;
    permissions?: Record<string, string>;
    orgs?: { id: string; name: string }[];
  };

  if (!ctx.is_staff || !ctx.real_role || !ctx.effective_role) redirect("/portal");

  const permissions = emptyPermissions();
  for (const [section, level] of Object.entries(ctx.permissions ?? {})) {
    if (section in permissions) permissions[section as SectionKey] = level as AccessLevel;
  }

  return {
    userId: user.userId,
    email: user.email,
    isStaff: true,
    staffRole: ctx.effective_role,
    realRole: ctx.real_role,
    viewingAsRole: ctx.effective_role !== ctx.real_role,
    orgs: ctx.orgs ?? [],
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
