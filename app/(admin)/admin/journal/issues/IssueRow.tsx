"use client";

import { useState } from "react";
import { setIssueStatus } from "./actions";

export type Issue = {
  id: string;
  number: number;
  title: string;
  detail: string | null;
  area: string;
  severity: "low" | "medium" | "high";
  status: "open" | "in_progress" | "blocked" | "resolved" | "wont_fix";
};

const STATUS_LABEL: Record<Issue["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  resolved: "Resolved",
  wont_fix: "Will not fix",
};

const STATUS_STYLE: Record<Issue["status"], string> = {
  open: "bg-black/[0.05] dark:bg-white/[0.07] text-gray-600 dark:text-gray-400",
  in_progress: "bg-[#00A3FF]/12 text-[#0080c8] dark:text-[#00A3FF]",
  blocked: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  wont_fix: "bg-black/[0.05] dark:bg-white/[0.07] text-gray-400 dark:text-gray-600",
};

const SEVERITY_STYLE: Record<Issue["severity"], string> = {
  high: "text-rose-600 dark:text-rose-400",
  medium: "text-gray-500 dark:text-gray-400",
  low: "text-gray-400 dark:text-gray-600",
};

/* Detail stays folded away. Fourteen issues with their reasoning open at once is
   a wall; the list is for choosing what to work on, the detail for doing it. */
export default function IssueRow({ issue, canEdit }: { issue: Issue; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const done = issue.status === "resolved" || issue.status === "wont_fix";

  return (
    <div className="border-b border-black/5 dark:border-white/5 last:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <span className="w-8 shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
          {issue.number}
        </span>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex-1 min-w-[240px] text-left font-grotesk text-[14px] cursor-pointer transition-colors ${
            done
              ? "text-gray-400 dark:text-gray-600 line-through decoration-1"
              : "text-gray-800 dark:text-gray-200 hover:text-[#3D4AFF] dark:hover:text-[#00A3FF]"
          }`}
          aria-expanded={open}
        >
          {issue.title}
        </button>

        <span className="w-[96px] shrink-0 font-mono text-[10px] text-gray-400 dark:text-gray-600">
          {issue.area}
        </span>
        <span
          className={`w-[52px] shrink-0 font-mono text-[10px] ${SEVERITY_STYLE[issue.severity]}`}
        >
          {issue.severity}
        </span>

        {canEdit ? (
          <form action={setIssueStatus} className="shrink-0">
            <input type="hidden" name="id" value={issue.id} />
            <select
              name="status"
              defaultValue={issue.status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`cursor-pointer border-0 px-2 py-1.5 font-mono text-[10px] focus:outline-hidden ${STATUS_STYLE[issue.status]}`}
            >
              {(Object.keys(STATUS_LABEL) as Issue["status"][]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className={`shrink-0 px-2 py-1.5 font-mono text-[10px] ${STATUS_STYLE[issue.status]}`}>
            {STATUS_LABEL[issue.status]}
          </span>
        )}
      </div>

      {open && issue.detail && (
        <p className="px-5 pb-4 pl-[52px] text-[13px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[86ch]">
          {issue.detail}
        </p>
      )}
    </div>
  );
}
