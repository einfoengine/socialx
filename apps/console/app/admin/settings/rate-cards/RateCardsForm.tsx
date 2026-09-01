"use client";

import { useActionState } from "react";
import { saveRateCardsAction } from "../actions";
import Feedback from "../Feedback";
import type { ActionResult } from "../types";
import { btnClass, inputClass } from "../ui";

export type CardRow = {
  key: string;
  label: string;
  isActive: boolean;
  activeFrom: string | null;
  activeTo: string | null;
  sort: number;
};

/**
 * Rate cards.
 *
 * Three controls per card and all three matter, because checkout picks the
 * highest sorted active card whose window covers today. Switching the launch
 * offer off is one of two moves: untick it, or give it an end date and let it
 * expire on its own. The second is almost always the right one, so the form puts
 * the dates in reach rather than burying them behind the toggle.
 */
export default function RateCardsForm({
  cards,
  canWrite,
}: {
  cards: CardRow[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveRateCardsAction,
    null
  );

  const today = new Date().toISOString().slice(0, 10);
  const live = cards
    .filter((c) => c.isActive && (!c.activeFrom || c.activeFrom <= today) && (!c.activeTo || c.activeTo >= today))
    .sort((a, b) => b.sort - a.sort)[0];

  return (
    <form action={action}>
      <div className="mb-5 border border-black/10 bg-white px-5 py-3.5 text-[13px] text-gray-600 dark:border-white/10 dark:bg-[#111118] dark:text-gray-400">
        {live ? (
          <>
            Checkout is quoting{" "}
            <strong className="font-grotesk text-gray-900 dark:text-white">{live.label}</strong>{" "}
            today.
          </>
        ) : (
          <span className="text-rose-600 dark:text-rose-400">
            No card is live today, so checkout has no pricing to resolve. Fix that before
            leaving this screen.
          </span>
        )}
      </div>

      <div className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
        {cards.map((c) => (
          <div key={c.key} className="border-b border-black/8 p-5 last:border-b-0 dark:border-white/8">
            <input type="hidden" name="card_key" value={c.key} />

            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h3 className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">
                {c.label}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-600">
                {c.key}, sort {c.sort}
              </span>
            </div>

            <div className="grid max-w-[560px] gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500">
                  Active from
                </span>
                <input
                  name={`${c.key}.active_from`}
                  type="date"
                  defaultValue={c.activeFrom ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500">
                  Active until
                </span>
                <input
                  name={`${c.key}.active_to`}
                  type="date"
                  defaultValue={c.activeTo ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </label>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-[12.5px] text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                name={`${c.key}.is_active`}
                defaultChecked={c.isActive}
                disabled={!canWrite}
                className="h-4 w-4 accent-[#2B50DC] disabled:cursor-not-allowed disabled:opacity-55"
              />
              Enabled
            </label>
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnClass}>
            {pending ? "Saving" : "Save rate cards"}
          </button>
          <Feedback result={state} />
        </div>
      )}
    </form>
  );
}
