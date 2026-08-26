import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead } from "@/components/portal/DataTable";
import { createTemplate } from "../actions";
import { Field, Group, INPUT, CopyLawFields, FeaturePicker } from "../TemplateForm";

export const metadata: Metadata = { title: "New template | socialX Admin" };

export default async function NewTemplatePage() {
  await requirePermission("library");
  const supabase = await createClient();

  const [{ data: pillars }, { data: features }] = await Promise.all([
    supabase.from("pillars").select("key, name, default_mix_pct").order("sort"),
    supabase.from("hl_features").select("id, name, status").order("name"),
  ]);

  return (
    <div className="max-w-[820px]">
      <Link
        href="/admin/library"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 no-underline hover:text-[#2B50DC]"
      >
        back to library
      </Link>
      <div className="mt-3">
        <PageHead title="New template" sub="Niche neutral by default. Niche enters at customization, never in the base library." />
      </div>

      <form action={createTemplate} className="flex flex-col gap-6">
        <Group title="What it is">
          <Field label="Title">
            <input name="title" required className={INPUT} placeholder="Missed call text back, the lost lead angle" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Pillar">
              <select name="pillar_key" required defaultValue="" className={INPUT}>
                <option value="" disabled>Choose one</option>
                {(pillars ?? []).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} ({p.default_mix_pct}% of the mix)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Format">
              <select name="format" defaultValue="static" className={INPUT}>
                <option value="static">Static</option>
                <option value="motion">Motion, around 30 seconds</option>
              </select>
            </Field>
          </div>
          <Field label="Master concept" hint="The one idea. Platform variants hang off this.">
            <textarea name="master_concept" rows={2} className={INPUT} />
          </Field>
        </Group>

        <Group
          title="The copy"
          note="Customer first hook, the HighLevel feature as the quiet resolution, then outcome, then one CTA. Never lead with the product."
        >
          <CopyLawFields />
        </Group>

        <Group
          title="HighLevel features"
          note="Tags cross every pillar. When HighLevel changes one of these, this template surfaces for review along with every client post built from it."
        >
          <FeaturePicker features={features ?? []} />
        </Group>

        <div className="flex items-center gap-4">
          <button className="btn gradient-bg text-white px-7 py-3.5 font-grotesk font-semibold text-sm cursor-pointer border-0">
            Create template
          </button>
          <span className="text-[12.5px] text-gray-500">Saves as a draft at version 1.</span>
        </div>
      </form>
    </div>
  );
}
