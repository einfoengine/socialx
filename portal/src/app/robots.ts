import type { MetadataRoute } from "next";

/**
 * Nothing here is for a crawler.
 *
 * The console is signed-in software end to end: an admin that operates the
 * platform, a portal that shows one client their own work, a login screen, and an
 * API that authenticates by key. There is no page on this host that belongs in a
 * search result, so the rule is the whole host rather than a list of paths, and
 * the list cannot then fall out of date when a route is added.
 *
 * Worth being exact about what this buys, because robots.txt is routinely
 * mistaken for a control. It is a request, honoured by search engines and
 * ignored by anything that does not want to honour it. What it actually prevents
 * is the failure that happens by accident and is very hard to undo: a portal URL
 * shared in an email, followed by a crawler, indexed, and then a client's batch
 * showing up in somebody's search results. The pages also carry
 * `robots: { index: false }` in their metadata and the whole host carries an
 * X-Robots-Tag header from next.config.ts, which is the belt to this file's
 * braces: a crawler that never reads robots.txt still sees the header on the
 * response it fetched.
 *
 * A scraper that ignores all three is what rate limiting and authorization are
 * for. This file is not addressed to it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
