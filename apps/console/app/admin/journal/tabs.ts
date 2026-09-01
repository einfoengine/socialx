/**
 * The journal's tabs.
 *
 * Extracted from JournalShell because two things now draw this bar: the shell
 * itself, which makes it interactive, and the loading fallback, which draws it
 * inert while the panels are still coming. A tab bar that changed shape between
 * those two would shift the panel underneath it at the moment it appeared, so
 * both read the same list.
 */

export type TabKey =
  | "journey"
  | "issues"
  | "guidelines"
  | "build-log"
  | "decisions"
  | "ideas";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "journey", label: "Journey" },
  { key: "issues", label: "Issues" },
  { key: "guidelines", label: "Guidelines" },
  { key: "build-log", label: "Daily build log" },
  { key: "decisions", label: "Locked decisions" },
  { key: "ideas", label: "Ideas" },
];

export const TAB_KEYS: TabKey[] = TABS.map((t) => t.key);

/** Shared by the live bar and its placeholder, so neither can drift. */
export const TAB_CLASS =
  "cursor-pointer px-4 py-3 font-grotesk text-[13.5px] font-medium border-b-2 -mb-px transition-colors";
