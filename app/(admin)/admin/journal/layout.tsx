import type { Metadata } from "next";
import JournalTabs from "./JournalTabs";

export const metadata: Metadata = {
  title: "Plan & Context | socialX Admin",
};

/**
 * Plan & Context shell. The three tabs are real routes, not client state, so each view
 * deep links, appears in browser history, and can be sent to someone directly.
 */
export default function JournalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
          Plan &amp; Context
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-[68ch]">
          Build context, locked decisions, and ideas worth keeping. This is the memory
          the project carries between sessions.
        </p>
      </div>

      <JournalTabs />

      <div>{children}</div>
    </div>
  );
}
