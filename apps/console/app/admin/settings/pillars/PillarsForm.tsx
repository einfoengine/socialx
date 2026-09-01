"use client";

import { useActionState, useState } from "react";
import { savePillarsAction } from "../actions";
import Feedback from "../Feedback";
import type { ActionResult } from "../types";
import { btnClass, inputClass } from "../ui";

export type PillarRow = { key: string; name: string; pct: number };

/**
 * The default monthly mix.
 *
 * The running total is the whole point of this component. A mix that sums to 90
 * quietly under-fills every batch built from it, and nobody notices until a
 * month comes up short, so the number is on screen while somebody types rather
 * than delivered as an error after they submit. The action checks it too, which
 * is the check that actually holds.
 */
export default function PillarsForm({
  pillars,
  canWrite,
}: {
  pillars: PillarRow[];
  canWrite: boolean;
}) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(pillars.map((p) => [p.key, p.pct]))
  );
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    savePillarsAction,
    null
  );

  const total = Object.values(values).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  const balanced = total === 100;

  return (
    <form action={action}>
      <div className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
        {pillars.map((p) => {
          const pct = values[p.key] ?? 0;
          return (
            <div
              key={p.key}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-black/8 px-5 py-4 last:border-b-0 dark:border-white/8"
            >
              <input type="hidden" name="pillar_key" value={p.key} />

              <div className="min-w-[180px]">
                <p className="font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white">
                  {p.name}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-600">
                  {p.key}
                </p>
              </div>

              {/* The bar is the reading surface, the number is the control. */}
              <div className="h-2 min-w-[120px] flex-1 bg-black/[0.06] dark:bg-white/[0.08]">
                <div
                  className="h-full gradient-bg"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  aria-hidden="true"
                />
              </div>

              <label className="flex shrink-0 items-center gap-2">
                <span className="sr-only">{p.name} share of the monthly mix</span>
                <input
                  name={`${p.key}.mix`}
                  type="number"
                  min={0}
                  max={100}
                  value={pct}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [p.key]: Number(e.target.value) }))
                  }
                  className={`${inputClass} w-[84px]`}
                />
                <span className="font-mono text-[12px] text-gray-500">%</span>
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span
          className={`font-grotesk text-[13px] font-semibold ${
            balanced
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {total}% of 100%
          {!balanced && (total > 100 ? ", over by " + (total - 100) : ", short by " + (100 - total))}
        </span>
      </div>

      {canWrite && (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending || !balanced} className={btnClass}>
            {pending ? "Saving" : "Save mix"}
          </button>
          <Feedback result={state} />
        </div>
      )}
    </form>
  );
}
