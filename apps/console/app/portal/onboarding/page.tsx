import type { Metadata } from "next";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";
import { saveOnboarding } from "./actions";

export const metadata: Metadata = { title: "Onboarding | socialX" };

const PLATFORMS = [
  ["linkedin", "LinkedIn"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["x", "X"],
  ["hl_community", "HighLevel Community"],
  ["youtube", "YouTube"],
];

export default async function OnboardingPage() {
  const session = await requireOrg();
  const supabase = await createClient();

  const [{ data: brand }, { data: sub }] = await Promise.all([
    supabase.from("brand_profiles").select("*").eq("org_id", session.orgId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan_id, plans(name)")
      .eq("org_id", session.orgId)
      .maybeSingle(),
  ]);

  let cap = 4;
  if (sub?.plan_id) {
    const { data: ent } = await supabase
      .from("plan_entitlements")
      .select("platforms_max")
      .eq("plan_id", sub.plan_id)
      .maybeSingle();
    if (ent) cap = ent.platforms_max;
  }

  const planName = (sub?.plans as { name?: string } | null)?.name;

  return (
    <div className="max-w-[720px]">
      <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
        {brand?.completed_at ? "Your brand profile" : "Tell us about your brand"}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8 max-w-[64ch]">
        {brand?.completed_at
          ? "Change anything here and the next batch picks it up."
          : "Fifteen minutes, once. This is everything we need to write in your voice instead of a generic one."}
      </p>

      <form action={saveOnboarding} className="flex flex-col gap-8">
        <Group title="The brand">
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Brand name" hint="How you want to be referred to in posts">
              <input name="brand_name" defaultValue={brand?.brand_name ?? ""} required className={INPUT} />
            </F>
            <F label="Website">
              <input name="website" type="url" placeholder="https://" defaultValue={brand?.website ?? ""} className={INPUT} />
            </F>
            <F label="Primary colour" hint="Hex, for example #2B50DC">
              <input name="color_primary" defaultValue={(brand?.colors as Record<string, string> | null)?.primary ?? ""} className={INPUT} />
            </F>
            <F label="Secondary colour">
              <input name="color_secondary" defaultValue={(brand?.colors as Record<string, string> | null)?.secondary ?? ""} className={INPUT} />
            </F>
          </div>
        </Group>

        <Group title="Positioning and voice">
          <F label="What your SaaS sells" hint="The offer, in your words">
            <textarea name="positioning" rows={3} defaultValue={brand?.positioning ?? ""} className={INPUT} />
          </F>
          <F label="Who you sell to" hint="Industries, company size, the buyer">
            <textarea name="icp_notes" rows={3} defaultValue={brand?.icp_notes ?? ""} className={INPUT} />
          </F>
          <F label="Niches" hint="Comma separated. For example: roofing, HVAC, plumbing">
            <input name="niches" defaultValue={(brand?.niches ?? []).join(", ")} className={INPUT} />
          </F>
          <F label="How you sound" hint="Direct, technical, warm. Anything a writer should match">
            <textarea name="voice_notes" rows={3} defaultValue={brand?.voice_notes ?? ""} className={INPUT} />
          </F>
          <F label="Words to avoid" hint="Comma separated. We will keep them out of everything">
            <input name="banned_words" defaultValue={(brand?.banned_words ?? []).join(", ")} className={INPUT} />
          </F>
        </Group>

        <Group title={`Platforms${planName ? ` (${planName} covers ${cap})` : ""}`}>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mb-3">
            Pick up to {cap}. Anything beyond that is ignored, so choose the ones that matter.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {PLATFORMS.map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-3 border border-black/12 dark:border-white/12 px-3 py-2.5 cursor-pointer hover:border-[#2B50DC]/40 transition-colors"
              >
                <input type="checkbox" name="platforms" value={value} className="accent-[#2B50DC]" />
                <span className="text-[13.5px] text-gray-800 dark:text-gray-200">{label}</span>
              </label>
            ))}
          </div>
        </Group>

        <Group title="Access and approvals">
          <F
            label="HighLevel location ID"
            hint="Your subaccount id. We schedule into its Social Planner. You can add this later."
          >
            <input name="hl_location_id" className={INPUT} />
          </F>
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Who approves batches">
              <input name="approver_name" defaultValue={brand?.approver_name ?? ""} className={INPUT} />
            </F>
            <F label="Their email">
              <input
                name="approver_email"
                type="email"
                defaultValue={brand?.approver_email ?? session.email ?? ""}
                className={INPUT}
              />
            </F>
          </div>
        </Group>

        <div className="flex items-center gap-4">
          <button type="submit" className="btn gradient-bg text-white px-7 py-3.5 font-grotesk font-semibold text-sm cursor-pointer border-0">
            {brand?.completed_at ? "Save changes" : "Finish onboarding"}
          </button>
          <span className="text-[12.5px] text-gray-500">
            Nothing publishes without your approval.
          </span>
        </div>
      </form>
    </div>
  );
}

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      <legend className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#2B50DC] dark:text-[#5B8DEF] px-2">
        {title}
      </legend>
      <div className="flex flex-col gap-4 pt-2">{children}</div>
    </fieldset>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      {hint && <span className="text-[12px] text-gray-500 dark:text-gray-500 -mt-1">{hint}</span>}
      {children}
    </label>
  );
}
