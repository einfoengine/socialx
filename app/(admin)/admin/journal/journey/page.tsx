import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal/permissions";
import {
  ACTOR_LABEL,
  JOURNEY,
  JOURNEY_LOOPS_TO,
  type JourneyActor,
} from "@/lib/journey";

export const metadata: Metadata = { title: "Journey | socialX Admin" };

/* Who moves at each step. Colour separates the two sides at a glance, which is
   the whole reason to read this list rather than a paragraph. */
const ACTOR_STYLE: Record<JourneyActor, string> = {
  client: "bg-[#00A3FF]/12 text-[#0080c8] dark:text-[#00A3FF]",
  socialx: "bg-[#3D4AFF]/12 text-[#3D4AFF] dark:text-[#7C86FF]",
  both: "bg-black/[0.06] dark:bg-white/[0.08] text-gray-600 dark:text-gray-400",
};

export default async function JourneyPage() {
  await requirePermission("journal");

  return (
    <div className="flex flex-col gap-8 max-w-[760px]">
      {JOURNEY.map((phase) => (
        <section key={phase.title}>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600">
              {phase.title}
            </h2>
            {phase.repeats && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#3D4AFF] dark:text-[#00A3FF]">
                repeats every month
              </span>
            )}
          </div>

          <ol className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
            {phase.steps.map((s) => (
              <li
                key={s.n}
                className="flex items-center gap-4 px-5 py-3 border-b border-black/5 dark:border-white/5 last:border-0"
              >
                <span className="w-6 shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
                  {s.n}
                </span>
                <span
                  /* No uppercase here: the brand name is socialX in every
                     context, and text-transform would render it SOCIALX. */
                  className={`w-[68px] shrink-0 text-center px-2 py-1 font-mono text-[11px] tracking-[0.04em] ${ACTOR_STYLE[s.actor]}`}
                >
                  {ACTOR_LABEL[s.actor]}
                </span>
                <span className="font-grotesk text-[14px] text-gray-800 dark:text-gray-200">
                  {s.text}
                </span>
              </li>
            ))}
          </ol>

          {phase.repeats && (
            <div className="flex items-center gap-4 px-5 py-3 border border-t-0 border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
              <span className="w-6 shrink-0 text-center font-mono text-[13px] text-[#3D4AFF] dark:text-[#00A3FF]">
                &#8593;
              </span>
              <span className="font-grotesk text-[13.5px] text-gray-600 dark:text-gray-400">
                Back to step {JOURNEY_LOOPS_TO}
              </span>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
