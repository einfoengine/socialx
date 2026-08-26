"use client";

import { useState } from "react";

type Post = {
  id: string;
  title: string;
  format: string;
  copy: string;
  platforms: string[];
  scheduledFor: string | null;
  status: string;
  image: string | null;
  imageAlt: string | null;
  comments: { id: string; body: string; createdAt: string; mine: boolean }[];
};

/**
 * Batch review.
 *
 * Two paths on purpose. Most clients approve everything, so that is one button. The
 * per-post path exists so one weak piece does not hold up fifteen good ones, and so
 * flagging several posts still costs a single revision round.
 */
export default function ReviewForm({
  batchId,
  reviewable,
  roundsExhausted,
  posts,
  approveBatchAction,
  approvePostAction,
  requestChangesAction,
  addCommentAction,
}: {
  batchId: string;
  reviewable: boolean;
  roundsExhausted: boolean;
  posts: Post[];
  approveBatchAction: (fd: FormData) => void;
  approvePostAction: (fd: FormData) => void;
  requestChangesAction: (fd: FormData) => void;
  addCommentAction: (fd: FormData) => void;
}) {
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  return (
    <div>
      <form action={requestChangesAction} id="review">
        <input type="hidden" name="batch_id" value={batchId} />

        <div className="flex flex-col gap-3">
          {posts.map((p, i) => (
            <article
              key={p.id}
              className={`border bg-white dark:bg-[#111118] transition-colors ${
                flagged[p.id]
                  ? "border-amber-500/60"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-black/8 dark:border-white/8">
                <span className="font-mono text-[10px] text-gray-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">
                  {p.title}
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] border border-black/12 dark:border-white/15 text-gray-500 px-1.5 py-0.5">
                  {p.format}
                </span>
                {p.scheduledFor && (
                  <span className="font-mono text-[10.5px] text-gray-500 ml-auto">
                    {new Date(p.scheduledFor).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                )}
              </header>

              <div className="px-5 py-4 flex gap-4">
                {p.image && (
                  /* eslint-disable-next-line @next/next/no-img-element --
                     creative is served from whichever host holds it, HighLevel today,
                     so the set of origins is not knowable at build time. */
                  <img
                    src={p.image}
                    alt={p.imageAlt ?? ""}
                    loading="lazy"
                    className="w-[104px] h-[104px] shrink-0 object-cover border border-black/10 dark:border-white/10 bg-black/3 dark:bg-white/5"
                  />
                )}
                <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {p.copy || "No copy yet."}
                </p>

                {p.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {p.platforms.map((pl) => (
                      <span
                        key={pl}
                        className="font-mono text-[9.5px] uppercase tracking-[0.08em] border border-black/12 dark:border-white/15 text-gray-500 px-1.5 py-0.5"
                      >
                        {pl.replace("hl_", "HL ")}
                      </span>
                    ))}
                  </div>
                )}

                {p.comments.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 border-l-2 border-black/10 dark:border-white/10 pl-3">
                    {p.comments.map((c) => (
                      <div key={c.id} className="text-[12.5px]">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400 mr-2">
                          {c.mine ? "you" : "socialX"}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{c.body}</span>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>

              {reviewable && (
                <footer className="px-5 py-3 border-t border-black/8 dark:border-white/8 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-[12.5px] text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(flagged[p.id])}
                      onChange={(e) => setFlagged({ ...flagged, [p.id]: e.target.checked })}
                      className="accent-amber-500"
                    />
                    Change this one
                  </label>

                  {!flagged[p.id] && p.status !== "approved" && (
                    <button
                      type="submit"
                      formAction={approvePostAction}
                      name="post_id"
                      value={p.id}
                      formNoValidate
                      className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-emerald-600 cursor-pointer bg-transparent border-0"
                    >
                      Approve just this
                    </button>
                  )}
                  {p.status === "approved" && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-600">
                      approved
                    </span>
                  )}

                  {flagged[p.id] && (
                    <input
                      name={`note_${p.id}`}
                      required
                      placeholder="What should change?"
                      className="flex-1 min-w-[220px] bg-transparent border border-amber-500/40 px-3 py-1.5 text-[13px] text-gray-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                    />
                  )}
                </footer>
              )}
            </article>
          ))}
        </div>

        {reviewable && (
          <div className="sticky bottom-0 mt-6 border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
            {flaggedCount > 0 ? (
              <>
                <label className="block mb-3">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500 mb-1.5">
                    Anything else, overall
                  </span>
                  <textarea
                    name="general_note"
                    rows={2}
                    className="w-full bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-[13px] text-gray-900 dark:text-white focus:outline-hidden focus:border-[#2B50DC]"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={roundsExhausted}
                    className="btn bg-amber-500 text-white px-6 py-3 font-grotesk font-semibold text-sm cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send {flaggedCount} change{flaggedCount === 1 ? "" : "s"}
                  </button>
                  <span className="text-[12.5px] text-gray-500">
                    {roundsExhausted
                      ? "No revision rounds left on this batch."
                      : "This uses one revision round, whatever the count."}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  formAction={approveBatchAction}
                  formNoValidate
                  className="btn gradient-bg text-white px-7 py-3 font-grotesk font-semibold text-sm cursor-pointer border-0"
                >
                  Approve all {posts.length} posts
                </button>
                <span className="text-[12.5px] text-gray-500">
                  Or tick anything you want changed first.
                </span>
              </div>
            )}
          </div>
        )}
      </form>

      {!reviewable && posts.length > 0 && (
        <div className="mt-6 border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 mb-3">
            Leave a note
          </h3>
          <form action={addCommentAction} className="flex gap-2">
            <input type="hidden" name="batch_id" value={batchId} />
            <select
              name="post_id"
              className="bg-transparent border border-black/15 dark:border-white/15 px-2 py-2 text-[12.5px] text-gray-700 dark:text-gray-300 focus:outline-hidden"
            >
              {posts.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <input
              name="body"
              required
              placeholder="Anything we should know"
              className="flex-1 bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-[13px] text-gray-900 dark:text-white focus:outline-hidden focus:border-[#2B50DC]"
            />
            <button className="btn btn-ink bg-[#111118] dark:bg-white text-white dark:text-[#111118] px-4 py-2 font-grotesk font-semibold text-[12.5px] cursor-pointer border-0">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
