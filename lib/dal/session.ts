import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, StaffRole } from "@/lib/types/db";

/**
 * The Data Access Layer.
 *
 * Next 16's Proxy (what used to be middleware) runs on every route including
 * prefetches and must not touch the database, so it can only do an optimistic
 * cookie check. A server action invoked directly never passes through it at all.
 * That makes this file the real authorization boundary: every server component,
 * server action, and route handler calls one of these before touching data.
 *
 * Row level security in Postgres is the layer beneath this one, and it holds even
 * if something here is wrong.
 */

export type Session = {
  userId: string;
  email: string | null;
  isStaff: boolean;
};

export type StaffSession = Session & { staffRole: StaffRole };
export type OrgSession = Session & { orgId: string; role: MemberRole };

/**
 * Verifies the session. Memoized per render pass with React `cache`, so calling it
 * in a layout and again in three components costs one round trip, not four.
 *
 * Returns null rather than redirecting, so callers can decide. Use `requireUser`
 * when a missing session should bounce to login.
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  // getUser revalidates the token against Supabase. getSession only reads the
  // cookie, which is forgeable, so it is not safe for an authorization decision.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    isStaff: profile?.is_staff ?? false,
  };
});

export async function requireUser(): Promise<Session> {
  const session = await verifySession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Gate for /admin. Reads the specific staff role too, so callers can distinguish
 * ops from finance without a second query.
 */
export const requireStaff = cache(async (): Promise<StaffSession> => {
  const session = await requireUser();
  if (!session.isStaff) redirect("/portal");

  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", session.userId)
    .single();

  if (!data) redirect("/portal");
  return { ...session, staffRole: data.role as StaffRole };
});

/**
 * Gate for /portal. Resolves which organization the signed-in user belongs to.
 *
 * Today a user belongs to exactly one org, so this returns the first membership.
 * When the white label tier arrives and a user can hold several, this becomes an
 * explicit org switcher and every caller already takes the org id from here.
 */
export const requireOrg = cache(async (): Promise<OrgSession> => {
  const session = await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // A staff member with no client membership belongs in the admin portal.
  if (!data) {
    if (session.isStaff) redirect("/admin");
    redirect("/no-access");
  }

  return { ...session, orgId: data.org_id, role: data.role as MemberRole };
});

/**
 * Asserts the signed-in user may act on a given org. RLS already scopes reads, but
 * server actions that take an orgId from a form need an explicit check before they
 * write, otherwise the parameter is trusted input.
 */
export async function assertOrgAccess(orgId: string): Promise<Session> {
  const session = await requireUser();
  if (session.isStaff) return session;

  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", session.userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!data) redirect("/no-access");
  return session;
}
