import "server-only";

/**
 * HighLevel API v2 client.
 *
 * Thin on purpose. Every call goes through one function so the version header,
 * error shape, and auth are in a single place, and so a future move from a private
 * integration token to per-location OAuth (R4) touches one file.
 */

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

export class HighLevelError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "HighLevelError";
  }
}

export function isHighLevelConfigured(): boolean {
  return Boolean(process.env.HL_API_KEY && process.env.HL_MEDIA_LOCATION_ID);
}

export function socialXLocationId(): string {
  const id = process.env.HL_MEDIA_LOCATION_ID;
  if (!id) throw new Error("HL_MEDIA_LOCATION_ID is not set.");
  return id;
}

async function hlFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const key = process.env.HL_API_KEY;
  if (!key) throw new Error("HL_API_KEY is not set.");

  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Version: API_VERSION,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "message" in body
        ? JSON.stringify((body as { message: unknown }).message)
        : res.statusText;
    throw new HighLevelError(`HighLevel ${res.status}: ${detail}`, res.status, body);
  }

  return body as T;
}

export type HLMediaFile = {
  _id?: string;
  id?: string;
  altId?: string;
  name?: string;
  url?: string;
  path?: string;
  parentId?: string;
  size?: number;
};

/**
 * Lists files in a location's media library.
 *
 * The `type` parameter is required and undocumented in the obvious places: omitting
 * it returns 422 with "type must be a string", which reads like an auth problem if
 * you are not expecting it.
 */
export async function listMedia(opts: {
  locationId?: string;
  limit?: number;
  offset?: number;
  query?: string;
}): Promise<HLMediaFile[]> {
  const locationId = opts.locationId ?? socialXLocationId();

  const data = await hlFetch<{ files?: HLMediaFile[]; medias?: HLMediaFile[] }>(
    "/medias/files",
    {
      query: {
        altId: locationId,
        altType: "location",
        type: "file",
        limit: opts.limit ?? 50,
        offset: opts.offset ?? 0,
        query: opts.query,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    }
  );

  return data.files ?? data.medias ?? [];
}

/** Confirms a stored URL still resolves. Used by the link checker. */
export async function urlIsAlive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getLocation(locationId?: string) {
  const id = locationId ?? socialXLocationId();
  return hlFetch<{ location?: { id: string; name: string } }>(`/locations/${id}`);
}
