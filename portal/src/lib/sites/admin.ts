import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/core/supabase/server";
import { siteFromRow, SITE_COLUMNS, type Site } from "@/lib/core/sites";

/**
 * Which site an operator is currently looking at.
 *
 * The console is the one place that is not scoped to a site by the request
 * itself. Staff work across every site, so /admin runs on the platform's own host
 * and resolves nothing from it; every screen showing tenant data therefore needs
 * somebody to say which site, and that somebody is the person using it.
 *
 * A cookie rather than a path segment, because the alternative is a segment on
 * every admin URL including the screens that are not site-scoped at all, and a
 * segment those screens would have to carry and ignore. The cookie is read once
 * per request, in the layout and in whichever page needs it, and cache() makes
 * that one query.
 *
 * There is deliberately no "all sites" option. A list merging two customers'
 * orders is a screen where clicking the wrong row is an ordinary mistake rather
 * than an impossible one, and every genuinely cross-site query in the codebase
 * is marked as such and lives outside this mechanism.
 */

export const ADMIN_SITE_COOKIE = "sx-admin-site";

/**
 * The one value in that cookie that is not a site key.
 *
 * organizations.site_id is `on delete set null`, so deleting a site keeps the
 * records of the clients it sold. Without somewhere to stand, those clients
 * would be preserved and simultaneously unreachable, which is the worst of both
 * choices. This is that somewhere.
 */
export const UNASSIGNED_SITE = "__unassigned";

export type AdminSiteContext = {
  /** The site being viewed. Null when none exists, or while viewing Unassigned. */
  site: Site | null;
  /** Every site, for the switcher. */
  sites: Site[];
  /** True when the operator is looking at clients whose site is gone. */
  showingUnassigned: boolean;
  /** How many such clients there are. Zero on a healthy installation. */
  unassigned: number;
  /**
   * True when the cookie named a site that no longer resolves, so the context
   * fell back. Worth surfacing: silently showing a different site's data than the
   * one somebody selected last week is the failure this flag prevents.
   */
  fellBack: boolean;
  /**
   * The value every site-scoped query filters on: a site id, or null meaning
   * "the rows belonging to no site". Read this rather than `site.id`, so the
   * Unassigned view is handled by the same call as every other.
   */
  filterId: string | null;
};

export const adminSiteContext = cache(async (): Promise<AdminSiteContext> => {
  const [sites, unassigned] = await Promise.all([listSitesForStaff(), countUnassigned()]);

  const empty = {
    site: null,
    sites,
    showingUnassigned: false,
    unassigned,
    fellBack: false,
    filterId: null,
  };
  if (sites.length === 0) return empty;

  const jar = await cookies();
  const chosen = jar.get(ADMIN_SITE_COOKIE)?.value ?? "";

  if (chosen === UNASSIGNED_SITE && unassigned > 0) {
    return { ...empty, showingUnassigned: true };
  }

  const fallback = (fellBack: boolean): AdminSiteContext => ({
    site: sites[0],
    sites,
    showingUnassigned: false,
    unassigned,
    fellBack,
    filterId: sites[0].id,
  });

  if (!chosen || chosen === UNASSIGNED_SITE) return fallback(false);

  const site = sites.find((candidate) => candidate.key === chosen) ?? null;
  return site
    ? { site, sites, showingUnassigned: false, unassigned, fellBack: false, filterId: site.id }
    : fallback(true);
});

/**
 * Every site, read through the caller's own session.
 *
 * Not lib/sites/resolve.ts, which reads with the service role because it runs on
 * request paths that have no session to read with. This one always has one: it is
 * only ever called from a staff screen, so the staff_read policy on sites is what
 * admits it and RLS is doing real work rather than being bypassed for
 * convenience.
 */
export async function listSitesForStaff(): Promise<Site[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("sites").select(SITE_COLUMNS).order("name");
    return (data ?? []).map((row) => siteFromRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

/** Clients left behind by a deleted site. Almost always zero, and worth knowing when not. */
async function countUnassigned(): Promise<number> {
  try {
    const supabase = await createClient();
    /* cross-site: counting the rows that belong to no site is the one question
       that cannot be asked from inside a site. */
    const { count } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .is("site_id", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}
