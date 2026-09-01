"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { createServiceClient } from "@socialx/core/supabase/service";

/**
 * The design on a template version.
 *
 * Four ways in, one column out. Every one of these ends at
 * template_versions.asset_id, so the picker, the URL box and the upload button
 * are three routes to the same place rather than three features.
 *
 * Which provider an asset lands as is decided by how it arrived, and nothing
 * downstream cares: lib/dal/media.ts resolves all three and no component
 * branches on it.
 *
 *   from the library   an assets row that already exists, usually synced from
 *                      HighLevel by pnpm media:sync
 *   by URL             provider 'external', the row is just the link
 *   by upload          provider 'supabase', bytes in the private library bucket
 *
 * Reads and ordinary writes go through the caller's session so the staff_all
 * policy on assets applies. The one exception is the storage upload, which needs
 * the service role because no insert policy is granted on the bucket: a browser
 * never writes there directly, only a server action that has already checked
 * permission.
 */

export type ImageResult = { ok: true; message: string } | { ok: false; error: string };

const MAX_BYTES = 8 * 1024 * 1024;

/* Kept in step with the allowed_mime_types on the bucket in migration 0025. A
   file rejected here would otherwise be rejected by storage with a message
   nobody outside this repo could act on. */
const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
];

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
};

/**
 * Confirms the version exists and belongs to the template the form claims.
 *
 * Both ids come from a form, so neither is trusted. Without the pairing check a
 * caller could point any version id at any template and move another template's
 * artwork, which the permission check alone does not prevent: everyone who can
 * reach this action can legitimately edit some template.
 */
type Target =
  | { ok: false; error: string }
  | { ok: true; templateId: string; versionId: string; currentAssetId: string | null };

async function resolveTarget(formData: FormData): Promise<Target> {
  const templateId = String(formData.get("template_id") ?? "").trim();
  const versionId = String(formData.get("version_id") ?? "").trim();
  if (!templateId || !versionId) return { ok: false, error: "Missing the template version." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("template_versions")
    .select("id, template_id, asset_id")
    .eq("id", versionId)
    .maybeSingle();

  if (!data) return { ok: false, error: "That version no longer exists." };
  if (data.template_id !== templateId) {
    return { ok: false, error: "That version belongs to another template." };
  }
  return {
    ok: true,
    templateId,
    versionId,
    currentAssetId: (data.asset_id as string | null) ?? null,
  };
}

async function attach(versionId: string, assetId: string | null): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("template_versions")
    .update({ asset_id: assetId })
    .eq("id", versionId);
  return error?.message ?? null;
}

/* ---------------- from the existing library ---------------- */

export async function attachLibraryAsset(
  _prev: ImageResult | null,
  formData: FormData
): Promise<ImageResult> {
  await requirePermission("library", "full");

  const target = await resolveTarget(formData);
  if (!target.ok) return { ok: false, error: target.error };

  const assetId = String(formData.get("asset_id") ?? "").trim();
  if (!assetId) return { ok: false, error: "Pick an image first." };

  /* Confirms the asset exists and is a socialX library asset rather than a
     client's. Attaching a client-owned file to a library template would put one
     org's material into every other org's batches. */
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("id, org_id")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) return { ok: false, error: "That image no longer exists." };
  if (asset.org_id) {
    return { ok: false, error: "That file belongs to a client. The library only uses socialX assets." };
  }

  const failed = await attach(target.versionId, assetId);
  if (failed) return { ok: false, error: failed };

  revalidatePath(`/admin/library/${target.templateId}`);
  revalidatePath("/admin/library");
  return { ok: true, message: "Image attached to this version." };
}

/* ---------------- by URL ---------------- */

