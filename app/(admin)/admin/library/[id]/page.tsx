import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";
import { PageHead, Status } from "@/components/portal/DataTable";
import { saveVersion, updateTemplateMeta } from "../actions";
import { Field, Group, INPUT, CopyLawFields, FeaturePicker } from "../TemplateForm";

export const metadata: Metadata = { title: "Template | socialX Admin" };

export default async function TemplateDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("templates")
    .select("id, code, title, pillar_key, format, status, master_concept, current_version_id")
    .eq("id", id)
    .maybeSingle();

  if (!template) notFound();

  const [{ data: versions }, { data: pillars }, { data: features }, { data: tags }, { data: usage }] =
    await Promise.all([
      supabase
        .from("template_versions")
        .select("id, version, hook, middle_beat, outcome, cta, changelog, published_at")
        .eq("template_id", id)
        .order("version", { ascending: false }),
      supabase.from("pillars").select("key, name").order("sort"),
      supabase.from("hl_features").select("id, name, status").order("name"),
      supabase.from("template_features").select("feature_id").eq("template_id", id),
      supabase
        .from("posts")
        .select("id, org_id, status, template_version_id, organizations(name)")
        .in(
          "template_version_id",
          (
            await supabase.from("template_versions").select("id").eq("template_id", id)
          ).data?.map((v) => v.id) ?? ["00000000-0000-0000-0000-000000000000"]
        ),
    ]);

  const current = (versions ?? []).find((v) => v.id === template.current_version_id) ?? versions?.[0];
  const selected = (tags ?? []).map((t) => t.feature_id);

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
            title={`New version (would be v${(versions?.[0]?.version ?? 0) + 1})`}
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
            {(versions ?? []).map((v) => (
              <div
                key={v.id}
                className={`border p-4 bg-white dark:bg-[#111118] ${
                  v.id === template.current_version_id
                    ? "border-[#2B50DC]/40"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
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
            ))}
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
