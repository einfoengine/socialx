import { SkeletonTiles, SkeletonCard, SkeletonLine } from "@/components/Skeleton";

/**
 * Shown the instant a portal route is navigated to, before its data resolves.
 *
 * Next swaps this in immediately on navigation, so a click never lands on a
 * frozen previous page. It is deliberately generic: a route-level fallback
 * cannot know which screen is coming, so it draws the shape every portal screen
 * shares, a heading and then content, and each page's own Suspense boundaries
 * take over with something closer once the shell is up.
 */
export default function PortalLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2.5">
        <SkeletonLine w="180px" h={22} />
        <SkeletonLine w="320px" h={11} />
      </div>
      <SkeletonTiles n={4} />
      <SkeletonCard lines={3} />
    </div>
  );
}
