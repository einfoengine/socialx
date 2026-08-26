import type { ReactNode } from "react";

export const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
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

export function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      <legend className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#2B50DC] dark:text-[#5B8DEF] px-2">
        {title}
      </legend>
      {note && (
        <p className="text-[12.5px] text-gray-500 dark:text-gray-500 pt-1 pb-3 max-w-[70ch] leading-relaxed">
          {note}
        </p>
      )}
      <div className="flex flex-col gap-4 pt-2">{children}</div>
    </fieldset>
  );
}

/**
 * The copy law, as four separate inputs.
 *
 * Hook opens on the reader's world, the HighLevel feature is the quiet resolution in
 * the middle beat, then the outcome, then one CTA. Four fields rather than one body
 * box because a draft that leads with the product is then visible at a glance rather
 * than buried in a paragraph.
 */
export function CopyLawFields({
  defaults,
}: {
  defaults?: { hook?: string | null; middle_beat?: string | null; outcome?: string | null; cta?: string | null };
}) {
  return (
    <>
      <Field label="Hook" hint="Opens on the reader's world. Never on the product.">
        <textarea name="hook" rows={2} defaultValue={defaults?.hook ?? ""} className={INPUT} />
      </Field>
      <Field label="Middle beat" hint="The HighLevel feature as the quiet resolution.">
        <textarea name="middle_beat" rows={3} defaultValue={defaults?.middle_beat ?? ""} className={INPUT} />
      </Field>
      <Field label="Outcome" hint="What changes for them. Trust at the sales stage, close rate, hours back.">
        <textarea name="outcome" rows={2} defaultValue={defaults?.outcome ?? ""} className={INPUT} />
      </Field>
      <Field label="CTA" hint="One only, and name the action. No 'learn more'.">
        <input name="cta" defaultValue={defaults?.cta ?? ""} className={INPUT} />
      </Field>
    </>
  );
}

export function FeaturePicker({
  features,
  selected = [],
}: {
  features: { id: string; name: string; status: string }[];
  selected?: string[];
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
      {features.map((f) => (
        <label
          key={f.id}
          className="flex items-center gap-2.5 border border-black/10 dark:border-white/12 px-2.5 py-2 cursor-pointer hover:border-[#2B50DC]/40 transition-colors"
        >
          <input
            type="checkbox"
            name="features"
            value={f.id}
            defaultChecked={selected.includes(f.id)}
            className="accent-[#2B50DC] shrink-0"
          />
          <span className="text-[12.5px] text-gray-800 dark:text-gray-200 leading-tight">
            {f.name}
            {f.status === "changed" && (
              <span className="block font-mono text-[9px] uppercase text-amber-600">changed</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
