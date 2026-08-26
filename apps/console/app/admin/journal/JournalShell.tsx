"use client";

import { useEffect, useState, type ReactNode } from "react";

export type TabKey =
  | "journey"
  | "issues"
  | "guidelines"
  | "build-log"
  | "decisions"
  | "ideas";

const TABS: { key: TabKey; label: string }[] = [
  { key: "journey", label: "Journey" },
  { key: "issues", label: "Issues" },
  { key: "guidelines", label: "Guidelines" },
  { key: "build-log", label: "Daily build log" },
  { key: "decisions", label: "Locked decisions" },
  { key: "ideas", label: "Ideas" },
];

/**
 * The journal's tabs.
 *
 * Every panel is a server component, already rendered, handed in as a prop. The
 * whole journal arrives in one response and switching tabs is a local state
 * change: no navigation, no second render, no round trip to a database that sits
 * on another continent. That is the point. Five routes meant five full page
 * loads through the auth stack to read five lists that were already one query
 * away from each other.
 *
 * Deep links survive because the tab lives in the URL, written with
 * replaceState so it stays shareable without asking Next to route anywhere.
 */
export default function JournalShell({
  initial,
  panels,
  counts,
}: {
  initial: TabKey;
  panels: Record<TabKey, ReactNode>;
  counts: Partial<Record<TabKey, number>>;
}) {
  const [tab, setTab] = useState<TabKey>(initial);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === tab) return;
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }, [tab]);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap border-b border-black/10 dark:border-white/10">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={active ? "page" : undefined}
              className={`cursor-pointer px-4 py-3 font-grotesk text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[#3D4AFF] text-[#3D4AFF] dark:border-[#00A3FF] dark:text-[#00A3FF]"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {t.label}
              {counts[t.key] ? (
                <span className="ml-2 font-mono text-[10px] text-gray-400 dark:text-gray-600">
                  {counts[t.key]}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Rendered, not mounted on demand: the panels already exist in this
          response, so hiding is cheaper than fetching and the browser keeps
          scroll position per tab. */}
      {TABS.map((t) => (
        <div key={t.key} hidden={t.key !== tab}>
          {panels[t.key]}
        </div>
      ))}
    </div>
  );
}
