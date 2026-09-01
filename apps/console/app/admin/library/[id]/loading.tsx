import { SkeletonLine } from "@/components/Skeleton";

/**
 * One template, drawn empty.
 *
 * The list's skeleton would otherwise be inherited here, and flashing a grid of
 * cards on the way into a single record reads as the wrong page arriving.
 */
export default function TemplateLoading() {
  return (
    <div className="max-w-[900px]">
      <SkeletonLine w="120px" h={10} />
      <div className="mt-3 mb-6 flex flex-col gap-2.5">
        <SkeletonLine w="280px" h={24} />
        <SkeletonLine w="440px" h={11} />
      </div>

      {/* The design panel, which is the tall thing on this screen. */}
      <div className="mb-6 border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
        <div className="border-b border-black/8 px-5 py-4 dark:border-white/8">
          <SkeletonLine w="70px" h={13} />
        </div>
        <div className="flex flex-col gap-6 p-5 md:flex-row">
          <div className="md:w-[300px] md:shrink-0">
            <SkeletonLine w="100%" h={300} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <SkeletonLine w="55%" h={11} />
            <SkeletonLine w="100%" h={38} />
            <SkeletonLine w="80%" h={11} />
          </div>
        </div>
      </div>

      <div className="border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111118]">
        <SkeletonLine w="60px" h={10} />
        <div className="mt-4 flex flex-col gap-4">
          <SkeletonLine w="100%" h={38} />
          <div className="grid gap-4 sm:grid-cols-3">
            <SkeletonLine w="100%" h={38} />
            <SkeletonLine w="100%" h={38} />
            <SkeletonLine w="100%" h={38} />
          </div>
        </div>
      </div>
    </div>
  );
}
