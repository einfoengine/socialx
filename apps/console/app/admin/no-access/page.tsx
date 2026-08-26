import type { Metadata } from "next";
import Link from "next/link";
import { getStaffAccess } from "@/lib/dal/permissions";
import { SECTIONS } from "@/lib/sections";

export const metadata: Metadata = { title: "No access | socialX Admin" };

/*
 * Where requirePermission sends someone. It sits inside the admin layout on
 * purpose: the rail stays visible, so the reply to "I cannot open this" is the
 * list of things they can open, rather than a dead end.
 */
export default async function AdminNoAccessPage() {
  const access = await getStaffAccess();
  const open = SECTIONS.filter((s) => access.permissions[s.key] !== "none");

  return (
    <div className="max-w-lg">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#3D4AFF] dark:text-[#00A3FF] mb-3">
        Not your section
      </div>
      <h1 className="font-grotesk text-2xl font-semibold text-gray-900 dark:text-white mb-3">
        That screen is not open to {access.staffRole}.
      </h1>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 mb-8">
        Access is set per role under Settings. A staff owner can change it, or give
        you a different role.
      </p>

      {open.length > 0 && (
        <>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 mb-3">
            Open to you
          </div>
          <div className="flex flex-wrap gap-2">
            {open.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                className="border border-black/12 dark:border-white/15 px-3 py-1.5 font-grotesk text-xs text-gray-700 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
