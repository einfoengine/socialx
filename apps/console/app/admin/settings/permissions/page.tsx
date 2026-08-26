import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, readMatrix } from "@/lib/dal/permissions";
import { PageHead } from "@/components/DataTable";
import PermissionsMatrix from "./PermissionsMatrix";

export const metadata: Metadata = { title: "Access | socialX Admin" };

/* The matrix is read per render on every admin page, so a stale copy here would
   show access that is no longer real. */
export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  await requirePermission("settings", "full");
  const matrix = await readMatrix();

  return (
    <div>
      <PageHead
        title="Access"
        sub="What each staff role can reach. Roles are assigned per person on People; this is what a role means."
      />
      <PermissionsMatrix initial={matrix} />
      <p className="mt-8 text-[12.5px] text-gray-500 dark:text-gray-500">
        Assign roles to people on{" "}
        <Link href="/admin/people" className="text-[#3D4AFF] dark:text-[#00A3FF]">
          People
        </Link>
        .
      </p>
    </div>
  );
}
