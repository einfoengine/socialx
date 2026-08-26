"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createAccount,
  setAccountPassword,
  MEMBER_ROLES,
  STAFF_ROLES,
  type AccountKind,
} from "@/lib/dal/accounts";
import type { MemberRole, StaffRole } from "@/lib/types/db";

/**
 * Manual account management.
 *
 * Every action here re-checks the People permission. A server action is a public
 * HTTP endpoint that never passes through proxy.ts, so the check on the page that
 * rendered the form proves nothing about who is calling this.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/*
 * These take (prevState, formData) because the form drives them through React's
 * useActionState, which is what lets the result render next to the form instead of
 * throwing to an error boundary. The previous state is unused: nothing here builds
 * on the last outcome.
 */

export async function createAccountAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("people", "full");

  const kind = String(formData.get("kind") ?? "") as AccountKind;
  if (kind !== "staff" && kind !== "client") {
    return { ok: false, error: "Pick whether this is a staff or a client account." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "").trim() || null;

  const staffRoleRaw = String(formData.get("staff_role") ?? "");
  const memberRoleRaw = String(formData.get("member_role") ?? "");
  const orgId = String(formData.get("org_id") ?? "").trim() || undefined;

  try {
    await createAccount({
      email,
      password,
      fullName,
      kind,
      staffRole: STAFF_ROLES.includes(staffRoleRaw as StaffRole)
        ? (staffRoleRaw as StaffRole)
        : undefined,
      orgId,
      memberRole: MEMBER_ROLES.includes(memberRoleRaw as MemberRole)
        ? (memberRoleRaw as MemberRole)
        : "owner",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create that account." };
  }

  revalidatePath("/admin/people");
  return {
    ok: true,
    message: password
      ? `${email} can sign in now with the password you set.`
      : `${email} was created. They sign in with a emailed link until a password is set.`,
  };
}

export async function setPasswordAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("people", "full");

  const userId = String(formData.get("user_id") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!userId) return { ok: false, error: "Missing the account." };

  try {
    await setAccountPassword(userId, password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not set that password." };
  }

  revalidatePath("/admin/people");
  return { ok: true, message: "Password updated." };
}

/**
 * Removes the auth user. profiles, staff_roles and memberships all cascade from
 * auth.users, so this is the whole deletion.
 */
export async function deleteAccountAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await requirePermission("people", "full");

  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) return { ok: false, error: "Missing the account." };

  // Deleting yourself would log you out mid-action and leave nobody sure what
  // happened. It is also the single most likely misclick on this screen.
  if (userId === session.userId) {
    return { ok: false, error: "You cannot delete the account you are signed in with." };
  }

  const db = createServiceClient();

  /* Refuse to remove the last owner. Without this the admin panel is one click
     away from having nobody who can reach it. */
  const { data: owners } = await db.from("staff_roles").select("user_id").eq("role", "owner");
  if (owners?.length === 1 && owners[0].user_id === userId) {
    return { ok: false, error: "That is the last staff owner. Grant someone else owner first." };
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/people");
  return { ok: true, message: "Account deleted." };
}
