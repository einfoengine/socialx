/**
 * What a site is, in one place both applications agree on.
 *
 * A site is a website integrated with this platform. Everything an integrator
 * configures lives on this record, and everything the platform renders on their
 * behalf reads it. The rule that keeps the product brand-free is narrow and worth
 * stating: no code anywhere may name a site. Not by key, not by domain, not as a
 * default. Code that needs a brand takes a Site; code that cannot resolve one
 * renders the neutral fallbacks below and says so.
 *
 * Deliberately not server-only. The type and the brand parsing are needed by
 * client components rendering a skin, and nothing here reads a secret or touches
 * a database.
 */

import { isBillingSource, type BillingSource } from "./payments";

export type SiteStatus = "draft" | "active" | "suspended";

/**
 * The visual skin.
 *
 * Every field optional, and the reason is operational rather than stylistic: a
 * site is registered before anybody has the logo. A half-configured brand has to
 * render, so each field has a fallback and none of them is required to save.
 *
 * Stored as jsonb, so the shape is owned here rather than by a migration. An
 * unknown field is dropped on read instead of throwing, which means an older
 * deploy reading a newer record degrades to the parts it understands.
 */
export type SiteBrand = {
  /** Rendered where no logo image is set. Falls back to the site name. */
  wordmark?: string;
  logoUrl?: string;
  /** Used on dark surfaces when set, otherwise logoUrl serves both. */
  logoDarkUrl?: string;
  faviconUrl?: string;
  /** CSS color for links, focus rings and the active nav item. */
  accent?: string;
  /** The same role on a dark surface, where the light accent often fails contrast. */
  accentDark?: string;
};

export type Site = {
  id: string;
  key: string;
  name: string;
  legalName: string | null;
  status: SiteStatus;
  /** The integrating website itself, e.g. https://example.com. */
  primaryUrl: string | null;
  /** Host serving this site's portal. Null until DNS exists. */
  portalHost: string | null;
  supportEmail: string | null;
  checkoutUrl: string | null;
  brand: SiteBrand;
  note: string | null;
  /*
   * Payments.
   *
   * Who collects, and where this platform fetches billing state from when the
   * answer is "not us". The secret that fetch is made with is deliberately not
   * here and is not in SITE_COLUMNS either: it is selected by the importer alone,
   * the same discipline that keeps site_webhooks.secret out of every read except
   * the one that signs a delivery. A field no query selects is a field no later
   * edit can accidentally render.
   */
  paymentCollection: BillingSource;
  billingFeedUrl: string | null;
  billingFeedHeader: string;
  /** Where an externally billed client changes their card. */
  billingManageUrl: string | null;
};

/**
 * What the portal wears when no site could be resolved.
 *
 * This is not a brand and is not meant to look like one. An unresolved request
 * is a misconfiguration, and a screen that quietly renders somebody's colors
 * hides it. Grey and unnamed is the honest answer, and the accent is the one
 * borrowed from the platform's own chrome so the page is still usable.
 */
export const NEUTRAL_BRAND: Required<Omit<SiteBrand, "logoUrl" | "logoDarkUrl" | "faviconUrl">> = {
  wordmark: "Portal",
  accent: "#3D4AFF",
  accentDark: "#7C86FF",
};

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Trims to a bounded string, or null. Empty and whitespace both read as unset. */
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
}

/**
 * An image URL, restricted to https.
 *
 * A logo is rendered into the portal's own document, so an http URL is a mixed
 * content warning at best and a stripped image at worst. data: is refused as
 * well: it is not a link to somebody's asset, it is arbitrary content inlined
 * into a page this platform serves.
 */
function imageUrl(value: unknown): string | undefined {
  const raw = text(value, 2048);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function color(value: unknown): string | undefined {
  const raw = text(value, 9);
  return raw && HEX_RE.test(raw) ? raw : undefined;
}

/**
 * Reads a stored brand blob into the shape above.
 *
 * Tolerant by design. Anything unrecognized, malformed or of the wrong type is
 * dropped rather than rejected, because the alternative is a saved record that
 * renders a 500 instead of a page. Validation that a person should see happens
 * on the form in the console; this is the read path and its job is to always
 * produce something renderable.
 */
export function readBrand(value: unknown): SiteBrand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const brand: SiteBrand = {};

  const wordmark = text(raw.wordmark, 40);
  if (wordmark) brand.wordmark = wordmark;

  const logo = imageUrl(raw.logoUrl);
  if (logo) brand.logoUrl = logo;

  const logoDark = imageUrl(raw.logoDarkUrl);
  if (logoDark) brand.logoDarkUrl = logoDark;

  const favicon = imageUrl(raw.faviconUrl);
  if (favicon) brand.faviconUrl = favicon;

  const accent = color(raw.accent);
  if (accent) brand.accent = accent;

  const accentDark = color(raw.accentDark);
  if (accentDark) brand.accentDark = accentDark;

  return brand;
}

