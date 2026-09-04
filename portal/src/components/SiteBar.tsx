import Link from "next/link";
import type { Site } from "@/lib/core/sites";
import { selectSiteAction } from "@/app/admin/sites/actions";
import { UNASSIGNED_SITE } from "@/lib/sites/admin";

/**
 * Which site the console is looking at, in the top bar.
 *
 * It lives in the chrome rather than on each screen because it now governs every
 * screen. A control that appeared on eight pages and was absent on the ninth
 * would leave an operator guessing whether the ninth was unscoped or just did
 * not say, and the answer to that has to be visible without thinking.
 *
 * There is no "all sites" option, which is a deliberate constraint rather than a
 * missing feature. Two customers' orders in one list is a screen where clicking
 * the wrong row is an ordinary mistake instead of an impossible one.
 *
 * A <details> element rather than a scripted dropdown, so this stays a server
 * component and works before hydration and without JavaScript. The site list is
 * short by nature.
 */
export default function SiteBar({
  sites,
  current,
  unassigned,
  showingUnassigned,
  fellBack,
}: {
  sites: Site[];
  current: Site | null;
  /** Clients whose site was deleted. Zero on a healthy installation. */
  unassigned: number;
  showingUnassigned: boolean;
  fellBack: boolean;
}) {
  if (sites.length === 0) {
    return (
      <Link
        href="/admin/sites"
        className="border border-amber-500/45 px-2.5 py-1 font-grotesk text-[12px] font-semibold text-amber-600 dark:text-amber-400"
      >
        No sites yet
      </Link>
    );
  }

  const label = showingUnassigned ? "Unassigned" : (current?.name ?? sites[0].name);

  /* One site and nothing stranded is the common case, and it needs no control:
     there is nothing to switch to, and a menu offering one option is furniture. */
  if (sites.length === 1 && unassigned === 0) {
    return (
      <span
        className="hidden truncate font-grotesk text-[12px] font-semibold text-gray-500 sm:inline dark:text-gray-400"
        title={`Showing ${label}`}
      >
        {label}
      </span>
    );
  }

  return (
    <details className="relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 border px-2.5 py-1 font-grotesk text-[12px] font-semibold transition-colors ${
          fellBack || showingUnassigned
            ? "border-amber-500/45 text-amber-600 dark:text-amber-400"
            : "border-black/15 text-gray-700 hover:bg-black/[0.04] dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/[0.06]"
        }`}
      >
        <span className="max-w-[16ch] truncate">{label}</span>
        <span aria-hidden="true" className="text-[9px] text-gray-400">
          ▼
        </span>
      </summary>

      <div className="absolute right-0 z-50 mt-1.5 min-w-[220px] border border-black/12 bg-white p-1.5 shadow-lg dark:border-white/12 dark:bg-[#14141C]">
        <p className="px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-400">
          Showing one site
        </p>

        <form action={selectSiteAction} className="flex flex-col">
          {sites.map((site) => {
            const active = !showingUnassigned && site.key === current?.key;
            return (
              <button
                key={site.key}
                type="submit"
                name="key"
                value={site.key}
                aria-current={active ? "true" : undefined}
                className={`cursor-pointer border-0 px-2 py-1.5 text-left font-grotesk text-[13px] transition-colors ${
                  active
                    ? "bg-[#3D4AFF]/10 font-semibold text-[#3D4AFF] dark:text-[#7C86FF]"
                    : "bg-transparent text-gray-700 hover:bg-black/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                }`}
              >
                {site.name}
                {site.status !== "active" && (
                  <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400">
                    {site.status}
                  </span>
                )}
              </button>
            );
          })}

          {/*
            Clients whose site was deleted. organizations.site_id is set null
            rather than cascading, so their records survive; without somewhere to
            stand they would survive and be unreachable, which is worse than
            either deleting them or keeping them visible.
          */}
          {unassigned > 0 && (
            <button
              type="submit"
              name="key"
              value={UNASSIGNED_SITE}
              className={`mt-1 cursor-pointer border-0 border-t border-black/8 px-2 py-1.5 text-left font-grotesk text-[13px] transition-colors dark:border-white/8 ${
                showingUnassigned
                  ? "bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                  : "bg-transparent text-gray-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              Unassigned
              <span className="ml-2 font-mono text-[9.5px] text-gray-400">{unassigned}</span>
            </button>
          )}
        </form>

        {fellBack && (
          <p className="border-t border-black/8 px-2 py-1.5 text-[11.5px] leading-snug text-amber-600 dark:border-white/8 dark:text-amber-400">
            The site you had selected is gone. Showing {label}.
          </p>
        )}
      </div>
    </details>
  );
}
