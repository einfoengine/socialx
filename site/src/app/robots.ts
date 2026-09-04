import type { MetadataRoute } from "next";

/**
 * The marketing site wants to be found. The rest of it does not.
 *
 * This is the opposite posture to the console, and the difference is the point:
 * a landing page that is not indexed has failed at its job, so the default here
 * is allow, and the exceptions are named.
 *
 * What is excluded, and why each one:
 *
 *   /api/       Endpoints, not pages. A crawler following one would create Stripe
 *               customers and spend coupon-check budget on nothing.
 *   /checkout   A buyer's funnel, already noindex in its own metadata. Indexed, it
 *               competes with the pricing section for the same search and sends
 *               people into a form before they have read the offer.
 *   /welcome    Post-purchase. Only ever reached with an order behind it.
 *   /onbording  An embedded HighLevel survey. Nothing on it renders for a crawler
 *               and the spelling is load bearing: that is the real route.
 *
 * `host` and `sitemap` are left out deliberately. There is no sitemap route to
 * point at, and a sitemap line naming a file that 404s is worse than no line at
 * all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/checkout", "/welcome", "/onbording"],
    },
  };
}
