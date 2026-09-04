import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reading one site's data, and only one site's.
 *
 * Migration 0027 put site_id on every table holding tenant data. This is where
 * that column is actually used, and it exists because the alternative is the
 * filter appearing by hand at every call site, where it is one forgotten line
 * away from an operator looking at two customers' orders in one list.
 *
 * The honest statement of what this is: it is not a security boundary, it is a
 * correctness boundary. Two callers reach these tables without RLS narrowing
 * them to a site, and both are meant to. Staff hold is_staff() and work across
 * every site by design. The API reads with the service role, which has BYPASSRLS
 * and skips every policy in the schema. So for those two paths the site filter
 * can only live in code, and if it lives in code it should live in one place
 * that can be audited rather than in forty that cannot.
 *
 * Client isolation is not this file's job and never was. A client reaches these
 * tables through is_member() on their own organization, in Postgres, and that
 * holds whether or not anything here is called correctly.
 *
 * Usage is the same shape as the client it wraps, so nothing has to be
 * restructured to adopt it:
 *
 *   const { data } = await siteTable(supabase, "batches", site.id)
 *     .select("id, status, due_at")
 *     .order("due_at");
 *
 * A query that genuinely spans sites is legitimate and is not forbidden. It has
 * to say so: mark it with a `cross-site:` comment naming the reason, which is
 * what scripts/check-site-scoping.mjs looks for. The point is not to prevent
 * cross-site reads, it is to make every one of them deliberate.
 */

/**
 * Every table whose rows belong to a site.
 *
 * Eleven reach a site through their organization, four through a parent post or
 * batch, six are the site's own configuration. The guard script reads this
 * list, so a table added here without a site_id column will fail the check
 * rather than quietly pass it.
 */
export const SITE_SCOPED_TABLES = [
  /* Tenant data, site_id derived from the row's organization by trigger. */
  "organizations",
  "activity_log",
  "assets",
  "batches",
  "brand_platforms",
  "brand_profiles",
  "hl_connections",
  "invoices",
  "memberships",
  "posts",
  "subscriptions",
  /* Tenant data one generation further down, site_id derived from the parent. */
  "comments",
  "post_platform_copy",
  "publish_jobs",
  "revisions",
  /* Tenant data whose site_id is written directly rather than derived, because
     the row exists before the organization a trigger would read it from. */
  "orders",
  /* The site's own configuration, site_id written directly. */
  "site_content",
  "api_keys",
  "site_domains",
  "site_webhooks",
  "webhook_deliveries",
  "billing_syncs",
] as const;

export type SiteScopedTable = (typeof SITE_SCOPED_TABLES)[number];

export function isSiteScopedTable(name: string): name is SiteScopedTable {
  return (SITE_SCOPED_TABLES as readonly string[]).includes(name);
}

/**
 * A query builder for one table, already narrowed to one site.
 *
 * The filter is applied after select() rather than before, because PostgREST
 * builds a filter onto a selection and there is nothing to attach it to until
 * the selection exists. Everything the underlying builder can do afterwards
 * still works: order, range, further eq, maybeSingle.
 *
 * Typed loosely on purpose. The project has no generated database types yet, so
 * a precise signature here would be an invented one, and inventing it would put
 * a second, drifting description of the schema next to the migrations.
 */
export function siteTable(
  db: SupabaseClient,
  table: SiteScopedTable,
  siteId: string
) {
  return {
    select(columns = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
      return db.from(table).select(columns, options).eq("site_id", siteId);
    },
  };
}

/**
 * Narrows an already-built query to whatever the console is currently showing.
 *
 * Takes null to mean "the rows belonging to no site", which is not the same as
 * "no filter". That distinction is the whole reason this exists rather than an
 * inline `if`: deleting a site leaves its clients with site_id null, and a
 * caller that treated null as "unfiltered" would answer the Unassigned view with
 * every site's data.
 */
export function applySiteFilter<T>(query: T, siteId: string | null): T {
  /*
   * Cast rather than constrained.
   *
   * The natural signature is `T extends { eq(...): T; is(...): T }`, and TypeScript
   * refuses it: PostgREST's builder is generic over the row shape and the embedded
   * resources of the select that produced it, so resolving that constraint against
   * a query with three levels of embeds hits "type instantiation is excessively
   * deep". The cast keeps the caller's exact builder type flowing through, which is
   * what matters here, since order() and range() are called on the result.
   */
  const q = query as unknown as {
    eq(column: string, value: string): T;
    is(column: string, value: null): T;
  };
  return siteId === null ? q.is("site_id", null) : q.eq("site_id", siteId);
}

/**
 * The same narrowing for a query that is already built.
 *
 * For the cases siteTable cannot express, chiefly a select with an embedded
 * resource whose shape the caller assembles itself. Takes the query rather than
 * the table, so the filter is still applied by this module and still greps as
 * scoped.
 */
export function onlySite<T>(query: T, siteId: string): T {
  return (query as unknown as { eq(c: string, v: string): T }).eq("site_id", siteId);
}
