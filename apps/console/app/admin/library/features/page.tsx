import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead } from "@/components/DataTable";
import { setFeatureStatus, addFeature } from "../actions";

export const metadata: Metadata = { title: "HighLevel features | socialX Admin" };

/**
 * The feature axis.
 *
 * Marking a feature "changed" is the trigger for the mass update workflow: every
 * template tagged with it needs a copy review, and so does every live client post
 * built from those versions.
 */
export default async function FeaturesPage() {
  await requirePermission("library");
  const supabase = await createClient();

  const [{ data: features }, { data: links }] = await Promise.all([
    supabase.from("hl_features").select("id, name, slug, status, last_shipped_at").order("name"),
    supabase.from("template_features").select("feature_id"),
  ]);

  const usage: Record<string, number> = {};
  for (const l of links ?? []) usage[l.feature_id] = (usage[l.feature_id] ?? 0) + 1;

  return (
    <div>
      <Link
        href="/admin/library"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 no-underline hover:text-[#2B50DC]"
      >
        back to library
      </Link>
      <div className="mt-3">
        <PageHead {...pageMeta("/admin/library/features")} />
      </div>

      <details className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] mb-6">
        <summary className="px-5 py-3.5 cursor-pointer font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white select-none">
          Add a feature
        </summary>
        <form action={addFeature} className="px-5 pb-5 flex gap-3 items-end">
          <label className="flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500 mb-1.5">
              Name
            </span>
            <input
              name="name"
              required
              className="bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm w-full text-gray-900 dark:text-white focus:outline-hidden focus:border-[#2B50DC]"
            />
          </label>
          <button className="btn gradient-bg text-white px-5 py-2 font-grotesk font-semibold text-[13px] cursor-pointer border-0">
            Add
          </button>
        </form>
      </details>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(features ?? []).map((f) => (
          <div
            key={f.id}
            className={`border p-4 bg-white dark:bg-[#111118] ${
              f.status === "changed"
                ? "border-amber-500/50"
                : f.status === "deprecated"
                ? "border-black/8 dark:border-white/8 opacity-60"
                : "border-black/10 dark:border-white/10"
            }`}
          >
            <div className="font-grotesk text-[14.5px] font-semibold text-gray-900 dark:text-white mb-1">
              {f.name}
            </div>
            <div className="font-mono text-[10px] text-gray-400 mb-3">
              {usage[f.id] ?? 0} template{(usage[f.id] ?? 0) === 1 ? "" : "s"}
              {f.last_shipped_at && `, changed ${f.last_shipped_at}`}
            </div>
            <form action={setFeatureStatus} className="flex gap-2">
              <input type="hidden" name="id" value={f.id} />
              <select
                name="status"
                defaultValue={f.status}
                className="bg-transparent border border-black/15 dark:border-white/15 px-2 py-1 text-[12px] text-gray-700 dark:text-gray-300 focus:outline-hidden flex-1"
              >
                <option value="active">active</option>
                <option value="changed">changed</option>
                <option value="deprecated">deprecated</option>
              </select>
              <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-[#2B50DC] cursor-pointer bg-transparent border-0">
                Set
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
