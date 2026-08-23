import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      {children}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "muted" }) {
  const tones = {
    neutral: "border-black/12 dark:border-white/15 text-gray-600 dark:text-gray-400",
    accent: "border-[#2B50DC]/40 text-[#2B50DC] dark:text-[#5B8DEF] dark:border-[#5B8DEF]/40",
    muted: "border-black/8 dark:border-white/8 text-gray-400 dark:text-gray-600",
  };
  return (
    <span className={`font-mono text-[9.5px] uppercase tracking-[0.12em] border px-2 py-0.5 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-black/15 dark:border-white/15 p-8 text-sm text-gray-500 dark:text-gray-500">
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500 dark:text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

export const btnClass =
  "btn gradient-bg text-white px-5 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0";

/** Collapsed "add" form, so the page opens as a reading surface rather than a form. */
export function AddPanel({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] mb-6 group">
      <summary className="px-5 py-3.5 cursor-pointer font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white select-none list-none flex items-center gap-2">
        <span className="text-[#2B50DC] dark:text-[#5B8DEF] group-open:rotate-45 transition-transform inline-block">
          +
        </span>
        {summary}
      </summary>
      <div className="px-5 pb-5 pt-1 border-t border-black/8 dark:border-white/8">{children}</div>
    </details>
  );
}

export function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
