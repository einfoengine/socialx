import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { Status } from "@/components/DataTable";
import { revisionLabel } from "@/lib/format";
import {
  addPostFromTemplate,
  addCustomPost,
  updatePost,
  deletePost,
  submitBatch,
} from "../actions";

export const metadata: Metadata = { title: "Batch builder | socialX Admin" };

const PLATFORMS = ["linkedin", "facebook", "instagram", "tiktok", "x", "hl_community", "youtube"];

export default async function BatchBuilder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pillar?: string }>;
}) {
  await requirePermission("batches");
  const { id } = await params;
  const { pillar } = await searchParams;
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select(
      "id, org_id, period_start, period_end, status, due_at, quota_posts, quota_motion, quota_platforms, revision_rounds_allowed, revision_rounds_used, organizations(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!batch) notFound();

  let libraryQuery = supabase
    .from("templates")
    .select("id, code, title, pillar_key, format, current_version_id")
    .eq("status", "published")
    .order("code");
  if (pillar) libraryQuery = libraryQuery.eq("pillar_key", pillar);

  const [{ data: posts }, { data: library }, { data: pillars }, { data: usedBefore }, { data: brand }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("id, title, format, pillar_key, copy, platforms, scheduled_for, status, is_custom, template_version_id")
        .eq("batch_id", id)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("position"),
      libraryQuery,
      supabase.from("pillars").select("key, name, default_mix_pct").order("sort"),
      // Templates this client has already received, so the same base post does not
      // land on one feed twice.
      supabase
        .from("posts")
        .select("template_version_id")
        .eq("org_id", batch.org_id)
        .not("template_version_id", "is", null),
      supabase.from("brand_profiles").select("brand_name, niches, banned_words").eq("org_id", batch.org_id).maybeSingle(),
    ]);

  const used = (posts ?? []).length;
  const motionUsed = (posts ?? []).filter((p) => p.format === "motion").length;
  const seenVersions = new Set((usedBefore ?? []).map((p) => p.template_version_id));
  const orgName = (batch.organizations as { name?: string } | null)?.name ?? "client";

  const mix = pillarMix(posts ?? []);
  const editable = ["draft", "in_production", "changes_requested"].includes(batch.status);

  return (
    <div>
      <Link
        href="/admin/batches"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 no-underline hover:text-[#2B50DC]"
      >
        back to batches
      </Link>

      {/* Header: quota is the first thing anyone needs to see. */}
      <div className="mt-3 mb-6 border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-grotesk text-xl font-semibold tracking-[-0.5px] text-gray-900 dark:text-white">
              {orgName}
            </h1>
            <p className="text-[13px] text-gray-500 mt-0.5">
              {new Date(batch.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              {batch.due_at &&
                `, due ${new Date(batch.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Status value={batch.status} />
            {editable && (
              <form action={submitBatch}>
                <input type="hidden" name="batch_id" value={batch.id} />
                <button className="btn gradient-bg text-white px-5 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0">
                  Submit for approval
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 mt-5">
          <Meter label="Posts" used={used} total={batch.quota_posts} />
          <Meter label="Motion" used={motionUsed} total={batch.quota_motion} />
          <Stat label="Platforms per post" value={String(batch.quota_platforms)} />
          <Stat label="Revisions" value={revisionLabel(batch.revision_rounds_allowed, batch.revision_rounds_used)} />
        </div>

        {(brand?.niches?.length || brand?.banned_words?.length) && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
            {brand?.niches?.length ? (
              <span className="text-gray-600 dark:text-gray-400">
                <B>niches</B> {brand.niches.join(", ")}
              </span>
            ) : null}
            {brand?.banned_words?.length ? (
              <span className="text-rose-600 dark:text-rose-400">
                <B>never use</B> {brand.banned_words.join(", ")}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Library picker */}
        <aside className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
          <div className="px-4 py-3 border-b border-black/10 dark:border-white/10">
            <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400">Library</div>
          </div>

          <div className="px-4 py-3 flex flex-wrap gap-1.5 border-b border-black/8 dark:border-white/8">
            <PillarChip href={`/admin/batches/${id}`} active={!pillar}>all</PillarChip>
            {(pillars ?? []).map((p) => (
              <PillarChip key={p.key} href={`/admin/batches/${id}?pillar=${p.key}`} active={pillar === p.key}>
                {p.name.split(" ")[0]} {mix[p.key] ?? 0}/{Math.round((p.default_mix_pct / 100) * batch.quota_posts)}
              </PillarChip>
            ))}
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {(library ?? []).length === 0 && (
              <p className="px-4 py-8 text-[13px] text-gray-500 text-center">
                No published templates yet. Drafts do not appear here.
              </p>
            )}
            {(library ?? []).map((t) => {
              const seen = seenVersions.has(t.current_version_id);
              return (
                <form
                  key={t.id}
                  action={addPostFromTemplate}
                  className="border-b border-black/6 dark:border-white/6 last:border-0"
                >
                  <input type="hidden" name="batch_id" value={batch.id} />
                  <input type="hidden" name="template_id" value={t.id} />
                  <button
                    type="submit"
                    disabled={!editable || used >= batch.quota_posts}
                    className="w-full text-left px-4 py-3 hover:bg-[#2B50DC]/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-transparent border-0 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-gray-400 pt-0.5 shrink-0">{t.code}</span>
                      <span className="flex-1">
                        <span className="block text-[13px] text-gray-900 dark:text-white leading-snug">
                          {t.title}
                        </span>
                        <span className="block font-mono text-[9.5px] uppercase tracking-[0.08em] text-gray-400 mt-1">
                          {t.format}
                          {seen && <span className="text-amber-600"> already used by this client</span>}
                        </span>
                      </span>
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        </aside>

        {/* The batch */}
        <section>
          {(posts ?? []).length === 0 ? (
            <div className="border border-dashed border-black/15 dark:border-white/15 p-10 text-center">
              <p className="text-sm text-gray-500 mb-1">Nothing in this batch yet.</p>
              <p className="text-[13px] text-gray-400">
                Pull from the library on the left, or write one from scratch below.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(posts ?? []).map((p) => (
                <form
                  key={p.id}
                  action={updatePost}
                  className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="batch_id" value={batch.id} />

                  <div className="flex items-start gap-3 mb-3">
                    <input
                      name="title"
                      defaultValue={p.title ?? ""}
                      disabled={!editable}
                      className="flex-1 bg-transparent border-0 border-b border-transparent hover:border-black/15 focus:border-[#2B50DC] font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white focus:outline-hidden px-0 py-1"
                    />
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] border border-black/12 dark:border-white/15 text-gray-500 px-1.5 py-0.5 shrink-0">
                      {p.is_custom ? "custom" : p.format}
                    </span>
                    <Status value={p.status} />
                  </div>

                  <textarea
                    name="copy"
                    defaultValue={p.copy ?? ""}
                    rows={4}
                    disabled={!editable}
                    className="w-full bg-transparent border border-black/12 dark:border-white/12 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed focus:outline-hidden focus:border-[#2B50DC] mb-3"
                  />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORMS.map((plat) => (
                        <label
                          key={plat}
                          className="flex items-center gap-1.5 border border-black/12 dark:border-white/12 px-2 py-1 cursor-pointer text-[11.5px] text-gray-600 dark:text-gray-400"
                        >
                          <input
                            type="checkbox"
                            name="platforms"
                            value={plat}
                            defaultChecked={(p.platforms ?? []).includes(plat)}
                            disabled={!editable}
                            className="accent-[#2B50DC]"
                          />
                          {plat.replace("hl_", "HL ")}
                        </label>
                      ))}
                    </div>

                    <input
                      type="datetime-local"
                      name="scheduled_for"
                      defaultValue={p.scheduled_for ? new Date(p.scheduled_for).toISOString().slice(0, 16) : ""}
                      disabled={!editable}
                      className="bg-transparent border border-black/12 dark:border-white/12 px-2 py-1.5 text-[12px] text-gray-700 dark:text-gray-300 focus:outline-hidden focus:border-[#2B50DC]"
                    />

                    {editable && (
                      <>
                        <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#2B50DC] dark:text-[#5B8DEF] cursor-pointer bg-transparent border-0">
                          Save
                        </button>
                        <span className="ml-auto">
                          <SubmitDelete postId={p.id} batchId={batch.id} />
                        </span>
                      </>
                    )}
                  </div>
                </form>
              ))}
            </div>
          )}

          {editable && used < batch.quota_posts && (
            <details className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] mt-3">
              <summary className="px-4 py-3 cursor-pointer font-grotesk text-[13px] font-semibold text-gray-900 dark:text-white select-none">
                Write one from scratch
              </summary>
              <form action={addCustomPost} className="px-4 pb-4 flex flex-col gap-3">
                <input type="hidden" name="batch_id" value={batch.id} />
                <input name="title" placeholder="Title" required className={INPUT} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <select name="pillar_key" defaultValue="" className={INPUT}>
                    <option value="">No pillar</option>
                    {(pillars ?? []).map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </select>
                  <select name="format" defaultValue="static" className={INPUT}>
                    <option value="static">Static</option>
                    <option value="motion">Motion</option>
                  </select>
                </div>
                <textarea name="copy" rows={4} placeholder="Copy" className={INPUT} />
                <button className="btn gradient-bg text-white px-5 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0 self-start">
                  Add post
                </button>
              </form>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

function SubmitDelete({ postId, batchId }: { postId: string; batchId: string }) {
  return (
    <span className="inline-block">
      <button
        formAction={deletePost}
        name="id"
        value={postId}
        formNoValidate
        className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-rose-500 cursor-pointer bg-transparent border-0"
      >
        Remove
      </button>
      <input type="hidden" name="batch_id" value={batchId} />
    </span>
  );
}

function pillarMix(posts: { pillar_key: string | null }[]) {
  const out: Record<string, number> = {};
  for (const p of posts) if (p.pillar_key) out[p.pillar_key] = (out[p.pillar_key] ?? 0) + 1;
  return out;
}

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const full = used >= total;
  return (
    <div className="bg-white dark:bg-[#111118] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 mb-2">{label}</div>
      <div className={`font-grotesk text-lg font-semibold ${full ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-white"}`}>
        {used} <span className="text-gray-400 font-normal">of {total}</span>
      </div>
      <div className="h-1 bg-black/8 dark:bg-white/10 mt-2">
        <div
          className={full ? "h-full bg-emerald-600" : "h-full gradient-bg"}
          style={{ width: `${total ? Math.min(100, (used / total) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-[#111118] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 mb-2">{label}</div>
      <div className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function PillarChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`font-mono text-[9.5px] uppercase tracking-[0.08em] border px-1.5 py-1 no-underline ${
        active
          ? "border-[#2B50DC] text-[#2B50DC] dark:text-[#5B8DEF]"
          : "border-black/12 dark:border-white/15 text-gray-500"
      }`}
    >
      {children}
    </Link>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400 mr-1">{children}</span>;
}

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:border-[#2B50DC] w-full";
