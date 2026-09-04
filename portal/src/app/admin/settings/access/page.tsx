import Link from "next/link";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission, readMatrix } from "@/lib/dal/permissions";
import PermissionsMatrix from "./PermissionsMatrix";
import { Note, SectionHead } from "../ui";

/* The matrix is read on every admin render, so a cached copy here would show
   access that is no longer real. */
export const dynamic = "force-dynamic";

/**
 * Access.
 *
 * The one screen in Settings that was already editable, and the one with a
 * second lock on it: staff_permissions carries an owner-only RLS policy, so a
 * role holding Settings at full still cannot change who reaches what unless it
 * is the owner role. That is not belt and braces, it is the recovery path. Any
 * role that could widen its own access could grant itself everything.
 */
export default async function AccessPage() {
  const access = await requirePermission("settings");
  const matrix = await readMatrix();
  const canWrite = access.permissions.settings === "full" && access.realRole === "owner";

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings/access")} />

      {!canWrite && (
        <div className="mb-6 border border-black/10 bg-black/[0.02] px-5 py-3.5 text-[13px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
          Only a staff owner changes access. You can read the matrix; saving it
          will be refused by the database whatever this page renders.
        </div>
      )}

      <PermissionsMatrix initial={matrix} canWrite={canWrite} />

      <Note>
        Assign roles to people on{" "}
        <Link href="/admin/people" className="text-[#2B50DC] dark:text-[#5B8DEF]">
          People
        </Link>
        . A change applies on their next page load, not on their next sign-in.
      </Note>
    </div>
  );
}
