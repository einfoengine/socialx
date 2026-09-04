/**
 * Placeholders for data that has not arrived.
 *
 * Every one of these is sized to the thing it stands in for. A placeholder that
 * is the wrong height is worse than none: the page reflows when the real content
 * lands, and the reader loses their place at the exact moment they started to
 * read. Square, like everything else in this design.
 */

export function SkeletonLine({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <span className="skeleton block" style={{ width: w, height: h }} />;
}

/** Stands in for one of the bordered stat tiles. */
export function SkeletonTile() {
  return (
    <div className="bg-white dark:bg-[#111118] p-5">
      <SkeletonLine w="60%" h={9} />
      <div className="mt-3">
        <SkeletonLine w="45%" h={20} />
      </div>
    </div>
  );
}

/** A row of tiles in the same gapped grid the real ones use. */
export function SkeletonTiles({ n = 4 }: { n?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
      {Array.from({ length: n }, (_, i) => (
        <SkeletonTile key={i} />
      ))}
    </div>
  );
}

/** A bordered card with a heading and a few lines. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      <SkeletonLine w="35%" h={11} />
      <div className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonLine key={i} w={i === lines - 1 ? "70%" : "100%"} h={10} />
        ))}
      </div>
    </div>
  );
}

/** Repeating rows, for lists and tables. */
export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-5 py-4 border-b border-black/5 dark:border-white/5 last:border-0"
        >
          <SkeletonLine w="28%" h={11} />
          <SkeletonLine w="16%" h={9} />
          <span className="ml-auto block w-[70px]">
            <SkeletonLine w="100%" h={9} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Placeholder rows for inside a Table's tbody.
 *
 * Emits real table rows rather than a block, because a Suspense fallback sitting
 * in a tbody has to be valid there: a div would be hoisted out by the browser's
 * parser and the table would jump when the real rows arrived. Cell widths repeat
 * so the columns do not visibly resize on the swap.
 */
export function SkeletonTableRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ["55%", "30%", "45%", "35%", "50%", "25%", "40%"];
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-black/6 last:border-0 dark:border-white/6">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-3.5 align-top">
              <SkeletonLine w={widths[c % widths.length]} h={10} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
