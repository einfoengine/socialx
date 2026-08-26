import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@socialx/core/supabase/server";
import type { MemberRole, StaffRole } from "@socialx/core/types/db";

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
export type OrgSession = Session & {
  orgId: string;
  role: MemberRole;
  /* True when a staff member is looking at someone else's portal. Read only:
     every portal mutation refuses while this is set, because an approval is the
     contractual gate before anything publishes and it has to be the client's. */
  viewingAs: boolean;
};

/** Cookie naming the org a staff member is previewing. Set from /admin/clients. */
export const VIEW_AS_COOKIE = "sx-view-as";

/**
 * Verifies the session. Memoized per render pass with React `cache`, so calling it
 * in a layout and again in three components costs one round trip, not four.
 *
 * Returns null rather than redirecting, so callers can decide. Use `requireUser`
 * when a missing session should bounce to login.
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  /*
   * getClaims verifies the token's ES256 signature in process against the
   * project's published JWKS, and rejects it if expired. Not getSession, which
   * only reads the cookie and checks nothing, and no longer getUser, which asks
   * the Auth server and costs a round trip to another continent on every render.
   *
   * The trade is revocation latency, bounded by the one hour token lifetime, and
   * it is the same trade Postgres already makes: RLS verifies this JWT locally
   * too. Membership and staff status are still read live below, so a removed
   * user loses access on their next request regardless of their token.
   */
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (error || !claims?.sub) return null;
  const userId = claims.sub as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", userId)
    .single();

  return {
    userId,
    email: (claims.email as string) ?? null,
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

  /* Staff previewing a client. Checked before the membership lookup so it also
     works for staff who hold no membership at all, which is most of them. The
     cookie is only ever set by the admin action, which gates on the Clients
     permission; this re-checks isStaff so a stray cookie on a client session is
     inert. RLS still applies underneath: staff read every org, clients do not. */
  if (session.isStaff) {
    const jar = await cookies();
    const previewOrgId = jar.get(VIEW_AS_COOKIE)?.value;
    if (previewOrgId) {
      return { ...session, orgId: previewOrgId, role: "viewer", viewingAs: true };
    }
  }

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

  return { ...session, orgId: data.org_id, role: data.role as MemberRole, viewingAs: false };
});

/**
 * Refuses a write while a staff member is previewing a client portal.
 *
 * Called by every portal mutation. Without it, "view as" would let socialX
 * approve a batch on the client's behalf and the approval record would claim the
 * client did it, which is exactly the thing the review loop exists to prove.
 */
export function assertNotViewingAs(session: OrgSession): void {
  if (session.viewingAs) redirect("/portal?readonly=1");
}

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
