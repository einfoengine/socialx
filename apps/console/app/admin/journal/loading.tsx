import { SkeletonLine } from "@/components/Skeleton";
import { TABS, TAB_CLASS } from "./tabs";

/**
 * Shown while the journal's five queries come back.
 *
 * The heading above this comes from the layout, which is synchronous, so it is
 * already on screen and this fills only the space beneath it.
 *
 * The tab bar is drawn for real rather than as a grey strip. Its labels are a
 * fixed list in tabs.ts and never depended on a query, so greying them out would
 * be inventing uncertainty that does not exist. Drawing them at their true width
 * also means the panel below does not jump sideways when the live bar replaces
 * this one. Journey is marked current because that is the tab the page opens on
 * unless the URL says otherwise.
 */
export default function JournalLoading() {
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap border-b border-black/10 dark:border-white/10" aria-hidden="true">
        {TABS.map((t, i) => (
          <span
            key={t.key}
            className={`${TAB_CLASS} cursor-default ${
              i === 0
                ? "border-[#3D4AFF] text-[#3D4AFF] dark:border-[#00A3FF] dark:text-[#00A3FF]"
                : "border-transparent text-gray-400 dark:text-gray-600"
            }`}
          >
            {t.label}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111118]"
          >
            <SkeletonLine w="32%" h={12} />
            <div className="mt-3 flex flex-col gap-2">
              <SkeletonLine w="100%" h={10} />
              <SkeletonLine w="76%" h={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
