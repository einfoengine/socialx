import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead } from "@/components/DataTable";
import WebsiteView, { type Entry } from "./WebsiteView";

export const metadata: Metadata = { title: "Website | socialX Admin" };

export const dynamic = "force-dynamic";

/**
 * Named JSON the marketing site renders. The list is read through the caller's
 * own session, so the staff_read RLS policy is what admits it; writes happen in
 * actions.ts with the service role after their own permission check.
 */
export default async function WebsitePage() {
  const access = await requirePermission("website");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_content")
    .select("key, data, description, updated_at, profiles(email)")
    .order("key");

  /* 42P01 is undefined_table: the migration has not been applied yet. Say so
     instead of crashing, because the screen ships ahead of the schema. */
  const migrationMissing = error?.code === "42P01";

  const entries: Entry[] = (data ?? []).map((r) => ({
    key: r.key as string,
    description: (r.description as string | null) ?? "",
    json: JSON.stringify(r.data, null, 2),
    updatedAt: (r.updated_at as string).slice(0, 16).replace("T", " "),
    updatedBy:
      (r.profiles as unknown as { email?: string } | null)?.email ?? "-",
  }));

  return (
    <div>
      <PageHead {...pageMeta("/admin/website")} />
      {migrationMissing ? (
        <div className="max-w-[78ch] border border-amber-500/40 bg-amber-500/10 p-5 text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-white">One-time setup needed.</strong>{" "}
          The site_content table does not exist in the database yet. Run{" "}
          <code className="font-mono text-[12.5px]">pnpm db:migrate</code> from the repo
          root to apply migration 0023, then reload this page.
        </div>
      ) : (
        <WebsiteView entries={entries} canWrite={access.permissions.website === "full"} />
      )}
    </div>
  );
}
