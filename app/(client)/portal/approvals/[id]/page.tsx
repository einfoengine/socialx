import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";
import { Status } from "@/components/portal/DataTable";
import { approveBatch, approvePost, requestChanges, addComment } from "../../actions";
import { resolveAssetUrls } from "@/lib/dal/media";
import type { Asset } from "@/lib/types/db";
import ReviewForm from "./ReviewForm";

export const metadata: Metadata = { title: "Review batch | socialX" };

export default async function BatchReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ approved?: string }>;
}) {
  const session = await requireOrg();
  const { id } = await params;
  const { approved } = await searchParams;
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, org_id, period_start, status, submitted_at, approved_at, revision_rounds_allowed, revision_rounds_used")
    .eq("id", id)
    .maybeSingle();

  if (!batch) notFound();

  const [{ data: posts }, { data: revisions }, { data: comments }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, format, pillar_key, copy, platforms, scheduled_for, status, design_asset_id")
      .eq("batch_id", id)
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("position"),
    supabase
      .from("revisions")
      .select("id, post_id, round, note, status, created_at")
      .eq("batch_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("comments")
      .select("id, post_id, body, created_at, author_id")
      .order("created_at", { ascending: true }),
  ]);

  /* The creative, resolved through the media layer so the hybrid provider split
     never reaches a component. A client reviewing a batch needs to see the post,
     not just read it. */
  const assetIds = [...new Set((posts ?? []).map((p) => p.design_asset_id).filter(Boolean))] as string[];
  const { data: assetRows } = assetIds.length
    ? await supabase.from("assets").select("*").in("id", assetIds)
    : { data: [] };
  const resolved = await resolveAssetUrls((assetRows ?? []) as Asset[]);

  const reviewable = batch.status === "in_review";
  const allowed = batch.revision_rounds_allowed;
  const used = batch.revision_rounds_used;
  const roundsLeft = allowed === null ? Infinity : Math.max(0, allowed - used);

  return (
    <div className="max-w-[860px]">
      <Link
        href="/portal/approvals"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 no-underline hover:text-[#2B50DC]"
      >
        back to approvals
      </Link>

      <div className="mt-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
            {new Date(batch.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h1>
          <Status value={batch.status} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {(posts ?? []).length} posts. Nothing publishes until you approve.
        </p>
      </div>

      {approved === "1" && (
        <div className="border border-emerald-600/40 bg-emerald-600/6 p-4 mb-6 text-[13.5px] text-emerald-800 dark:text-emerald-300">
          <strong>Approved.</strong> We are loading these into your HL Social Planner now.
        </div>
      )}

      {/*
        The round counter, shown before it is spent rather than after.
        The Company Profile is explicit that Starter must never be oversold as
        bespoke, and this line is where that either stays honest or quietly stops
        being true.
      */}
      {reviewable && (
        <div
          className={`border p-4 mb-6 text-[13.5px] ${
            roundsLeft === 0
              ? "border-amber-500/50 bg-amber-500/6 text-amber-800 dark:text-amber-300"
              : "border-[#2B50DC]/30 bg-[#2B50DC]/5 text-gray-700 dark:text-gray-300"
          }`}
        >
          {allowed === null ? (
            <>
              <strong className="text-gray-900 dark:text-white">Unlimited revisions</strong> on your
              plan. Send this back as many times as it takes.
            </>
          ) : roundsLeft === 0 ? (
            <>
              <strong>You have used both revision rounds on this batch.</strong> We will still
              fix anything factually wrong. For deeper changes, talk to us about the next tier
              up rather than paying for a one off.
            </>
          ) : (
            <>
              <strong className="text-gray-900 dark:text-white">
                Revision round {used + 1} of {allowed}.
              </strong>{" "}
              Sending changes uses one round, however many posts you flag, so mark everything
              you want changed before you send.
            </>
          )}
        </div>
      )}

      {(revisions ?? []).length > 0 && (
        <section className="mb-8">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
            Your feedback so far
          </h2>
          <div className="flex flex-col gap-2">
            {(revisions ?? []).map((r) => (
              <div key={r.id} className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#2B50DC] dark:text-[#5B8DEF] border border-[#2B50DC]/30 px-1.5 py-0.5">
                    round {r.round}
                  </span>
                  {r.post_id && (
                    <span className="font-mono text-[10px] text-gray-400">
                      {(posts ?? []).find((p) => p.id === r.post_id)?.title ?? "a post"}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-gray-400 ml-auto">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">{r.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <ReviewForm
        batchId={batch.id}
        reviewable={reviewable}
        roundsExhausted={roundsLeft === 0}
        posts={(posts ?? []).map((p) => ({
          id: p.id,
          title: p.title ?? "Untitled",
          format: p.format,
          copy: p.copy ?? "",
          platforms: p.platforms ?? [],
          scheduledFor: p.scheduled_for,
          status: p.status,
          image: p.design_asset_id ? resolved.get(p.design_asset_id)?.url ?? null : null,
          imageAlt: p.design_asset_id ? resolved.get(p.design_asset_id)?.alt ?? null : null,
          comments: (comments ?? [])
            .filter((c) => c.post_id === p.id)
            .map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.created_at,
              mine: c.author_id === session.userId,
            })),
        }))}
        approveBatchAction={approveBatch}
        approvePostAction={approvePost}
        requestChangesAction={requestChanges}
        addCommentAction={addComment}
      />
    </div>
  );
}
