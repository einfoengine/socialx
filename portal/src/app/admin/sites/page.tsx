import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { pageMeta } from "@/lib/page-meta";
import { createClient } from "@/lib/core/supabase/server";
import { siteFromRow, SITE_COLUMNS, wordmarkOf, type Site } from "@/lib/core/sites";
import { PageHead } from "@/components/DataTable";
import { Note, Panel } from "../settings/ui";
import NewSite from "./NewSite";

export const metadata: Metadata = { title: "Sites | Admin" };

export const dynamic = "force-dynamic";

type Counts = { domains: number; verified: number; keys: number; hooks: number; clients: number };

/**
 * Every website integrated with this platform.
 *
 * This screen is the answer to "who is on here", and the numbers next to each
 * name are chosen to answer the follow-up without a click: a site with no
 * verified domain cannot be called from a browser, a site with no key is not
 * integrated yet whatever its status says, and a site with clients is one that
 * cannot simply be deleted.
 *
 * Read through the caller's own session, so the staff_read policy on each table
 * is what admits it. Writes are in actions.ts behind their own check.
 */
export default async function SitesPage() {
  const access = await requirePermission("sites");
  const canWrite = access.permissions.sites === "full";
  const supabase = await createClient();

  const { data, error } = await supabase.from("sites").select(SITE_COLUMNS).order("name");

  /* 42P01 is undefined_table. The screen ships ahead of the migration, so it says
     what to run instead of failing. */
  if (error?.code === "42P01") {
    return (
      <div>
        <PageHead {...pageMeta("/admin/sites")} />
        <div className="max-w-[78ch] border border-amber-500/40 bg-amber-500/10 p-5 text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-white">One-time setup needed.</strong>{" "}
          The sites table does not exist yet. Run{" "}
          <code className="font-mono text-[12.5px]">pnpm db:migrate</code> from the repo
          root to apply migration 0026, then reload.
        </div>
      </div>
    );
  }

  const sites: Site[] = (data ?? []).map((row) => siteFromRow(row as Record<string, unknown>));

  /* Four counts across every site in four queries rather than four per site.
     PostgREST cannot group, so the rows come back and are tallied here; the
     tables are small enough that this is cheaper than the round trips would be. */
  const [domainsRes, keysRes, hooksRes, orgsRes] = await Promise.all([
    /* cross-site: the registry screen. Counting per site is the whole job, so
       these four are the one place a site filter would defeat the purpose. */
    supabase.from("site_domains").select("site_id, verified_at"),
    supabase.from("api_keys").select("site_id, revoked_at"),
    supabase.from("site_webhooks").select("site_id, active"),
    /* cross-site: as above. How many clients each site sold. */
    supabase.from("organizations").select("site_id"),
  ]);

  const counts = new Map<string, Counts>();
  const bump = (id: unknown, field: keyof Counts) => {
    if (typeof id !== "string") return;
    const row = counts.get(id) ?? { domains: 0, verified: 0, keys: 0, hooks: 0, clients: 0 };
    row[field]++;
    counts.set(id, row);
  };

  for (const row of domainsRes.data ?? []) {
    bump(row.site_id, "domains");
    if (row.verified_at) bump(row.site_id, "verified");
  }
  for (const row of keysRes.data ?? []) if (!row.revoked_at) bump(row.site_id, "keys");
  for (const row of hooksRes.data ?? []) if (row.active) bump(row.site_id, "hooks");
  for (const row of orgsRes.data ?? []) bump(row.site_id, "clients");

  return (
    <div>
      <PageHead {...pageMeta("/admin/sites")} />

      {!canWrite && <ViewOnlyNotice />}

      {canWrite && <NewSite />}

      <Panel title={sites.length === 1 ? "1 site" : `${sites.length} sites`}>
        {sites.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            No sites yet. Register the first website above; nothing on this platform
            serves a request until one exists.
          </p>
        ) : (
          <ul className="flex flex-col">
            {sites.map((site) => {
              const c = counts.get(site.id) ?? { domains: 0, verified: 0, keys: 0, hooks: 0, clients: 0 };
              return (
                <li
                  key={site.id}
                  className="border-b border-black/8 py-4 last:border-0 dark:border-white/8"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link
                      href={`/admin/sites/${site.key}`}
                      className="font-grotesk text-[15px] font-semibold text-gray-900 hover:underline dark:text-white"
                    >
                      {wordmarkOf(site)}
                    </Link>
                    <code className="font-mono text-[11.5px] text-gray-400">{site.key}</code>
                    <StatusChip status={site.status} />
                  </div>

                  <p className="mt-1.5 font-mono text-[11.5px] text-gray-500">
                    {site.primaryUrl ?? "no website address"}
                    {site.portalHost ? ` · portal at ${site.portalHost}` : " · no portal host"}
                  </p>

                  <p className="mt-1 text-[12.5px] text-gray-500">
                    {c.verified} of {c.domains} {c.domains === 1 ? "domain" : "domains"} verified
                    {" · "}
                    {c.keys} {c.keys === 1 ? "key" : "keys"}
                    {" · "}
                    {c.hooks} {c.hooks === 1 ? "endpoint" : "endpoints"}
                    {" · "}
                    {c.clients} {c.clients === 1 ? "client" : "clients"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Note>
        A site reaches its own content, its own credentials and its own clients, and
        nothing belonging to another. That boundary is enforced on every API request
        rather than described here: a key resolves to exactly one site before its
        scopes are even considered. What every site does share is the catalogue,
        because they all resell the same service.
      </Note>
    </div>
  );
}

/** Sites has its own read-only line, because the shared one talks about Settings. */
function ViewOnlyNotice() {
  return (
    <div className="mb-6 border border-black/10 bg-black/[0.02] px-5 py-3.5 text-[13px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
      Your role opens Sites but does not change them. Everything below is current;
      the controls are inert.
    </div>
  );
}

function StatusChip({ status }: { status: Site["status"] }) {
  const tone =
    status === "active"
      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      : status === "suspended"
        ? "border-rose-500/40 text-rose-600 dark:text-rose-400"
        : "border-black/15 text-gray-500 dark:border-white/15";

  return (
    <span
      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}
    >
      {status}
    </span>
  );
}
