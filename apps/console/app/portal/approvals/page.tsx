import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";
import { Status } from "@/components/DataTable";
import { revisionLabel } from "@/lib/format";
import { SkeletonRows } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Approvals | socialX" };

/* The promise at the top of this page is the reason a client opens it, so it is
   static and lands immediately. The batch list streams in behind it. */
export default function ApprovalsPage() {
  return (
    <div>
      <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
        Approvals
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8 max-w-[64ch]">
        Nothing publishes until you approve it. Review a month, approve the whole batch,
        or send back the pieces you want changed.
      </p>

      <Suspense fallback={<SkeletonRows n={3} />}>
        <Batches />
      </Suspense>
    </div>
  );
}

async function Batches() {
  const session = await requireOrg();
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("batches")
    .select("id, period_start, status, submitted_at, approved_at, quota_posts, revision_rounds_allowed, revision_rounds_used, posts(id)")
    .eq("org_id", session.orgId)
    .order("period_start", { ascending: false });

  const waiting = (batches ?? []).filter((b) => b.status === "in_review");
  const rest = (batches ?? []).filter((b) => b.status !== "in_review");

  return (
    <>

      {waiting.length > 0 && (
        <section className="mb-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#2B50DC] dark:text-[#5B8DEF] mb-3">
            Waiting on you
          </h2>
          <div className="flex flex-col gap-3">
            {waiting.map((b) => (
              <Link
                key={b.id}
                href={`/portal/approvals/${b.id}`}
                className="border border-[#2B50DC]/40 bg-[#2B50DC]/5 p-5 no-underline block hover:bg-[#2B50DC]/8 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-grotesk text-lg font-semibold text-gray-900 dark:text-white">
                    {monthOf(b.period_start)}
                  </span>
                  <span className="text-[13px] text-gray-600 dark:text-gray-400">
                    {((b.posts as { id: string }[] | null) ?? []).length} posts
                  </span>
                  <span className="text-[13px] text-gray-600 dark:text-gray-400">
                    {revisionLabel(b.revision_rounds_allowed, b.revision_rounds_used)}
                  </span>
                  <span className="ml-auto font-grotesk text-[13px] font-semibold text-[#2B50DC] dark:text-[#5B8DEF]">
                    Review
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
        {waiting.length > 0 ? "Everything else" : "Your batches"}
      </h2>
      {rest.length === 0 && waiting.length === 0 ? (
        <div className="border border-dashed border-black/15 dark:border-white/15 p-8 text-sm text-gray-500">
          No batches yet. Your first one arrives once onboarding is complete.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rest.map((b) => (
            <Link
              key={b.id}
              href={`/portal/approvals/${b.id}`}
              className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4 no-underline flex flex-wrap items-center gap-3 hover:border-[#2B50DC]/30 transition-colors"
            >
              <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                {monthOf(b.period_start)}
              </span>
              <Status value={b.status} />
              <span className="text-[13px] text-gray-500 ml-auto">
                {((b.posts as { id: string }[] | null) ?? []).length} posts
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function monthOf(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
