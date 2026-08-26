export type Guideline = {
  id: string;
  number: number;
  area: string;
  rule: string;
  why: string;
};

const AREA_STYLE: Record<string, string> = {
  Performance: "bg-[#00A3FF]/12 text-[#0080c8] dark:text-[#00A3FF]",
  Security: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  Brand: "bg-[#3D4AFF]/12 text-[#3D4AFF] dark:text-[#7C86FF]",
  Verification: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

/* Rule then reason, always. A rule with no reason gets argued with, and a rule
   whose reason is "it broke once" is the one people actually keep. */
export default function GuidelinesPanel({ rules }: { rules: Guideline[] }) {
  const areas = [...new Set(rules.map((r) => r.area))];

  return (
    <div className="flex flex-col gap-8">
      {areas.map((area) => (
        <section key={area}>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 mb-3">
            {area}
          </div>
          <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
            {rules
              .filter((r) => r.area === area)
              .map((r) => (
                <div
                  key={r.id}
                  className="border-b border-black/5 dark:border-white/5 last:border-0 px-5 py-4"
                >
                  <div className="flex items-baseline gap-3 mb-1.5">
                    <span className="w-6 shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
                      {r.number}
                    </span>
                    <h3 className="font-grotesk text-[14.5px] font-semibold text-gray-900 dark:text-white">
                      {r.rule}
                    </h3>
                    <span
                      className={`ml-auto shrink-0 px-2 py-0.5 font-mono text-[9px] ${
                        AREA_STYLE[r.area] ?? "bg-black/[0.05] text-gray-500"
                      }`}
                    >
                      {r.area}
                    </span>
                  </div>
                  <p className="pl-9 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[92ch]">
                    {r.why}
                  </p>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
