import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/core/supabase/service";
import {
  normalizeHost,
  siteFromRow,
  SITE_COLUMNS,
  type Site,
} from "@/lib/core/sites";

/**
 * Working out whose request this is.
 *
 * Every request that reaches this platform belongs to exactly one site, and
 * there are only three honest ways to know which:
 *
 *   1. An API key. The key belongs to a site, so the answer is definitive and
 *      needs no guessing. This is the only path that works for a server-to-server
 *      caller, and it is the one the API prefers.
 *   2. The Host it arrived on. A request for portal.example.com is a request for
 *      the site that owns that host. This is what makes the hosted portal work.
 *   3. The organization being served. A signed-in client belongs to an org, and
 *      the org was sold by a site.
 *
 * There is deliberately no fourth way, and in particular there is no default
 * site. A request whose site cannot be resolved is a misconfiguration, and the
 * product says so rather than falling back to whichever row happens to be first.
 * A fallback here would quietly serve one customer's brand, content and
 * credentials to another customer's domain, which is the exact failure this
 * whole registry exists to prevent.
 *
 * Everything reads with the service role. These lookups run on paths with no user
 * session at all (an API route authenticating a key, a layout deciding which logo
 * to paint), and the sites tables carry no anon policy for RLS to apply on an
 * anonymous caller's behalf. The scoping that matters is the eq() in each query.
 */

/** Rows this module will hand back for request serving. */
function isServable(site: Site): boolean {
  return site.status === "active";
}

export const siteById = cache(async (id: string): Promise<Site | null> => {
  if (!id) return null;
  try {
    const db = createServiceClient();
    const { data } = await db.from("sites").select(SITE_COLUMNS).eq("id", id).maybeSingle();
    return data ? siteFromRow(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
});

export const siteByKey = cache(async (key: string): Promise<Site | null> => {
  if (!key) return null;
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("sites")
      .select(SITE_COLUMNS)
      .eq("key", key.trim().toLowerCase())
      .maybeSingle();
    return data ? siteFromRow(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
});

/**
 * The site that serves a given host.
 *
 * Two places a host can be registered, and both count. `sites.portal_host` is the
 * one field somebody fills in when they set the portal up. A `site_domains` row
 * with purpose 'portal' is how a site adds a second host later, a vanity domain
 * or a staging one, without losing the first.
 *
 * A domain row must be verified. An unverified row is a claim, not a fact, and
 * serving a brand on an unproven host would let anybody who can point a CNAME at
 * this platform choose whose portal their visitors see.
 */
export const siteByHost = cache(async (rawHost: string): Promise<Site | null> => {
  const host = normalizeHost(rawHost);
  if (!host) return null;

  try {
    const db = createServiceClient();

    const { data: direct } = await db
      .from("sites")
      .select(SITE_COLUMNS)
      .eq("portal_host", host)
      .maybeSingle();
    if (direct) return siteFromRow(direct as Record<string, unknown>);

    /* A domain row stores a full origin, so the same host is matched under both
       schemes rather than guessing which one this deploy is served over. */
    const { data: viaDomain } = await db
      /* cross-site: resolving a host to a site is the question. */
      .from("site_domains")
      .select(`site_id, sites(${SITE_COLUMNS})`)
      .eq("purpose", "portal")
      .not("verified_at", "is", null)
      .in("origin", [`https://${host}`, `http://${host}`])
      .limit(1)
      .maybeSingle();

    const embedded = viaDomain?.sites;
    const row = Array.isArray(embedded) ? embedded[0] : embedded;
    return row ? siteFromRow(row as Record<string, unknown>) : null;
  } catch {
    return null;
  }
});

/**
 * The site that owns a verified browser origin.
 *
 * Used to answer "whose content is this page asking for" when an unauthenticated
 * caller sends no site key of its own, and only ever for verified rows: an
 * unverified origin resolving to a site would let anyone claim a domain and read
 * that site's public content under its name.
 */
export const siteByOrigin = cache(async (origin: string): Promise<Site | null> => {
  if (!origin) return null;
  try {
    const db = createServiceClient();
    const { data } = await db
      /* cross-site: resolving an origin to a site is the question. */
      .from("site_domains")
      .select(`sites(${SITE_COLUMNS})`)
      .eq("origin", origin.toLowerCase())
      .not("verified_at", "is", null)
      .limit(1)
      .maybeSingle();

    const embedded = data?.sites;
    const row = Array.isArray(embedded) ? embedded[0] : embedded;
    return row ? siteFromRow(row as Record<string, unknown>) : null;
  } catch {
    return null;
  }
});

/** The site that sold a given client organization. */
export const siteForOrg = cache(async (orgId: string): Promise<Site | null> => {
  if (!orgId) return null;
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("organizations")
      .select("site_id")
      .eq("id", orgId)
      .maybeSingle();

    const siteId = (data?.site_id as string | null) ?? null;
    return siteId ? await siteById(siteId) : null;
  } catch {
    return null;
  }
});

/**
 * The host this request arrived on.
 *
 * X-Forwarded-Host first, because behind Vercel or any other proxy the Host
 * header is the proxy's own and the forwarded one is what the visitor typed.
 * normalizeHost handles the case where more than one hop appended to it.
 */
export async function requestHost(): Promise<string | null> {
  const list = await headers();
  return normalizeHost(list.get("x-forwarded-host") ?? list.get("host"));
}

/**
 * The site for the current request, by host.
 *
 * Returns null on a host nobody has claimed, which is the correct answer for the
 * platform's own console: /admin is operator software and belongs to no site, so
 * it runs on a host that resolves to nothing and its screens never ask this.
 *
 * A suspended or draft site resolves to null here too. Both states mean "this
 * site is not serving", and a portal that renders a suspended brand's screens
 * has not been suspended.
 */
export const currentSite = cache(async (): Promise<Site | null> => {
  const host = await requestHost();
  if (!host) return null;
  const site = await siteByHost(host);
  return site && isServable(site) ? site : null;
});

/**
 * The site whose brand a signed-in client's portal should wear.
 *
 * Host first, because a client reaching their own site's portal host must see
 * that brand whatever their record says. The org's own site is the fallback for
 * the shared host every site's clients can also sign in on.
 *
 * Mismatch is not an error and must not be. A client of site A who follows an old
 * link to site B's portal host is a routing problem, not an access problem: their
 * data is still scoped by RLS to their own org, and the only thing at stake is
 * which logo is on the page. Preferring the host keeps the page coherent with the
 * address bar.
 */
export const portalSite = cache(async (orgId: string): Promise<Site | null> => {
  const byHost = await currentSite();
  if (byHost) return byHost;

  const byOrg = await siteForOrg(orgId);
  return byOrg && isServable(byOrg) ? byOrg : null;
});

/** Every site, for the console. Includes draft and suspended, which is the point. */
export async function listSites(): Promise<Site[]> {
  try {
    const db = createServiceClient();
    const { data } = await db.from("sites").select(SITE_COLUMNS).order("name");
    return (data ?? []).map((row) => siteFromRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}
