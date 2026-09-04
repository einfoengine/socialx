import "server-only";

import { cache } from "react";
import { platform } from "@/lib/platform";

/**
 * This website's copy, read by name from the platform.
 *
 * What changed, and why it is worth knowing: this used to hold
 * SUPABASE_SERVICE_ROLE_KEY and select from site_content directly. That made a
 * marketing site a co-owner of the platform's database, with a credential that
 * bypassed every row level security policy in the schema, in order to read
 * published copy. It reads it over the API now, with a scoped key that reaches
 * this site's content and nothing else.
 *
 * Which site is answered by the credential rather than by this code. A key names
 * its site exactly; PORTAL_SITE_KEY is the fallback for the unauthenticated read
 * path, and covers only entries somebody deliberately marked public.
 *
 * The fallback is mandatory, not a convenience, and it is the reason every call
 * here goes through contentOr rather than content. A marketing site is a live
 * business asset that must keep serving when the platform is missing a row, is
 * mid-deploy, or is entirely unreachable. Same doctrine as isSupabaseConfigured
 * before it: a page renders its built-in default until the console provides
 * something better, and returns to that default if the entry is ever deleted.
 *
 * Freshness: a static page reads this at build time and keeps that value until
 * the next build. For console edits to appear on their own, give the page a
 * revalidation window, e.g. `export const revalidate = 300`.
 *
 * React cache() deduplicates within one render pass, so a layout and three
 * components asking for the same key cost one request rather than four.
 */
export const getSiteContent = cache(
  async <T>(key: string, fallback: T): Promise<T> => {
    return platform().contentOr<T>(key, fallback);
  }
);
