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
 * Response headers for the marketing site.
 *
 * Narrower than the console's on purpose, because this host has the opposite
 * job: its pages are meant to be indexed, embedded in link previews, and arrived
 * at from other sites. So there is no X-Robots-Tag here, and the referrer policy
 * is the browser default rather than same-origin, which would break the referral
 * attribution the funnel is measured by.
 *
 * What is still worth setting on a public page:
 *
 *   frame-ancestors     Not "nobody could want this", but "clickjacking a
 *                       checkout form is the reason this header exists". The
 *                       payment element is on this host.
 *   nosniff             Cheap, and correct everywhere.
 *   Permissions-Policy  Nothing here needs a camera or a microphone. The booking
 *                       and chat widgets are third-party iframes and do not
 *                       inherit what is denied to the top document.
 *   HSTS                Production only, and without preload, for the same reason
 *                       as the console.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
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

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      /* API responses are never a search result and never a cached snippet,
         whatever the rest of this host is. */
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet",
          },
        ],
      },
    ];
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
