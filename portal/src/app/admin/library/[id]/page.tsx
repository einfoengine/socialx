import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withPermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { resolveAssetUrls } from "@/lib/dal/media";
import type { Asset } from "@/lib/core/types/db";
import { rel } from "@/lib/rel";
import { PageHead, Status } from "@/components/DataTable";
import { saveVersion, updateTemplateMeta } from "../actions";
import { Field, Group, INPUT, CopyLawFields, FeaturePicker } from "../TemplateForm";
import TemplateImage, { type CurrentImage, type LibraryAsset } from "../TemplateImage";

export const metadata: Metadata = { title: "Template | Admin" };

export default async function TemplateDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  /*
   * One wave.
   *
   * This used to be a chain: fetch the template, then wait for it before asking
   * for anything else, and inside that second batch a nested await for the very
   * version ids the batch was about to query anyway. A round trip to Supabase
   * from here costs around 270ms no matter how small the question, so a chain of
   * six is a page that sits still for a second and a half before it renders a
   * character. Awaiting in sequence is what makes a server component slow;
   * nothing about the framework can unpick it.
   *
   * None of these actually depend on each other. The template id comes from the
   * URL, not from the first query, so every one of them can leave at once.
   *
   *   posts(count) via an inner join replaces "fetch every version id, then
   *   fetch every post carrying one, then count the array in JavaScript". Only
   *   the number was ever used.
   *
   *   assets(*) is embedded on the version, so the design arrives with the copy
   *   instead of forcing another wave once its id is known.
   *
   * The permission check rides along in the same wave. It is still read live from
   * the database on this request, so revoking access still lands on the next page
   * load; it just no longer costs its own round trip in front of everything else.
   */
  const versionSelect = (withDesign: boolean) =>
    "id, version, hook, middle_beat, outcome, cta, changelog, published_at" +
    (withDesign ? ", asset_id, assets(*)" : "");

  const { access, data: firstWave } = await withPermission("library", () =>
    Promise.all([
    supabase
      .from("templates")
      .select("id, code, title, pillar_key, format, status, master_concept, current_version_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("template_versions")
      .select(versionSelect(true))
      .eq("template_id", id)
      .order("version", { ascending: false }),
    supabase.from("pillars").select("key, name").order("sort"),
    supabase.from("hl_features").select("id, name, status").order("name"),
    supabase.from("template_features").select("feature_id").eq("template_id", id),
    /* cross-site: the library is platform IP, shared by every site. This counts
       how many posts anywhere were built from this template. */
    supabase
      .from("posts")
      .select("id, template_versions!inner(template_id)", { count: "exact", head: true })
      .eq("template_versions.template_id", id),
    /* The picker's shelf. Capped and newest first: this is a picker, not a media
       manager, and loading the whole assets table to render thumbnails nobody
       scrolls to is how this screen gets slow as the library grows. */
    /* cross-site: library assets carry no organization and belong to no site.
       That is what .is("org_id", null) below selects. */
    supabase
      .from("assets")
      .select("*")
      .is("org_id", null)
      .order("created_at", { ascending: false })
      .limit(60),
    ])
  );

  const [
    { data: template },
    versionsRes,
    { data: pillars },
    { data: features },
    { data: tags },
    { count: usageCount },
    { data: libraryRows },
  ] = firstWave;

  const canWrite = access.permissions.library === "full";
  if (!template) notFound();

  /*
   * The design column ships ahead of the migration that creates it.
   *
   * PostgREST refuses the whole select when one column is unknown, so asking for
   * asset_id on a database still on 0024 returns no versions at all. That is far
   * worse than a missing feature: the copy history empties, the next version
   * number resets to 1, and the screen reports "no version yet" for a template
   * that plainly has one. Falling back to the select without it keeps every part
   * of this page working and turns the gap into one honest notice.
   *
   * 42703 is undefined_column.
   */
  const schemaReady = versionsRes.error?.code !== "42703";
  const { data: fallbackVersions } = schemaReady
    ? { data: null }
    : await supabase
        .from("template_versions")
        .select(versionSelect(false))
        .eq("template_id", id)
        .order("version", { ascending: false });

  type VersionRow = {
    id: string;
    version: number;
    hook: string | null;
    middle_beat: string | null;
    outcome: string | null;
    cta: string | null;
    changelog: string | null;
    published_at: string | null;
    asset_id?: string | null;
    assets?: Asset | Asset[] | null;
  };

  const versions = ((versionsRes.data ?? fallbackVersions ?? []) as unknown as VersionRow[]);

  /* Every asset on the page resolved together: the designs attached to versions,
     plus the picker's shelf. Signing a Supabase URL is a network call, so doing
     this in one batch is the difference between one round trip and thirty. */
  const libraryList = (libraryRows ?? []) as Asset[];
  const assetPool = new Map<string, Asset>(libraryList.map((a) => [a.id, a]));
  for (const v of versions) {
    const embedded = rel<Asset>(v.assets ?? null);
    if (embedded?.id) assetPool.set(embedded.id, embedded);
  }
  const resolved = await resolveAssetUrls([...assetPool.values()]);

  const library: LibraryAsset[] = libraryList.map((a) => ({
    id: a.id,
    url: resolved.get(a.id)?.url ?? "",
    alt: a.alt,
    provider: a.provider,
    isBroken: resolved.get(a.id)?.isBroken ?? true,
  }));

  const imageFor = (version: VersionRow | undefined): CurrentImage | null => {
    const asset = rel<Asset>(version?.assets ?? null);
    if (!asset?.id) return null;
    const r = resolved.get(asset.id);
    if (!r) return null;
    return {
      assetId: asset.id,
      url: r.url,
      alt: asset.alt,
      provider: asset.provider,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      isBroken: r.isBroken,
    };
  };

  const selected = (tags ?? []).map((t) => t.feature_id);
  const usage = { length: usageCount ?? 0 };

  const current = versions.find((v) => v.id === template.current_version_id) ?? versions[0];
  const currentImage = imageFor(current);


  return (
    <div className="max-w-[900px]">
      <Link
        href="/admin/library"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 no-underline hover:text-[#2B50DC]"
      >
        back to library
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
        <PageHead title={template.title} sub={template.master_concept ?? undefined} />
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11.5px] text-gray-500">{template.code}</span>
          <Status value={template.status} />
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] border border-black/12 dark:border-white/15 text-gray-500 px-2 py-0.5">
            v{current?.version ?? 1}
          </span>
        </div>
      </div>

      {(usage ?? []).length > 0 && (
        <div className="border border-[#2B50DC]/30 bg-[#2B50DC]/5 p-4 mb-6 text-[13px] text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-white">
            In use by {(usage ?? []).length} client post{(usage ?? []).length === 1 ? "" : "s"}.
          </strong>{" "}
          Saving a new version leaves those untouched, because each post points at the
          version it was built from rather than at the template.
        </div>
      )}

      <div className="flex flex-col gap-6">
        <TemplateImage
          templateId={template.id}
          versionId={current?.id ?? null}
          version={current?.version ?? 1}
          current={currentImage}
          library={library}
          canWrite={canWrite}
          schemaReady={schemaReady}
        />

        <form action={updateTemplateMeta}>
          <input type="hidden" name="id" value={template.id} />
          <Group title="Meta">
            <Field label="Title">
              <input name="title" defaultValue={template.title} className={INPUT} />
            </Field>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Pillar">
                <select name="pillar_key" defaultValue={template.pillar_key} className={INPUT}>
                  {(pillars ?? []).map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Format">
                <select name="format" defaultValue={template.format} className={INPUT}>
                  <option value="static">Static</option>
                  <option value="motion">Motion</option>
                </select>
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={template.status} className={INPUT}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="retired">Retired</option>
                </select>
              </Field>
            </div>
            <Field label="Master concept">
              <textarea name="master_concept" rows={2} defaultValue={template.master_concept ?? ""} className={INPUT} />
            </Field>
            <Field label="HighLevel features">
              <FeaturePicker features={features ?? []} selected={selected} />
            </Field>
            <button className="btn btn-ink bg-[#111118] dark:bg-white text-white dark:text-[#111118] px-6 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0 self-start">
              Save meta
            </button>
          </Group>
        </form>

        <form action={saveVersion}>
          <input type="hidden" name="template_id" value={template.id} />
          <Group
            title={`New version (would be v${(versions[0]?.version ?? 0) + 1})`}
            note="Copy is versioned rather than edited in place. Posts reference the version they were built from, so overwriting would silently rewrite history for every client already running this."
          >
            <CopyLawFields defaults={current ?? undefined} />
            <Field label="What changed" hint="Why this version exists. Read months later by someone who was not here.">
              <input name="changelog" className={INPUT} />
            </Field>
            <button className="btn gradient-bg text-white px-6 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0 self-start">
              Save as new version
            </button>
          </Group>
        </form>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
            Version history
          </h2>
          <div className="flex flex-col gap-2">
            {versions.map((v) => {
              const shot = imageFor(v);
              return (
              <div
                key={v.id}
                className={`border p-4 bg-white dark:bg-[#111118] flex gap-4 ${
                  v.id === template.current_version_id
                    ? "border-[#2B50DC]/40"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                {/* The design shipped with the copy, so the history shows both.
                    Reading a changelog without seeing what the artwork was at the
                    time answers half the question. */}
                {shot && !shot.isBroken && shot.url && (
                  /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote host */
                  <img
                    src={shot.url}
                    alt=""
                    loading="lazy"
                    className="h-[76px] w-[76px] shrink-0 border border-black/10 object-cover dark:border-white/10"
                  />
                )}
                <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-grotesk font-semibold text-gray-900 dark:text-white">v{v.version}</span>
                  {v.id === template.current_version_id && (
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#2B50DC] dark:text-[#5B8DEF] border border-[#2B50DC]/40 px-1.5 py-0.5">
                      current
                    </span>
                  )}
                  {v.published_at && (
                    <span className="font-mono text-[10px] text-gray-400 ml-auto">
                      {new Date(v.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                {v.changelog && (
                  <p className="text-[12.5px] text-gray-500 italic mb-2">{v.changelog}</p>
                )}
                <div className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">
                  {v.hook && <p className="mb-1"><Beat>hook</Beat>{v.hook}</p>}
                  {v.middle_beat && <p className="mb-1"><Beat>feature</Beat>{v.middle_beat}</p>}
                  {v.outcome && <p className="mb-1"><Beat>outcome</Beat>{v.outcome}</p>}
                  {v.cta && <p><Beat>cta</Beat>{v.cta}</p>}
                </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Beat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400 mr-2">
      {children}
    </span>
  );
}
