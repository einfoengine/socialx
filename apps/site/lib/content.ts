import "server-only";

import { cache } from "react";
import { createServiceClient } from "@socialx/core/supabase/service";

/**
 * Content the console manages at /admin/website, read by name.
 *
 * How this is secured, spelled out because it is the whole point:
 *
 *   The read runs with the service role, on the server, and `server-only` above
 *   turns any attempt to import this into a client bundle into a build error.
 *   The table itself has no anon policy and no client policy, so a browser
 *   talking to Supabase directly, from this site or anywhere else, gets nothing.
 *   The only path from that table to a visitor is: this function, in a server
 *   component, rendered into HTML.
 *
 * The fallback is mandatory, not a convenience. The marketing site is a live
 * business asset that must keep serving when the portal side is missing a table,
 * a row, or the whole database: same doctrine as isSupabaseConfigured. A page
 * using this renders its built-in default until the console provides something
 * better, and returns to that default if the entry is ever deleted.
 *
 * Freshness: a static page reads this at build time and keeps that value until
 * the next build. For edits in the console to show up on their own, give the
 * page a revalidation window, e.g. `export const revalidate = 300`.
 *
 * React cache() deduplicates within one render pass, so a layout and three
 * components asking for the same key cost one query.
 */
export const getSiteContent = cache(
  async <T>(key: string, fallback: T): Promise<T> => {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from("site_content")
        .select("data")
        .eq("key", key)
        .maybeSingle();

      if (error || !data) return fallback;
      return data.data as T;
    } catch {
      return fallback;
    }
  }
);
