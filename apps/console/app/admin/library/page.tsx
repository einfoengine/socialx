import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { resolveAssetUrls } from "@/lib/dal/media";
import type { Asset } from "@socialx/core/types/db";
import { PageHead } from "@/components/DataTable";
import { rel } from "@/lib/rel";
import TemplateList, { type TemplateItem } from "./TemplateList";

export const metadata: Metadata = { title: "Library | socialX Admin" };

/**
 * The library, and the way into everything done to it.
 *
 * Create lives at /new, editing on each template's detail page; this list is
 * where both are reached, plus the one operation with no screen of its own:
 * delete, guarded by usage. Write affordances render only for full access, but
 * that is presentation. Every action re-checks for itself.
 */
export default async function LibraryPage() {
  const access = await requirePermission("library");
  const canWrite = access.permissions.library === "full";
  const supabase = await createClient();

  const [{ data: templates }, { data: pillars }] = await Promise.all([
    supabase
      .from("templates")
      .select(
        "id, code, title, pillar_key, format, status, master_concept, current_version_id, template_features(hl_features(name))"
      )
      .order("code"),
    supabase.from("pillars").select("key, name, default_mix_pct").order("sort"),
  ]);

  const rows = templates ?? [];

  /* How many client posts were built from each template, across every version,
     not just the current one. This is what decides delete versus retire. */
  const { data: allVersions } = await supabase
    .from("template_versions")
    .select("id, template_id");
  const { data: usedBy } = await supabase
    .from("posts")
    .select("template_version_id")
    .not("template_version_id", "is", null);
  const versionOwner = new Map((allVersions ?? []).map((v) => [v.id, v.template_id]));
  const inUse = new Map<string, number>();
  for (const post of usedBy ?? []) {
    const owner = versionOwner.get(post.template_version_id as string);
    if (owner) inUse.set(owner, (inUse.get(owner) ?? 0) + 1);
  }

  const versionIds = rows.map((t) => t.current_version_id).filter(Boolean) as string[];
  const { data: versions } = versionIds.length
    ? await supabase
        .from("template_versions")
        .select("id, template_id, hook, middle_beat, outcome, version")
        .in("id", versionIds)
    : { data: [] };

  const { data: variants } = versionIds.length
    ? await supabase
        .from("template_variants")
        .select("template_version_id, platform, asset_id")
        .in("template_version_id", versionIds)
    : { data: [] };

  const assetIds = [...new Set((variants ?? []).map((v) => v.asset_id).filter(Boolean))] as string[];
  const { data: assetRows } = assetIds.length
    ? await supabase.from("assets").select("*").in("id", assetIds)
    : { data: [] };
  const images = await resolveAssetUrls((assetRows ?? []) as Asset[]);

  /* Actual mix against the target. Drift here is the quality signal that shows up
     months later as a feed that only ever talks about features. */
  const counts = new Map<string, number>();
  for (const t of rows) counts.set(t.pillar_key, (counts.get(t.pillar_key) ?? 0) + 1);

  /* Everything a card shows, flattened to plain values: the list itself is a
     client component because bulk selection is shared state, and it should not
     have to know how assets resolve or how relations come back. */
  const items: TemplateItem[] = rows.map((t) => {
    const v = (versions ?? []).find((x) => x.id === t.current_version_id);
    const myVariants = (variants ?? []).filter((x) => x.template_version_id === t.current_version_id);
    const img = myVariants.map((x) => x.asset_id).find(Boolean);
    return {
      id: t.id,
      code: t.code,
      title: t.title,
      pillar: t.pillar_key,
      format: t.format,
      status: t.status,
      features: ((t.template_features ?? []) as { hl_features?: { name?: string } }[])
        .map((f) => rel<{ name?: string }>(f.hl_features)?.name)
        .filter((x): x is string => Boolean(x)),
      beats: { hook: v?.hook ?? null, middle: v?.middle_beat ?? null, outcome: v?.outcome ?? null },
      platforms: myVariants.map((x) => x.platform as string),
      version: v?.version ?? 1,
      imageUrl: img ? (images.get(img)?.url ?? null) : null,
      inUse: inUse.get(t.id) ?? 0,
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHead
          title="Library"
          sub={`${rows.length} template${rows.length === 1 ? "" : "s"}. Every one built around a real HighLevel feature, niche neutral until a batch customizes it.`}
        />
        {canWrite && (
          <Link
            href="/admin/library/new"
            className="btn btn-primary gradient-bg shrink-0 px-5 py-2.5 font-grotesk text-[13px] font-semibold text-white no-underline"
          >
            New template
          </Link>
        )}
      </div>

      <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
        Pillar mix against target
      </h2>
      <div className="grid sm:grid-cols-5 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 mb-8">
        {(pillars ?? []).map((p) => {
          const n = counts.get(p.key) ?? 0;
          const actual = rows.length ? Math.round((n / rows.length) * 100) : 0;
          const off = Math.abs(actual - p.default_mix_pct) > 12;
          return (
            <div key={p.key} className="bg-white dark:bg-[#111118] p-4">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-400 mb-1.5">
                {p.name}
              </div>
              <div className="font-grotesk text-[17px] font-semibold text-gray-900 dark:text-white">
                {actual}%
                <span className="text-[11px] font-normal text-gray-400 ml-1.5">
                  target {p.default_mix_pct}%
                </span>
              </div>
              <div className={`text-[11px] mt-0.5 ${off ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`}>
                {n} {n === 1 ? "post" : "posts"}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
        Templates
      </h2>
      {rows.length === 0 ? (
        <div className="border border-dashed border-black/15 dark:border-white/15 p-8 text-sm text-gray-500">
          No templates yet. Run <span className="font-mono">pnpm seed:demo</span> for a sample set.
        </div>
      ) : (
        <TemplateList items={items} canWrite={canWrite} />
      )}
    </div>
  );
}

