"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Daily build log", href: "/admin/journal/build-log" },
  { label: "Locked decisions", href: "/admin/journal/decisions" },
  { label: "Ideas", href: "/admin/journal/ideas" },
];

export default function JournalTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-black/10 dark:border-white/10">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`px-4 py-3 font-grotesk text-[13.5px] font-medium no-underline border-b-2 -mb-px transition-colors ${
              active
                ? "border-[#2B50DC] text-[#2B50DC] dark:border-[#5B8DEF] dark:text-[#5B8DEF]"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
