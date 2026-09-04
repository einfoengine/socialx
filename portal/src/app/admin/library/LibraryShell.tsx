import { PageHead } from "@/components/DataTable";
import { SkeletonLine } from "@/components/Skeleton";

/**
 * The parts of the library screen that never depend on a query.
 *
 * Shared by page.tsx and loading.tsx on purpose. The heading and the two section
 * labels are the same words whether the data has arrived or not, so drawing them
 * as grey bars while a database 260ms away is consulted is a lie the page tells
 * about itself. Worse, it means the title paints twice: once as a placeholder,
 * once for real, and the eye tracks the movement.
 *
 * Because both files render these same components, the fallback and the finished
 * page are pixel identical everywhere except the two regions that genuinely have
 * to wait. Nothing reflows when the data lands; the skeletons are simply replaced
 * in place. Keeping them in one file is what stops the two copies drifting apart
 * the first time somebody rewords the subtitle.
 */

export function LibraryHeader({ action }: { action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageHead
        title="Library"
        sub="Every template is built around a real HighLevel feature, niche neutral until a batch customizes it."
      />
      {action}
    </div>
  );
}

/** Holds the button's footprint so the header does not jump when it resolves. */
export function ActionPlaceholder() {
  return <SkeletonLine w="132px" h={42} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600">
      {children}
    </h2>
  );
}

/* ---------------- the two regions that do wait ---------------- */

/** Five tiles in the same five column grid the real ones use. */
export function PillarMixSkeleton() {
  return (
    <div className="mb-8 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-5 dark:border-white/10 dark:bg-white/10">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="bg-white p-4 dark:bg-[#111118]">
          <SkeletonLine w="70%" h={9} />
          <div className="mt-2">
            <SkeletonLine w="50%" h={17} />
          </div>
          <div className="mt-1.5">
            <SkeletonLine w="35%" h={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cards with the same 92px thumbnail well and three beat columns. */
export function TemplateCardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="flex gap-4 border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#111118]"
        >
          <span className="block h-[92px] w-[92px] shrink-0">
            <SkeletonLine w="100%" h={92} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <SkeletonLine w="45%" h={14} />
            <div className="grid gap-x-5 gap-y-1 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, j) => (
                <div key={j} className="flex flex-col gap-1">
                  <SkeletonLine w="40%" h={8} />
                  <SkeletonLine w="90%" h={10} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
