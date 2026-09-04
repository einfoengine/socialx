import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";

export const metadata: Metadata = {
  title: "Plan & Context | Admin",
};

/**
 * Plan & Context shell.
 *
 * Synchronous on purpose. The heading and its one line of description depend on
 * nothing, so they flush before the journal's five queries have left, and the
 * fallback in loading.tsx fills only the space beneath them.
 *
 * The tabs stopped being routes when the journal became a single page: they are
 * client state now, with the active one mirrored into the query string so a view
 * still deep links. The five old routes survive as redirects.
 */
export default function JournalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
          {pageMeta("/admin/journal").title}
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm text-gray-600 dark:text-gray-400">
          {pageMeta("/admin/journal").sub}
        </p>
      </div>

      <div>{children}</div>
    </div>
  );
}
