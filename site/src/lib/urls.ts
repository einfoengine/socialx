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

/**
 * Sanitises a `next=` destination before it is joined onto an origin.
 *
 * The bug this exists to prevent is subtle enough to be worth spelling out,
 * because the broken version looks obviously safe. Both sign-in landing routes
 * finished with a redirect to origin + next, on the reasoning that prefixing the
 * origin makes whatever follows a path on this host. It does not. URL parsing
 * reads everything before an "@" as userinfo, so `?next=@evil.com` produces
 * `https://portal.example.com@evil.com`, whose host is evil.com and whose
 * username happens to be the portal. The redirect leaves the site.
 *
 * That matters here more than an open redirect usually does, because of where it
 * sits. This parameter is carried through the sign-in flow, so the destination is
 * reached at the exact moment somebody has just proved who they are and is
 * primed to trust whatever comes next. It is a phishing pivot with the
 * credibility of a real login behind it.
 *
 * The rule is therefore an allowlist rather than a blocklist: one leading slash,
 * no second slash, no backslash, no control characters. Anything else is not
 * repaired or escaped, it is discarded for the fallback, because a `next` that
 * needed repairing was not written by this application.
 */
export function safeNext(value: string | null | undefined, fallback = "/portal"): string {
  const next = (value ?? "").trim();

  /* Must be a path on this host. A protocol-relative "//host", and a backslash
     which some browsers normalise to a slash, both read as a host instead. */
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;

  /* A control character survives the checks above and is stripped by some
     browsers, so a value that is not a path here can become one in transit. */
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(next)) return fallback;

  return next;
}
