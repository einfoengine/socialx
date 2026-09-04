import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import { Suspense } from "react";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@/lib/core/supabase/server";
import { SkeletonRows } from "@/components/Skeleton";
import { portalSite } from "@/lib/sites/resolve";

export const metadata: Metadata = { title: "Team | Portal" };

/* Heading is static, so it is on screen while the member list is still in
   flight. The list and the closing note both wait, the note because the address
   to write to belongs to the site that sold this client rather than to this
   platform, and finding out which site that is takes a query. */
export default function TeamPage() {
  return (
    <div className="max-w-[640px]">
      <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">{pageMeta("/portal/team").title}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8">{pageMeta("/portal/team").sub}</p>

      <Suspense fallback={<SkeletonRows n={3} />}>
        <Members />
      </Suspense>

      <Suspense fallback={null}>
        <SupportNote />
      </Suspense>
    </div>
  );
}

/**
 * Where to write to be added.
 *
 * The address is the selling site's, never the platform's. A client writing to
 * their supplier's supplier reaches somebody who cannot help them and who should
 * not have been named on their screen in the first place. A site with no support
 * address set gets the sentence without a link rather than a broken mailto.
 */
async function SupportNote() {
  const session = await requireOrg();
  const site = await portalSite(session.orgId);
  const email = site?.supportEmail ?? null;

  return (
    <div className="border border-dashed border-black/15 dark:border-white/15 p-5 mt-4 text-[13px] text-gray-500 leading-relaxed">
      {email ? (
        <>
          Need someone else added? Email{" "}
          <a href={`mailto:${email}`} className="text-[#3D4AFF] dark:text-[#00A3FF]">
            {email}
          </a>{" "}
          and we will send them an invite. Self serve invites are coming.
        </>
      ) : (
        <>Need someone else added? Ask your account manager and we will send them an invite. Self serve invites are coming.</>
      )}
    </div>
  );
}

async function Members() {
  const session = await requireOrg();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("memberships")
    .select("id, role, user_id, created_at, profiles(email, full_name)")
    .eq("org_id", session.orgId);

  return (
    <div className="flex flex-col gap-2">
      {(members ?? []).map((m) => {
        const p = m.profiles as { email?: string; full_name?: string } | null;
        return (
          <div
            key={m.id}
            className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4 flex items-center gap-4"
          >
            <div className="flex-1">
              <div className="font-grotesk text-[14.5px] font-semibold text-gray-900 dark:text-white">
                {p?.full_name || p?.email || "Unknown"}
                {m.user_id === session.userId && (
                  <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400">
                    you
                  </span>
                )}
              </div>
              {p?.full_name && p?.email && (
                <div className="text-[12.5px] text-gray-500">{p.email}</div>
              )}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] border border-black/12 dark:border-white/15 text-gray-500 px-2 py-0.5">
              {m.role}
            </span>
          </div>
        );
      })}
    </div>
  );
}
