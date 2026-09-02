"use client";

import { usePathname } from "next/navigation";
import { metaForPath, type PageMeta, type PageShape } from "@/lib/page-meta";
import { PageHead, Table } from "@/components/DataTable";
import { SkeletonLine, SkeletonRows, SkeletonTableRows } from "@/components/Skeleton";

/**
 * The loading fallback for an admin screen, drawn with its real heading.
 *
 * A client component, which is the whole trick. A fallback rendered on the
 * server cannot know which route is arriving, so the old one drew a grey bar
 * where the title goes and every screen looked identical while it waited.
 * usePathname knows, so the heading it draws is the actual heading of the actual
 * page, read from the same record the page itself renders from.
 *
 * The practical effect: Next prefetches this fallback, so on a click the real
 * title and description are on screen before the request has left the browser,
 * and when the page streams in they do not change by a pixel. Only the body
 * below them swaps out of grey.
 *
 * Routes whose heading comes from a record, one client or one template, are not
 * in the map and get a skeleton line instead. Promising the wrong words
 * confidently is worse than promising none.
 */
export default function PageSkeleton({
  fallbackShape = "table",
  variant = "admin",
}: {
  fallbackShape?: PageShape;
  /* The two areas space their heading differently, and the fallback has to match
     the page it stands in front of or the content shifts when it swaps. */
  variant?: "admin" | "portal";
}) {
  const meta = metaForPath(usePathname());

  return (
    <div>
      {meta ? (
        variant === "portal" ? (
          <>
            <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
              {meta.title}
            </h1>
            <p className="mt-1 mb-8 max-w-[64ch] text-sm text-gray-600 dark:text-gray-400">
              {meta.sub}
            </p>
          </>
        ) : (
          <PageHead title={meta.title} sub={meta.sub} />
        )
      ) : (
        <div className="mb-6 flex flex-col gap-2.5">
          <SkeletonLine w="220px" h={24} />
          <SkeletonLine w="380px" h={11} />
        </div>
      )}
      <Body shape={meta?.shape ?? fallbackShape} columns={meta?.columns} />
    </div>
  );
}

function Body({ shape, columns }: { shape: PageShape; columns?: PageMeta["columns"] }) {
  if (shape === "panels") {
    return (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]"
          >
            <div className="border-b border-black/8 px-5 py-4 dark:border-white/8">
              <SkeletonLine w="26%" h={13} />
            </div>
            <div className="flex flex-col gap-3 p-5">
              <SkeletonLine w="100%" h={38} />
              <SkeletonLine w="70%" h={38} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (shape === "form") {
    return (
      <div className="flex max-w-[720px] flex-col gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <SkeletonLine w="18%" h={10} />
            <SkeletonLine w="100%" h={38} />
          </div>
        ))}
      </div>
    );
  }

  if (shape === "cards") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111118]"
          >
            <SkeletonLine w="40%" h={14} />
            <div className="mt-3">
              <SkeletonLine w="85%" h={10} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* A table screen whose columns are known draws its real header row, and greys
     only the cells below it. Nothing about those headings waits on a query, and
     when the rows arrive the header does not move by a pixel. Screens that have
     not declared their columns fall back to plain bordered rows. */
  if (columns?.length) {
    return (
      <Table head={columns}>
        <SkeletonTableRows rows={6} cols={columns.length} />
      </Table>
    );
  }

  return <SkeletonRows n={6} />;
}
