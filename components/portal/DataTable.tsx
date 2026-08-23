import type { ReactNode } from "react";

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
        {title}
      </h1>
      {sub && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-[70ch]">{sub}</p>
      )}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-black/10 dark:border-white/10">
      <table className="w-full border-collapse text-sm bg-white dark:bg-[#111118] min-w-[720px]">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            {head.map((h) => (
              <th
                key={h}
                className="text-left font-mono text-[10px] uppercase tracking-[0.11em] text-gray-400 dark:text-gray-600 font-normal px-4 py-3 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-black/6 dark:border-white/6 last:border-0 hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
      {children}
    </tr>
  );
}

export function Cell({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <td
      className={`px-4 py-3 align-top ${
        strong
          ? "font-grotesk font-semibold text-gray-900 dark:text-white"
          : "text-gray-600 dark:text-gray-400"
      }`}
    >
      {children}
    </td>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "text-emerald-700 dark:text-emerald-400 border-emerald-600/30",
  onboarding: "text-[#2B50DC] dark:text-[#5B8DEF] border-[#2B50DC]/30",
  pending: "text-amber-700 dark:text-amber-400 border-amber-600/30",
  past_due: "text-rose-700 dark:text-rose-400 border-rose-600/30",
  paused: "text-amber-700 dark:text-amber-400 border-amber-600/30",
  canceled: "text-gray-500 border-gray-400/30",
  churned: "text-gray-500 border-gray-400/30",
  incomplete: "text-gray-500 border-gray-400/30",
  trialing: "text-[#2B50DC] dark:text-[#5B8DEF] border-[#2B50DC]/30",
};

/** State reads at a glance as shape and colour, not only as a word. */
export function Status({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-400">none</span>;
  const tone = STATUS_TONE[value] ?? "text-gray-500 border-gray-400/30";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.1em] border px-2 py-0.5 ${tone}`}>
      {value.replace("_", " ")}
    </span>
  );
}

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-500">
        {children}
      </td>
    </tr>
  );
}
