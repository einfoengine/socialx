"use client";

import { Fragment, useActionState, useState } from "react";
import { savePermissionsAction, type SaveResult } from "./actions";
import {
  SECTIONS,
  isLockedRole,
  type AccessLevel,
  type PermissionMap,
  type SectionKey,
} from "@/lib/sections";
import type { StaffRole } from "@/lib/core/types/db";

const ROLES: StaffRole[] = ["owner", "ops", "content", "finance"];
const LEVELS: AccessLevel[] = ["none", "view", "full"];

const LEVEL_LABEL: Record<AccessLevel, string> = {
  none: "None",
  view: "View",
  full: "Full",
};

/* Colour carries the meaning at a glance: the grid is 56 cells and reading it as
   words alone is slow. Brand blue is "full" because that is the permissive end. */
const LEVEL_STYLE: Record<AccessLevel, string> = {
  none: "bg-black/[0.04] dark:bg-white/[0.06] text-gray-500 dark:text-gray-500",
  view: "bg-[#00A3FF]/12 text-[#0080c8] dark:text-[#00A3FF]",
  full: "bg-[#3D4AFF]/12 text-[#3D4AFF] dark:text-[#7C86FF]",
};

export default function PermissionsMatrix({
  initial,
  canWrite,
}: {
  initial: Record<StaffRole, PermissionMap>;
  /* False for anyone who is not a staff owner. The grid still renders, because
     knowing what a role means is useful to anyone who can open Settings; what it
     loses is the ability to post. */
  canWrite: boolean;
}) {
  const [matrix, setMatrix] = useState(initial);
  const [state, formAction, pending] = useActionState<SaveResult | null, FormData>(
    savePermissionsAction,
    null
  );

  const dirty = JSON.stringify(matrix) !== JSON.stringify(initial);

  function cycle(role: StaffRole, section: SectionKey) {
    if (!canWrite || isLockedRole(role)) return;
    setMatrix((m) => {
      const current = m[role][section];
      const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
      return { ...m, [role]: { ...m[role], [section]: next } };
    });
  }

  // Group headings mirror the rail, so the grid reads in the same order as the nav.
  const groups: { title: string; sections: typeof SECTIONS }[] = [];
  for (const s of SECTIONS) {
    const last = groups[groups.length - 1];
    if (last && last.title === s.group) last.sections.push(s);
    else groups.push({ title: s.group, sections: [s] });
  }

  return (
    <form action={formAction}>
      {/* Every cell posts, including the ones nobody touched, so the action can
          write the matrix as a whole rather than diffing against stale state. */}
      {ROLES.filter((r) => !isLockedRole(r)).map((role) =>
        SECTIONS.map((s) => (
          <input
            key={`${role}.${s.key}`}
            type="hidden"
            name={`${role}.${s.key}`}
            value={matrix[role][s.key]}
          />
        ))
      )}

      <div className="overflow-x-auto border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 px-5 py-3">
                Section
              </th>
              {ROLES.map((r) => (
                <th
                  key={r}
                  className="font-grotesk text-[12px] font-semibold text-gray-700 dark:text-gray-300 px-3 py-3 w-[110px]"
                >
                  {r}
                  {isLockedRole(r) && (
                    <span className="block font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-gray-400 dark:text-gray-600">
                      locked
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.title || "top"}>
                {g.title && (
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                    <td
                      colSpan={ROLES.length + 1}
                      className="px-5 pt-5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600"
                    >
                      {g.title}
                    </td>
                  </tr>
                )}
                {g.sections.map((s) => (
                  <tr
                    key={s.key}
                    className="border-b border-black/[0.06] dark:border-white/[0.06] last:border-0"
                  >
                    <td className="px-5 py-2 font-grotesk text-[13.5px] text-gray-800 dark:text-gray-200">
                      {s.label}
                    </td>
                    {ROLES.map((r) => {
                      const level = matrix[r][s.key];
                      const locked = isLockedRole(r) || !canWrite;
                      return (
                        <td key={r} className="px-3 py-2 text-center">
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => cycle(r, s.key)}
                            aria-label={`${s.label}, ${r}: ${LEVEL_LABEL[level]}`}
                            className={`w-full px-2 py-1.5 font-grotesk text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors ${LEVEL_STYLE[level]} ${
                              locked
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer hover:brightness-95 dark:hover:brightness-125"
                            }`}
                          >
                            {LEVEL_LABEL[level]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {canWrite && (
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="btn btn-primary gradient-bg text-white font-grotesk text-xs font-semibold uppercase tracking-wider px-6 py-3 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {pending ? "Saving" : "Save access"}
        </button>

        {dirty && !pending && (
          <button
            type="button"
            onClick={() => setMatrix(initial)}
            className="font-grotesk text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Discard changes
          </button>
        )}

        {state && (
          <span
            className={`font-grotesk text-xs ${
              state.ok ? "text-[#3D4AFF] dark:text-[#7C86FF]" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {state.ok ? state.message : state.error}
          </span>
        )}
      </div>
      )}

      <p className="mt-4 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-500 max-w-[70ch]">
        {canWrite ? "Click a cell to cycle it. None" : "None"} hides the section from
        the rail and blocks the URL. View opens the screen but refuses every write on
        it. Owner is locked to Full so there is always a way back into this page.
      </p>
    </form>
  );
}
