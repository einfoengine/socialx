import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { can, withPermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { resolveAssetUrls } from "@/lib/dal/media";
import type { Asset } from "@/lib/core/types/db";
import { rel } from "@/lib/rel";
import TemplateList, { type TemplateItem } from "./TemplateList";
import {
  ActionPlaceholder,
  LibraryHeader,
  PillarMixSkeleton,
  SectionLabel,
  TemplateCardsSkeleton,
} from "./LibraryShell";

export const metadata: Metadata = { title: "Library | Admin" };

/**
 * The library, and the way into everything done to it.
 *
 * Create lives at /new, editing on each template's detail page; this list is
 * where both are reached, plus the one operation with no screen of its own:
 * delete, guarded by usage. Write affordances render only for full access, but
 * that is presentation. Every action re-checks for itself.
 *
 * ---
 *
 * This component is deliberately NOT async, and that is the whole shape of the
 * screen.
 *
 * A server component that awaits before returning holds its entire output back
 * until the await settles, so a title that depends on nothing still waits on a
 * database 260ms away. Returning the shell synchronously flushes the heading,
 * the subtitle and both section labels immediately, and only the two regions
 * that genuinely need rows sit inside Suspense.
 *
 * The query is started here and handed down as a promise rather than awaited.
 * Two boundaries share one fetch: kicking it off in each child would be two
 * round trips for the same rows, and awaiting it here would defeat the point of
 * having boundaries at all.
 */
export default function LibraryPage() {
  const data = loadLibrary();
  /* Orphan guard. Nothing awaits this until the children render, and an
     unhandled rejection in that window would take the process down. Attaching a
     handler does not replace the promise, so the children still see any error. */
  data.catch(() => {});

  return (
    <div>
      <LibraryHeader
        action={
          <Suspense fallback={<ActionPlaceholder />}>
            <NewTemplateButton />
          </Suspense>
        }
      />

      <SectionLabel>Pillar mix against target</SectionLabel>
      <Suspense fallback={<PillarMixSkeleton />}>
        <PillarMix data={data} />
      </Suspense>

      <SectionLabel>Templates</SectionLabel>
      <Suspense fallback={<TemplateCardsSkeleton />}>
        <TemplateCards data={data} />
      </Suspense>
    </div>
  );
}

/* ---------------- the regions that wait ---------------- */

/**
 * The button needs to know whether this role may write, which is the permission
 * check and nothing else. It gets its own boundary so a write affordance never
 * holds up the list, and it costs no extra round trip: the admin layout has
 * already resolved the same call, and getStaffAccess is memoized per render.
 */
async function NewTemplateButton() {
  if (!(await can("library", "full"))) return null;
  return (
    <Link
      href="/admin/library/new"
      className="btn btn-primary gradient-bg shrink-0 px-5 py-2.5 font-grotesk text-[13px] font-semibold text-white no-underline"
    >
      New template
    </Link>
  );
}

async function PillarMix({ data }: { data: Promise<LibraryData> }) {
  const { pillars, counts, total } = await data;

  /* Actual mix against the target. Drift here is the quality signal that shows up
     months later as a feed that only ever talks about features. */
  return (
    <div className="mb-8 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-5 dark:border-white/10 dark:bg-white/10">
      {pillars.map((p) => {
        const n = counts.get(p.key) ?? 0;
        const actual = total ? Math.round((n / total) * 100) : 0;
        const off = Math.abs(actual - p.default_mix_pct) > 12;
        return (
          <div key={p.key} className="bg-white p-4 dark:bg-[#111118]">
            <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-400">
              {p.name}
            </div>
            <div className="font-grotesk text-[17px] font-semibold text-gray-900 dark:text-white">
              {actual}%
              <span className="ml-1.5 text-[11px] font-normal text-gray-400">
                target {p.default_mix_pct}%
              </span>
            </div>
            <div className={`mt-0.5 text-[11px] ${off ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`}>
              {n} {n === 1 ? "post" : "posts"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function TemplateCards({ data }: { data: Promise<LibraryData> }) {
  const { items, canWrite } = await data;

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-black/15 p-8 text-sm text-gray-500 dark:border-white/15">
        No templates yet. Run <span className="font-mono">pnpm seed:demo</span> for a sample set.
      </div>
    );
  }
  return <TemplateList items={items} canWrite={canWrite} />;
}

/* ---------------- the query ---------------- */

type LibraryData = {
  items: TemplateItem[];
  pillars: { key: string; name: string; default_mix_pct: number }[];
  counts: Map<string, number>;
  total: number;
  canWrite: boolean;
};

async function loadLibrary(): Promise<LibraryData> {
  const supabase = await createClient();

  const versionSelect = (withDesign: boolean) =>
    "id, template_id, version, hook, middle_beat, outcome, posts(count)" +
    (withDesign ? ", asset_id, assets(*)" : "") +
    ", template_variants(platform, asset_id, assets(*))";

  const { access, data: firstWave } = await withPermission("library", () =>
    Promise.all([
    supabase
      .from("templates")
      .select(
        "id, code, title, pillar_key, format, status, master_concept, current_version_id, template_features(hl_features(name))"
      )
      .order("code"),
    supabase.from("pillars").select("key, name, default_mix_pct").order("sort"),
    supabase.from("template_versions").select(versionSelect(true)),
    ])
  );

  const [{ data: templates }, { data: pillars }, versionsRes] = firstWave;
  const canWrite = access.permissions.library === "full";

  /* The design column ships ahead of its migration. PostgREST refuses the whole
     select when one column is unknown, so without this the list loses its copy
     beats and its version numbers rather than just its thumbnails. 42703 is
     undefined_column; the retry costs one extra round trip until 0025 is applied
     and none afterwards. */
  const { data: versionData } =
    versionsRes.error?.code === "42703"
      ? await supabase.from("template_versions").select(versionSelect(false))
      : versionsRes;

  const rows = templates ?? [];

  type EmbeddedAsset = Asset | Asset[] | null;
  type VersionRow = {
    id: string;
    template_id: string;
    version: number;
    hook: string | null;
    middle_beat: string | null;
    outcome: string | null;
    posts: { count: number }[] | null;
    asset_id?: string | null;
    assets?: EmbeddedAsset;
    template_variants: { platform: string; asset_id: string | null; assets: EmbeddedAsset }[] | null;
  };

  const versions = (versionData ?? []) as unknown as VersionRow[];

  /* Usage across every version of a template, not just the current one. This is
     what decides delete versus retire, and Postgres counted it. */
  const inUse = new Map<string, number>();
  for (const v of versions) {
    const n = v.posts?.[0]?.count ?? 0;
    if (n) inUse.set(v.template_id, (inUse.get(v.template_id) ?? 0) + n);
  }

  const byId = new Map(versions.map((v) => [v.id, v]));

  /* Signing a Supabase URL is a network call, so every asset the cards will
     actually render is resolved in one batch. Only current versions go in: the
     payload carries designs for older versions too, and signing URLs for
     thumbnails this page never shows would be work bought and thrown away.
     HighLevel and external assets cost nothing, which is the common case and
     does no I/O at all. */
  const shown = new Set(rows.map((t) => t.current_version_id).filter(Boolean) as string[]);
  const assetPool = new Map<string, Asset>();
  for (const v of versions) {
    if (!shown.has(v.id)) continue;
    for (const candidate of [rel<Asset>(v.assets), ...(v.template_variants ?? []).map((x) => rel<Asset>(x.assets))]) {
      if (candidate?.id) assetPool.set(candidate.id, candidate);
    }
  }
  const images = await resolveAssetUrls([...assetPool.values()]);

  /* Actual mix against the target. Drift here is the quality signal that shows up
     months later as a feed that only ever talks about features. */
  const counts = new Map<string, number>();
  for (const t of rows) counts.set(t.pillar_key, (counts.get(t.pillar_key) ?? 0) + 1);

  /* Everything a card shows, flattened to plain values: the list itself is a
     client component because bulk selection is shared state, and it should not
     have to know how assets resolve or how relations come back. */
  const items: TemplateItem[] = rows.map((t) => {
    const v = t.current_version_id ? byId.get(t.current_version_id) : undefined;
    const myVariants = v?.template_variants ?? [];
    /* The version's own design wins. Falling back to a platform variant keeps a
       thumbnail on anything that had one before the design moved onto the version
       in migration 0025. */
    const img = rel<Asset>(v?.assets ?? null) ?? myVariants.map((x) => rel<Asset>(x.assets)).find(Boolean) ?? null;
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
      platforms: myVariants.map((x) => x.platform),
      version: v?.version ?? 1,
      imageUrl: img ? (images.get(img.id)?.url ?? null) : null,
      inUse: inUse.get(t.id) ?? 0,
    };
  });

  return { items, pillars: (pillars ?? []) as LibraryData["pillars"], counts, total: rows.length, canWrite };
}
