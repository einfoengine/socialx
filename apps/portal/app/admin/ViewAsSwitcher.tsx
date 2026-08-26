"use client";

import { setViewAs } from "./view-actions";

export type ViewOption = { value: string; label: string; group: string };

/**
 * Whose eyes you are looking through.
 *
 * One control for both kinds of preview, because from the operator's side they
 * are the same question. Changing the selection submits immediately: a switcher
 * with a separate Apply button is a switcher people forget to apply.
 */
export default function ViewAsSwitcher({
  options,
  current,
  previewing,
}: {
  options: ViewOption[];
  current: string;
  previewing: boolean;
}) {
  const groups = [...new Set(options.map((o) => o.group))];

  return (
    <form action={setViewAs} className="flex items-center">
      <select
        id="view-as"
        name="view"
        aria-label="Viewing as"
        title="Viewing as"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`h-9 max-w-[190px] cursor-pointer border px-2.5 font-grotesk text-[12.5px] focus:outline-hidden transition-colors ${
          previewing
            ? "border-[#3D4AFF]/45 bg-[#3D4AFF]/[0.07] text-[#3D4AFF] dark:text-[#00A3FF] font-semibold"
            : "border-black/12 dark:border-white/15 bg-transparent text-gray-600 dark:text-gray-400"
        }`}
      >
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {options
              .filter((o) => o.group === g)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </form>
  );
}
