import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";
import { SkeletonRows } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Team | socialX" };

/* Heading and the closing note are static, so they are on screen while the
   member list is still in flight. Only the list waits. */
export default function TeamPage() {
  return (
    <div className="max-w-[640px]">
      <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
        Team
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8">
        Who can see and approve content on this workspace.
      </p>

      <Suspense fallback={<SkeletonRows n={3} />}>
        <Members />
      </Suspense>

      <div className="border border-dashed border-black/15 dark:border-white/15 p-5 mt-4 text-[13px] text-gray-500 leading-relaxed">
        Need someone else added? Email{" "}
        <a href="mailto:hi@socialx.studio" className="text-[#3D4AFF] dark:text-[#00A3FF]">
          hi@socialx.studio
        </a>{" "}
        and we will send them an invite. Self serve invites are coming.
      </div>
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
