"use client";

import { useActionState, useState } from "react";
import { savePlansAction } from "../actions";
import Feedback from "../Feedback";
import type { ActionResult } from "../types";
import { btnClass, inputClass } from "../ui";

export type PlanRow = {
  id: string;
  key: string;
  name: string;
  posts: number;
  motion: number;
  platforms: number;
  revisions: number | null;
  firstBatchDays: number;
  customization: string;
  monthlyCall: boolean;
  /* Carried so the page can order the cards the way the pricing table does,
     without a second lookup. */
  sort: number;
};

const LEVELS = ["light", "heavy", "bespoke"];

/**
 * The tier contract, as a form.
 *
 * One submit for all three plans rather than a save button per card, because
 * these numbers are read against each other. Growth having fewer posts than
 * Starter is the kind of mistake that only looks like a mistake when the three
 * are on screen together, and a per-plan save encourages editing one in
 * isolation.
 */
export default function PlansForm({
  plans,
  canWrite,
}: {
  plans: PlanRow[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    savePlansAction,
    null
  );

  return (
    <form action={action}>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} canWrite={canWrite} />
        ))}
      </div>

      {canWrite && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnClass}>
            {pending ? "Saving" : "Save entitlements"}
          </button>
          <Feedback result={state} />
        </div>
      )}
    </form>
  );
}

function PlanCard({ plan, canWrite }: { plan: PlanRow; canWrite: boolean }) {
  /* Unlimited is state rather than a plain checkbox, because the number field
     beside it has to disappear when it is on. Leaving a stale 2 visible next to
     a ticked "unlimited" is how somebody comes away believing Scale gets two. */
  const [unlimited, setUnlimited] = useState(plan.revisions === null);

  const n = (field: string) => `${plan.id}.${field}`;

  return (
    <section className="border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111118]">
      <input type="hidden" name="plan_id" value={plan.id} />

      <h3 className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">
        {plan.name}
      </h3>
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-600">
        {plan.key}
      </p>

      <div className="flex flex-col gap-3.5">
        <Num name={n("posts_per_month")} label="Posts per month" value={plan.posts} disabled={!canWrite} />
        <Num name={n("motion_videos")} label="Motion videos" value={plan.motion} disabled={!canWrite} />
        <Num name={n("platforms_max")} label="Platforms" value={plan.platforms} disabled={!canWrite} />
        <Num name={n("first_batch_days")} label="First batch, days" value={plan.firstBatchDays} disabled={!canWrite} />

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500">
            Revision rounds
          </span>
          {!unlimited && (
            <input
              name={n("revision_rounds")}
              type="number"
              min={0}
              max={100}
              defaultValue={plan.revisions ?? 1}
              disabled={!canWrite}
              className={inputClass}
            />
          )}
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              name={n("revisions_unlimited")}
              checked={unlimited}
              onChange={(e) => setUnlimited(e.target.checked)}
              disabled={!canWrite}
              className="h-4 w-4 accent-[#2B50DC] disabled:cursor-not-allowed disabled:opacity-55"
            />
            Unlimited
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500">
            Customization
          </span>
          <select
            name={n("customization_level")}
            defaultValue={plan.customization}
            disabled={!canWrite}
            className={inputClass}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            name={n("monthly_call")}
            defaultChecked={plan.monthlyCall}
            disabled={!canWrite}
            className="h-4 w-4 accent-[#2B50DC] disabled:cursor-not-allowed disabled:opacity-55"
          />
          Monthly 30 minute call
        </label>
      </div>
    </section>
  );
}

function Num({
  name,
  label,
  value,
  disabled,
}: {
  name: string;
  label: string;
  value: number;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500">
        {label}
      </span>
      <input
        name={name}
        type="number"
        min={0}
        max={1000}
        defaultValue={value}
        disabled={disabled}
        className={inputClass}
      />
    </label>
  );
}