export async function attachUrlAsset(
  _prev: ImageResult | null,
  formData: FormData
): Promise<ImageResult> {
  const session = await requirePermission("library", "full");

  const target = await resolveTarget(formData);
  if (!target.ok) return { ok: false, error: target.error };

  const raw = String(formData.get("url") ?? "").trim();
  if (!raw) return { ok: false, error: "Paste a link to the image." };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That is not a URL." };
  }
  /* https only. An http image on an https console is blocked as mixed content by
     the browser, so it would store cleanly and then never render. */
  if (url.protocol !== "https:") {
    return { ok: false, error: "The link has to be https, or the browser will refuse to load it." };
  }

  const alt = String(formData.get("alt") ?? "").trim() || null;

  const supabase = await createClient();

  /* Reuse rather than duplicate. The same sample image gets pasted onto several
     templates, and a row each time means the link checker verifies the same URL
     over and over and a broken link has to be fixed in several places. */
  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("url", url.toString())
    .is("org_id", null)
    .maybeSingle();

  let assetId = existing?.id as string | undefined;

  if (!assetId) {
    const { data, error } = await supabase
      .from("assets")
      .insert({
        org_id: null,
        provider: "external",
        url: url.toString(),
        mime: mimeFromName(url.pathname),
        alt,
        created_by: session.userId,
        last_verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "Could not save the link." };
    assetId = data.id as string;
  }

  const failed = await attach(target.versionId, assetId);
  if (failed) return { ok: false, error: failed };

  revalidatePath(`/admin/library/${target.templateId}`);
  revalidatePath("/admin/library");
  return {
    ok: true,
    message: existing
      ? "Linked to an image the library already had."
      : "Image linked. It is somebody else's uptime, so the link checker watches it.",
  };
}

/* ---------------- by upload ---------------- */

export async function uploadAsset(
  _prev: ImageResult | null,
  formData: FormData
): Promise<ImageResult> {
  const session = await requirePermission("library", "full");

  const target = await resolveTarget(formData);
  if (!target.ok) return { ok: false, error: target.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The ceiling is ${MAX_BYTES / 1024 / 1024}MB.`,
    };
  }

  const mime = file.type || mimeFromName(file.name) || "";
  if (!ALLOWED_MIME.includes(mime)) {
    return { ok: false, error: `${mime || "That file type"} is not accepted. Use PNG, JPEG, WebP, AVIF, GIF or MP4.` };
  }

  /* A generated name, not the uploaded one. Two people exporting "post.png" from
     Canva would otherwise collide, and a filename from outside is not something
     to interpolate into a storage path. The original is kept as alt text
     instead, where it is only ever read. */
  const path = `templates/${target.templateId}/${randomUUID()}.${EXTENSIONS[mime] ?? "bin"}`;

  const db = createServiceClient();
  const { error: uploadError } = await db.storage
    .from("library")
    .upload(path, file, { contentType: mime, upsert: false });

  if (uploadError) {
    /* The bucket is created by migration 0025, which skips itself on a database
       with no storage schema and can be refused on a restricted role. Say that,
       rather than surfacing a storage error nobody can act on. */
    const missing = /bucket|not found/i.test(uploadError.message);
    return {
      ok: false,
      error: missing
        ? "The library storage bucket does not exist. Apply migration 0025, or create a private bucket named \"library\" in Supabase. Linking by URL works either way."
        : uploadError.message,
    };
  }

  const supabase = await createClient();
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      org_id: null,
      provider: "supabase",
      bucket: "library",
      path,
      mime,
      bytes: file.size,
      alt: String(formData.get("alt") ?? "").trim() || file.name,
      created_by: session.userId,
      last_verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    /* The row is what makes the object reachable, so an orphaned file is dead
       weight nothing will ever resolve or clean up. Remove it. */
    await db.storage.from("library").remove([path]);
    return { ok: false, error: assetError?.message ?? "Uploaded, but the asset record failed." };
  }

  const failed = await attach(target.versionId, asset.id as string);
  if (failed) return { ok: false, error: failed };

  revalidatePath(`/admin/library/${target.templateId}`);
  revalidatePath("/admin/library");
  return { ok: true, message: `${file.name} uploaded and attached.` };
}

/* ---------------- removal ---------------- */

/**
 * Detaches, and does not delete.
 *
 * The asset row stays because it is very likely on another template too, and
 * because a file synced from HighLevel is a record of something that exists over
 * there whether this template points at it or not. Removing the image from a
 * version is a statement about this version, never about the file.
 */
export async function clearVersionImage(
  _prev: ImageResult | null,
  formData: FormData
): Promise<ImageResult> {
  await requirePermission("library", "full");

  const target = await resolveTarget(formData);
  if (!target.ok) return { ok: false, error: target.error };
  if (!target.currentAssetId) return { ok: false, error: "There is no image on this version." };

  const failed = await attach(target.versionId, null);
  if (failed) return { ok: false, error: failed };

  revalidatePath(`/admin/library/${target.templateId}`);
  revalidatePath("/admin/library");
  return { ok: true, message: "Image removed from this version. The file itself is untouched." };
}

function mimeFromName(nameOrPath: string): string | null {
  const ext = nameOrPath.split("?")[0].split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    mp4: "video/mp4",
  };
  return ext ? map[ext] ?? null : null;
}
