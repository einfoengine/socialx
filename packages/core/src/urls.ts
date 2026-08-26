/**
 * Where the other half of the product lives.
 *
 * The marketing site and the portal are separate applications on separate
 * origins, so a link from one to the other is a real navigation and not a route.
 * A bare href="/login" inside the portal resolves against the portal's own
 * origin, which is how "Back to socialx.studio" ended up pointing at a page that
 * does not exist there.
 *
 * Both values are NEXT_PUBLIC because the links are rendered in the browser. They
 * are origins, not secrets: the same two addresses appear in every page of both
 * apps.
 *
 * The localhost defaults match the ports in each app's package.json, so a fresh
 * clone with no env still links correctly between the two dev servers.
 */

const DEV_SITE = "http://localhost:3000";
const DEV_PORTAL = "http://localhost:3001";

function origin(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  return (raw || fallback).replace(/\/$/, "");
}

/** The marketing site. Pass a path to deep link into it, e.g. "/#gw-pricing". */
export function siteUrl(path = ""): string {
  return origin(process.env.NEXT_PUBLIC_SITE_URL, DEV_SITE) + path;
}

/** The signed-in application. Pass a path, e.g. "/login". */
export function portalUrl(path = ""): string {
  return origin(process.env.NEXT_PUBLIC_PORTAL_URL, DEV_PORTAL) + path;
}
