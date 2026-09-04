import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { PageHead } from "@/components/DataTable";
import { adminSiteContext } from "@/lib/sites/admin";
import WebsiteView, { type Entry } from "./WebsiteView";

export const metadata: Metadata = { title: "Website | Admin" };

export const dynamic = "force-dynamic";

/**
 * Named JSON a website renders. The list is read through the caller's own
 * session, so the staff_read RLS policy is what admits it; writes happen in
 * actions.ts with the service role after their own permission check.
 *
 * Scoped to one site, always. Content keys are unique per site rather than
 * globally, so two websites can each have a "hero"; a list that merged them would
 * show the same key twice with no way to tell which row belongs to whom, and
 * editing the wrong one would silently change somebody else's homepage.
 */
export default async function WebsitePage() {
  const access = await requirePermission("website");
  const { site, showingUnassigned } = await adminSiteContext();
  const supabase = await createClient();

  const { data, error } = site
    ? await supabase
        .from("site_content")
        .select("key, data, description, updated_at, profiles(email)")
        .eq("site_id", site.id)
        .order("key")
    : { data: [], error: null };

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
      ) : !site ? (
        <NoSite unassigned={showingUnassigned} />
      ) : (
        <WebsiteView
          siteId={site.id}
          entries={entries}
          canWrite={access.permissions.website === "full"}
        />
      )}
    </div>
  );
}

/**
 * What this screen shows when it has no site to show.
 *
 * Both cases land here and they are genuinely different, so they say different
 * things. Content belongs to a site by its primary key, so the Unassigned view
 * has nothing to list and never will; that is a fact about the schema rather
 * than an empty table.
 */
function NoSite({ unassigned }: { unassigned: boolean }) {
  return (
    <div className="max-w-[78ch] border border-black/10 bg-black/[0.02] p-5 text-[13.5px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
      {unassigned ? (
        <>
          Content always belongs to a site, so there is nothing to show while you
          are looking at clients whose site was deleted. Pick a site in the top bar.
        </>
      ) : (
        <>
          No sites are registered yet, and content belongs to one. Register a
          website under Sites first.
        </>
      )}
    </div>
  );
}
