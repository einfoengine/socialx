import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, StaffRole } from "@/lib/types/db";

/**
 * Account creation, in one place.
 *
 * Two things make accounts today: a Stripe purchase, through
 * lib/billing/provision.ts, and an admin doing it by hand. Provisioning stays
 * where it is because it has a subscription and an organization to build around,
 * but the identity half of the job is the same both times and lives here.
 *
 * Everything in this file needs the service role, because creating an auth user
 * and granting a staff role are both things no signed-in user may do to
 * themselves. Callers are responsible for proving the caller is staff first.
 *
 * profiles.is_staff is NOT set here. It is a cached read of staff_roles kept in
 * step by the staff_roles_sync trigger, so writing it by hand would only create a
 * second source of truth that can drift.
 */

export const STAFF_ROLES: StaffRole[] = ["owner", "ops", "content", "finance"];
export const MEMBER_ROLES: MemberRole[] = ["owner", "manager", "viewer"];

export type AccountKind = "staff" | "client";

export type CreateAccountInput = {
  email: string;
  /** Optional. With no password the account can only sign in by magic link. */
  password?: string | null;
  fullName?: string | null;
  kind: AccountKind;
  /** Required when kind is "staff". */
  staffRole?: StaffRole;
  /** Required when kind is "client": which organization they join. */
  orgId?: string;
  memberRole?: MemberRole;
};

export type AccountRow = {
  userId: string;
  email: string;
  fullName: string | null;
  isStaff: boolean;
  staffRole: StaffRole | null;
  orgs: { id: string; name: string; role: MemberRole }[];
  /** null when the answer is not available yet: see listAccounts. */
  hasPassword: boolean | null;
  lastSignInAt: string | null;
  createdAt: string;
};

/** Supabase's own floor is 6. Ours is higher because these are business accounts. */
export const MIN_PASSWORD_LENGTH = 10;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/**
 * Creates the auth user and grants it either a staff role or an org membership.
 *
 * Returns the new user id. Throws with a readable message on anything a person
 * could reasonably have got wrong, because these strings surface in the admin form.
 */
export async function createAccount(input: CreateAccountInput): Promise<string> {
  const db = createServiceClient();

  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("That does not look like an email address.");
  }

  if (input.password) {
    const problem = validatePassword(input.password);
    if (problem) throw new Error(problem);
  }

  if (input.kind === "staff") {
    if (!input.staffRole || !STAFF_ROLES.includes(input.staffRole)) {
      throw new Error("Pick a staff role.");
    }
  } else if (!input.orgId) {
    throw new Error("A client account needs an organization to belong to.");
  }

  /*
   * email_confirm skips the confirmation round trip. That is right here and not a
   * shortcut: an admin typing an address, or a buyer who just paid, has already
   * been established by some means other than clicking a link in an inbox.
   */
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(input.password ? { password: input.password } : {}),
    ...(input.fullName ? { user_metadata: { full_name: input.fullName } } : {}),
  });

  const userId = created?.user?.id ?? null;

  // Already there. Say so plainly rather than half-updating an existing person.
  if (!userId) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      throw new Error(
        `${email} already has an account. Change its password or role from the list instead.`
      );
    }
    throw new Error(error?.message ?? "Could not create that account.");
  }

  /*
   * handle_new_user already inserted the profile row from the auth record. This
   * fills in what that trigger cannot see, and is a no-op when there is nothing
   * to add.
   */
  if (input.fullName) {
    await db.from("profiles").update({ full_name: input.fullName }).eq("id", userId);
  }

  if (input.kind === "staff") {
    const { error: roleError } = await db
      .from("staff_roles")
      .insert({ user_id: userId, role: input.staffRole });
    if (roleError) {
      // Leaving an auth user with no role would be an account that can sign in
      // and reach nothing, which is harder to spot than a failed create.
      await db.auth.admin.deleteUser(userId);
      throw new Error(`Created the user but could not grant the role: ${roleError.message}`);
    }
  } else {
    const { error: memberError } = await db
      .from("memberships")
      .insert({ org_id: input.orgId, user_id: userId, role: input.memberRole ?? "owner" });
    if (memberError) {
      await db.auth.admin.deleteUser(userId);
      throw new Error(`Created the user but could not add them to the org: ${memberError.message}`);
    }
  }

  return userId;
}

/** Sets or replaces a password. Passing null leaves the account link-only. */
export async function setAccountPassword(userId: string, password: string): Promise<void> {
  const problem = validatePassword(password);
  if (problem) throw new Error(problem);

  const db = createServiceClient();
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
}

/**
 * Everyone who can sign in, with what they can reach.
 *
 * auth.users is not in the public schema and PostgREST cannot read it, so the
 * roster comes from the admin API and the rest is joined on in memory. Fine at
 * this size; it needs paging long before it needs a view.
 */
export async function listAccounts(): Promise<AccountRow[]> {
  const db = createServiceClient();

  const [{ data: users }, { data: profiles }, { data: roles }, { data: memberships }] =
    await Promise.all([
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      db.from("profiles").select("id, email, full_name, is_staff"),
      db.from("staff_roles").select("user_id, role"),
      db.from("memberships").select("user_id, org_id, role, organizations(name)"),
    ]);

  /*
   * Whether an account has a password is not knowable from here on its own. It
   * lives in auth.users.encrypted_password, which PostgREST cannot select, and
   * listUsers returns identities as null, so there is no client-side signal to
   * infer it from. Migration 0017 adds a security definer function that answers it
   * without exposing the hash.
   *
   * Called with the request's own client, not the service client: the function
   * gates on is_staff(auth.uid()), and the service role has no auth.uid() to
   * check, so it would read back nothing.
   *
   * Until that migration is applied the map stays empty and every row reports
   * null, which the UI renders as "not known" rather than guessing "no".
   */
  const passwordState = new Map<string, boolean>();
  try {
    const scoped = await createClient();
    const { data: states } = await scoped.rpc("staff_account_password_state");
    for (const row of (states ?? []) as { user_id: string; has_password: boolean }[]) {
      passwordState.set(row.user_id, row.has_password);
    }
  } catch {
    // Function not deployed yet. Reporting null is correct; failing is not.
  }

  return (users?.users ?? [])
    .map((u) => {
      const profile = profiles?.find((p) => p.id === u.id);
      const role = roles?.find((r) => r.user_id === u.id);
      const mine = (memberships ?? []).filter((m) => m.user_id === u.id);

      return {
        userId: u.id,
        email: u.email ?? "",
        fullName: profile?.full_name ?? null,
        isStaff: profile?.is_staff ?? false,
        staffRole: (role?.role as StaffRole) ?? null,
        orgs: mine.map((m) => ({
          id: m.org_id as string,
          name:
            (m.organizations as unknown as { name?: string } | null)?.name ?? "Unknown org",
          role: m.role as MemberRole,
        })),
        hasPassword: passwordState.has(u.id) ? passwordState.get(u.id)! : null,
        lastSignInAt: u.last_sign_in_at ?? null,
        createdAt: u.created_at,
      };
    })
    .sort((a, b) => {
      if (a.isStaff !== b.isStaff) return a.isStaff ? -1 : 1;
      return a.email.localeCompare(b.email);
    });
}
