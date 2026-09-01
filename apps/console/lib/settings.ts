import "server-only";

import { cache } from "react";
import { createServiceClient } from "@socialx/core/supabase/service";

/**
 * What is configurable, declared once.
 *
 * The database stores values; this file states which keys exist, what type each
 * holds, and what the app does when the row is missing. That ordering matters.
 * A setting read straight out of a table has no defined behaviour on an empty
 * database, a fresh clone, or a preview deploy, so every read here resolves
 * against a fallback and the fallback is the shipped default rather than a
 * placeholder. Deleting a row returns the app to it.
 *
 * Adding a setting is one entry in DEFINITIONS. The General screen renders
 * itself from this list, the save action validates against it, and nothing else
 * needs to know.
 */

export type SettingKind = "string" | "number" | "boolean" | "origins";

export type SettingDef = {
  key: string;
  label: string;
  help: string;
  kind: SettingKind;
  group: string;
  /** Used when no row exists, and when a stored value fails validation. */
  fallback: unknown;
};

export const DEFINITIONS: SettingDef[] = [
  {
    key: "brand.name",
    label: "Brand name",
    help: "How the product names itself in transactional copy. Casing is load bearing: socialX, never SocialX.",
    kind: "string",
    group: "Brand",
    fallback: "socialX",
  },
  {
    key: "support.email",
    label: "Support address",
    help: "Where a client is told to write. Printed in the portal and in emails.",
    kind: "string",
    group: "Brand",
    fallback: "hi@socialx.studio",
  },
  {
    key: "support.reply_hours",
    label: "Reply window, hours",
    help: "The response time the portal promises. Say a number the team actually hits.",
    kind: "number",
    group: "Brand",
    fallback: 24,
  },
  {
    key: "checkout.url",
    label: "Checkout origin",
    help: "Where a buyer is sent to subscribe. Changing this repoints every pricing link at once.",
    kind: "string",
    group: "Brand",
    fallback: "https://order.socialx.studio",
  },
  {
    key: "api.public_enabled",
    label: "Public API enabled",
    help: "The master switch for unauthenticated reads. Off means every /api/v1 call needs a key, whatever is marked public.",
    kind: "boolean",
    group: "API",
    fallback: true,
  },
  {
    key: "api.public_origins",
    label: "Public API origins",
    help: "Browser origins allowed to call the public API. Leave empty to allow any origin, which is the usual choice for content that is already public.",
    kind: "origins",
    group: "API",
    fallback: [],
  },
];

export const DEFINITION_BY_KEY = new Map(DEFINITIONS.map((d) => [d.key, d]));

export type SettingsMap = Record<string, unknown>;

/**
 * An origin as the platform writes it: scheme and host, no path, no trailing
 * slash. That is exactly the shape of a browser's Origin header, and comparing
 * anything else against it is guesswork.
 *
 * Wildcards are refused, and that refusal is the reason this function exists
 * rather than a bare `new URL()`. URL happily parses "*" into the origin
 * "https://*", which is not an error and not a pattern either: it is a literal
 * hostname that no browser will ever send. Somebody typing * to mean "allow
 * everything" would have stored a value that silently matches nothing and
 * locked out every origin while appearing to open all of them. Returning null
 * turns that into a message on the form instead.
 */
export function normalizeOrigin(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.includes("*")) return null;
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    /* No credentials and no path survive into a stored origin, because an
       Origin header carries neither and a stored value that carries them can
       never match one. */
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Coerces a stored value to the declared type, or returns null to fall back. */
export function coerce(def: SettingDef, value: unknown): unknown | null {
  switch (def.kind) {
    case "string":
      return typeof value === "string" ? value : null;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    case "boolean":
      return typeof value === "boolean" ? value : null;
    case "origins": {
      if (!Array.isArray(value)) return null;
      const out: string[] = [];
      for (const item of value) {
        if (typeof item !== "string") continue;
        const origin = normalizeOrigin(item);
        if (origin && !out.includes(origin)) out.push(origin);
      }
      return out;
    }
  }
}

/**
 * Every setting, resolved.
 *
 * Reads with the service role because route handlers on the API path have no
 * user session at all and still need the public-API switch. A failure of any
 * kind, including the table not existing yet, resolves to the declared defaults
 * rather than throwing: configuration going missing must not take the product
 * down, only return it to how it shipped.
 *
 * cache() deduplicates within a render pass, so a layout and three components
 * asking cost one query.
 */
export const readSettings = cache(async (): Promise<SettingsMap> => {
  const resolved: SettingsMap = Object.fromEntries(
    DEFINITIONS.map((d) => [d.key, d.fallback])
  );

  try {
    const db = createServiceClient();
    const { data, error } = await db.from("app_settings").select("key, value");
    if (error || !data) return resolved;

    for (const row of data) {
      const def = DEFINITION_BY_KEY.get(row.key as string);
      if (!def) continue;
      const value = coerce(def, row.value);
      if (value !== null) resolved[def.key] = value;
    }
  } catch {
    /* No database reachable. The defaults above are the answer. */
  }

  return resolved;
});

export async function readSetting<T>(key: string): Promise<T> {
  const all = await readSettings();
  return all[key] as T;
}
