import type { NextConfig } from "next";

/**
 * Media is hosted in HighLevel and referenced by link, so next/image has to be told
 * which remote host is allowed. Without this, every preview fails with an
 * unconfigured-host error rather than a broken image, which is easy to misdiagnose.
 *
 * The host is read from env so staging and production can differ without a code change.
 */
const hlCdnHost = process.env.NEXT_PUBLIC_HL_CDN_HOST;

const nextConfig: NextConfig = {
  /* The workspace packages ship TypeScript source rather than a build step, so
     Next has to compile them the same way it compiles this app's own files. */
  transpilePackages: ["@socialx/core", "@socialx/ui"],
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