/** The row shape every site query selects. Kept here so the columns are stated once. */
export const SITE_COLUMNS =
  "id, key, name, legal_name, status, primary_url, portal_host, support_email, checkout_url, brand, note, payment_collection, billing_feed_url, billing_feed_header, billing_manage_url";

/** Maps a selected row onto the Site type. Throws nothing; a bad brand reads as {}. */
export function siteFromRow(row: Record<string, unknown>): Site {
  return {
    id: row.id as string,
    key: row.key as string,
    name: row.name as string,
    legalName: (row.legal_name as string | null) ?? null,
    status: row.status as SiteStatus,
    primaryUrl: (row.primary_url as string | null) ?? null,
    portalHost: (row.portal_host as string | null) ?? null,
    supportEmail: (row.support_email as string | null) ?? null,
    checkoutUrl: (row.checkout_url as string | null) ?? null,
    brand: readBrand(row.brand),
    note: (row.note as string | null) ?? null,
    /* An unreadable value reads as "this platform collects", which is what every
       site was before the column existed and the state that needs no feed to
       work. Failing the other way would point the portal at an import that may
       never have run. */
    paymentCollection:
      typeof row.payment_collection === "string" && isBillingSource(row.payment_collection)
        ? row.payment_collection
        : "platform",
    billingFeedUrl: (row.billing_feed_url as string | null) ?? null,
    billingFeedHeader: (row.billing_feed_header as string | null) || "Authorization",
    billingManageUrl: (row.billing_manage_url as string | null) ?? null,
  };
}

/** The wordmark to print for a site: their chosen one, else their name. */
export function wordmarkOf(site: Site | null): string {
  if (!site) return NEUTRAL_BRAND.wordmark;
  return site.brand.wordmark ?? site.name;
}

/** The accent pair to render with, filled in from the neutral palette. */
export function accentsOf(site: Site | null): { light: string; dark: string } {
  return {
    light: site?.brand.accent ?? NEUTRAL_BRAND.accent,
    dark: site?.brand.accentDark ?? site?.brand.accent ?? NEUTRAL_BRAND.accentDark,
  };
}

/**
 * Normalizes a host the way `portal_host` is stored and the way a Host header
 * arrives: lowercase, no scheme, no path, port preserved.
 *
 * A Host header carries a port when it is not the scheme's default, so a dev
 * server on localhost:3001 and a production host on 443 are both handled by
 * keeping whatever was sent rather than stripping ports and hoping.
 */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let host = raw.trim().toLowerCase();
  if (!host) return null;
  /* A Host header should never carry a scheme, but a configuration field filled
     in by a person very often does. Accept both rather than store a value that
     silently matches no request. */
  if (host.includes("://")) {
    try {
      host = new URL(host).host;
    } catch {
      return null;
    }
  }
  host = host.replace(/\/.*$/, "");
  /* X-Forwarded-Host can arrive as a list when more than one proxy appended to
     it. The first entry is the one the client asked for. */
  host = host.split(",")[0].trim();
  return host || null;
}

/**
 * The origin as this platform writes it everywhere: scheme and host, no path, no
 * trailing slash, which is exactly the shape of a browser's Origin header.
 *
 * Wildcards are refused rather than interpreted. `new URL("*")` does not fail,
 * it produces the literal host "*", which no browser will ever send: somebody
 * typing it to mean "allow everything" would store a value that matches nothing
 * while appearing to match all. Returning null turns that into a message on a
 * form.
 */
export function normalizeOrigin(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.includes("*")) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Path a site publishes its verification token at.
 *
 * Under /.well-known because that is the reserved namespace for exactly this,
 * and every static host, framework and CDN can serve a file from it without a
 * route. The name is generic on purpose: an integrator should not have to paste
 * a vendor's brand into their own public directory to use their own portal.
 */
export const VERIFICATION_PATH = "/.well-known/portal-site-verification.txt";
