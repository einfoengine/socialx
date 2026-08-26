import "server-only";

import { listMedia, socialXLocationId, type HLMediaFile } from "./client";
import { createServiceClient } from "@socialx/core/supabase/service";

/**
 * Imports HighLevel media into the assets table.
 *
 * socialX stores links, not bytes. This walks the HighLevel media library and
 * records what is there so the batch builder can pick from it without hitting the
 * HighLevel API on every render, and so a file that later disappears is detectable
 * rather than a silently broken preview.
 */
export async function syncHighLevelMedia(opts: { limit?: number } = {}) {
  const db = createServiceClient();
  const locationId = socialXLocationId();
  const files = await listMedia({ locationId, limit: opts.limit ?? 100 });

  let imported = 0;
  let seen = 0;

  for (const f of files) {
    const fileId = f._id ?? f.id;
    const url = f.url;
    if (!fileId || !url) continue;
    seen++;

    const { data: existing } = await db
      .from("assets")
      .select("id")
      .eq("hl_file_id", fileId)
      .maybeSingle();

    if (existing) continue;

    const { error } = await db.from("assets").insert({
      org_id: null, // library asset, owned by socialX
      provider: "highlevel",
      url,
      hl_location_id: locationId,
      hl_file_id: fileId,
      mime: guessMime(f.name ?? url),
      bytes: f.size ?? null,
      alt: f.name ?? null,
      last_verified_at: new Date().toISOString(),
    });

    if (!error) imported++;
  }

  return { seen, imported };
}

function guessMime(nameOrUrl: string): string | null {
  const ext = nameOrUrl.split("?")[0].split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mov: "video/quicktime",
    pdf: "application/pdf",
  };
  return ext ? map[ext] ?? null : null;
}

export type { HLMediaFile };
