import type { NextConfig } from "next";

/**
 * Media is hosted in HighLevel and referenced by link, so next/image has to be told
 * which remote host is allowed. Without this, every preview fails with an
 * unconfigured-host error rather than a broken image, which is easy to misdiagnose.
 *
 * The host is read from env so staging and production can differ without a code change.
 */
const hlCdnHost = process.env.NEXT_PUBLIC_HL_CDN_HOST;

/**
 * Response headers, set once for the whole host.
 *
 * Everything here is a browser-side control, which is worth saying plainly
 * because it sets the expectation correctly: none of it stops curl, and none of
 * it is authorization. What it stops is the class of attack that needs a browser
 * to cooperate, plus the indexing accident that turns a private URL into a public
 * one.
 *
 *   X-Robots-Tag        The header form of app/robots.ts, and the one that
 *                       actually travels. A crawler that reached a portal page
 *                       through a link in an email never read robots.txt; it did
 *                       read this response. noarchive and nosnippet matter as
 *                       much as noindex, because a cached copy of a client's
 *                       batch outlives the page being taken down.
 *   frame-ancestors     No embedding, anywhere. The admin is one click away from
 *                       destructive actions and there is no legitimate reason to
 *                       render it inside somebody else's page. X-Frame-Options
 *                       repeats it for anything that predates CSP.
 *   nosniff             Stops a browser deciding an uploaded file is HTML because
 *                       it looks like HTML. Library uploads are signed URLs on
 *                       Supabase's origin, but this host serves JSON that a
 *                       sniffing browser would otherwise be free to reinterpret.
 *   Referrer-Policy     Portal and admin paths carry ids. same-origin means those
 *                       never leave in a Referer header when somebody follows a
 *                       link out to HighLevel or Stripe.
 *   Permissions-Policy  Nothing in this app uses a camera, a microphone, or
 *                       location. Saying so denies them to anything embedded that
 *                       might.
 *   HSTS                Only meaningful over HTTPS, which is why it is scoped to
 *                       production. preload is left off on purpose: it is a
 *                       one-way door on the apex domain and not this file's call.
 *
 * A Content-Security-Policy beyond frame-ancestors is deliberately not here. A
 * real script-src on a Next app needs per-request nonces threaded through the
 * document, and a wrong one breaks the app silently in a browser nobody tested.
 * That is worth doing and it is its own change.
 */
const securityHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  /* Nothing gains from announcing the framework and its major version in a
     header on every response. Removing it does not stop fingerprinting, it
     stops the version being in the answer to a scan that never looked. */
  poweredByHeader: false,

  /* Applied to every path. `headers` runs before the filesystem, so this covers
     pages, route handlers, and anything served out of /public alike. */
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  experimental: {
    /* A server action body is capped at 1MB by default, which a single post
       design exceeds without trying. 8MB matches the ceiling set on the storage
       bucket in migration 0025, so the two refusals cannot disagree: a file that
       gets through here is a file the bucket will accept. */
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: {
    remotePatterns: [
      // HighLevel's asset hosts. filesafe.space is what this account actually
      // serves from, confirmed against the live media library.
      { protocol: "https", hostname: "assets.cdn.filesafe.space" },
      { protocol: "https", hostname: "**.filesafe.space" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "**.leadconnectorhq.com" },
      { protocol: "https", hostname: "**.msgsndr.com" },
      // Anything additional the account actually serves from.
      ...(hlCdnHost ? [{ protocol: "https" as const, hostname: hlCdnHost }] : []),
    ],
  },
};

export default nextConfig;
