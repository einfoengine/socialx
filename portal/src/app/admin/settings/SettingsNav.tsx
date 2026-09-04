"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SETTINGS_NAV, settingsItemForPath } from "./nav";

/**
 * The rail inside Settings.
 *
 * A second level of navigation earns its place here because Settings holds seven
 * unrelated jobs and the alternative shapes are both worse. Tabs would run off
 * the edge and give no room for the one line of explanation that stops somebody
 * opening three pages to find the right one. One long scrolling page would put
 * API credentials and the pillar mix in the same breath.
 *
 * On mobile it collapses to a disclosure showing where you are, because a
 * sidebar beside a sidebar is not a thing a phone has room for. The desktop rail
 * has no collapse: it is seven rows, and hiding them saves nothing.
 */
export default function SettingsNav() {
  const pathname = usePathname();
  const current = settingsItemForPath(pathname);
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label="Settings sections">
      {/* Mobile: say where you are, open to move. */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between border border-black/12 bg-white px-3 py-2.5 text-left transition-colors hover:border-[#2B50DC]/50 dark:border-white/15 dark:bg-[#111118]"
        >
          <span className="min-w-0 truncate font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white">
            {current?.label ?? "Settings"}
          </span>
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={`shrink-0 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
      </div>

      <div className={`${open ? "block" : "hidden"} md:block`}>
        {SETTINGS_NAV.map((group) => (
          <div key={group.title} className="mb-5 last:mb-0">
            <p className="px-3 pb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = current?.href === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`block border-l-2 px-3 py-2 text-[13px] no-underline transition-colors ${
                        active
                          ? "border-[#2B50DC] bg-[#2B50DC]/8 font-semibold text-[#2B50DC] dark:border-[#5B8DEF] dark:text-[#5B8DEF]"
                          : "border-transparent text-gray-600 hover:bg-black/4 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
