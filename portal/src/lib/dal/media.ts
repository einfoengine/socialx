import "server-only";

import { createClient } from "@/lib/core/supabase/server";
import type { Asset, MediaProvider } from "@/lib/core/types/db";

/**
 * Media resolution for the hybrid storage model.
 *
 * HighLevel hosts the files and socialX stores the links, because the template
 * library plus per-client brand editing produces far more images than belong in
 * Supabase Storage. Supabase stays available as a second provider for quick adds.
 *
 * Everything downstream references an asset id and calls resolveAssetUrl. No
 * component branches on provider, so moving an asset between providers later is a
 * change to this file rather than to every call site.
 */

/** How long a Supabase signed URL stays valid. Long enough to render, short enough to not be a share link. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type ResolvedAsset = {
  id: string;
  url: string;
  provider: MediaProvider;
  alt: string | null;
  width: number | null;
  height: number | null;
  /** True when the link checker has flagged this as unreachable. Show a placeholder, not a broken image. */
  isBroken: boolean;
};

export async function resolveAssetUrl(asset: Asset): Promise<ResolvedAsset> {
  const base = {
    id: asset.id,
    provider: asset.provider,
    alt: asset.alt,
    width: asset.width,
    height: asset.height,
    isBroken: asset.is_broken,
  };

  if (asset.provider === "highlevel" || asset.provider === "external") {
    // Both are plain public URLs, rendered as they are. HighLevel links are only
    // as durable as the file behind them, which is what the nightly link checker
    // and `is_broken` exist to catch. External links are somebody else's uptime.
    return { ...base, url: asset.url ?? "" };
  }

  if (!asset.bucket || !asset.path) {
    return { ...base, url: "", isBroken: true };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(asset.bucket)
    .createSignedUrl(asset.path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return { ...base, url: "", isBroken: true };
  }

  return { ...base, url: data.signedUrl };
}

/**
 * Batch version. Supabase signing is a network call per object, so resolving a
 * calendar of 24 posts one at a time would be 24 round trips. HighLevel assets cost
 * nothing to resolve, so in the common case this does no I/O at all.
 */
export async function resolveAssetUrls(assets: Asset[]): Promise<Map<string, ResolvedAsset>> {
  const out = new Map<string, ResolvedAsset>();

  const supabaseAssets = assets.filter((a) => a.provider === "supabase");
  const hlAssets = assets.filter((a) => a.provider !== "supabase");

  for (const a of hlAssets) {
    out.set(a.id, {
      id: a.id,
      provider: a.provider,
      url: a.url ?? "",
      alt: a.alt,
      width: a.width,
      height: a.height,
      isBroken: a.is_broken || !a.url,
    });
  }

  if (supabaseAssets.length > 0) {
    const supabase = await createClient();

    // Group by bucket; createSignedUrls signs many paths in one call per bucket.
    const byBucket = new Map<string, Asset[]>();
    for (const a of supabaseAssets) {
      if (!a.bucket || !a.path) continue;
      const list = byBucket.get(a.bucket) ?? [];
      list.push(a);
      byBucket.set(a.bucket, list);
    }

    for (const [bucket, group] of byBucket) {
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrls(group.map((a) => a.path!), SIGNED_URL_TTL_SECONDS);

      const signed = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));

      for (const a of group) {
        const url = signed.get(a.path!) ?? "";
        out.set(a.id, {
          id: a.id,
          provider: a.provider,
          url,
          alt: a.alt,
          width: a.width,
          height: a.height,
          isBroken: a.is_broken || !url,
        });
      }
    }
  }

  return out;
}

/**
 * Which HighLevel location should hold a given file.
 *
 * Anything socialX produces lives in socialX's own location. Only client-supplied
 * material lives in the client's. This matters: if socialX's creative sat in the
 * client's location, a churned client revoking access would break every preview in
 * their own delivery history.
 */
export function targetLocationFor(kind: "library" | "client_creative" | "client_upload"): "socialx" | "client" {
  return kind === "client_upload" ? "client" : "socialx";
}
