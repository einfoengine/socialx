import { authenticate, apiError, apiJson, preflight } from "@/lib/api/auth";
import { accentsOf, wordmarkOf } from "@/lib/core/sites";
import { portalUrl } from "@/lib/core/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/site
 *
 * The site's own profile: its brand, where its portal lives, where a buyer
 * checks out, and where a customer writes for help.
 *
 * This is the endpoint that makes a website able to stop hardcoding the things
 * that belong to this platform. A support address changes, a portal moves to a
 * vanity domain, an accent color is corrected: without this, each of those is a
 * deploy on somebody else's site, and in practice it is a deploy that never
 * happens and a stale link that stays wrong for a year.
 *
 * Reachable by a public caller, because every field here is already published
 * wherever the site renders it. There is nothing on this response that a visitor
 * to their homepage cannot already read off the page.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request, "content:read");
  if (!auth.ok) return apiError(auth.failure, auth.origin);

  const { site } = auth.caller;
  const accents = accentsOf(site);

  return apiJson(
    {
      key: site.key,
      name: site.name,
      legal_name: site.legalName,
      status: site.status,
      primary_url: site.primaryUrl,
      support_email: site.supportEmail,
      checkout_url: site.checkoutUrl,
      /* Absolute, and resolved here rather than assembled by the caller. A site
         with its own portal host gets that; a site without one gets the shared
         portal it is actually served on today, which is the answer that works
         rather than the answer that is prettier. */
      portal_url: site.portalHost ? `https://${site.portalHost}` : portalUrl(),
      brand: {
        wordmark: wordmarkOf(site),
        logo_url: site.brand.logoUrl ?? null,
        logo_dark_url: site.brand.logoDarkUrl ?? site.brand.logoUrl ?? null,
        favicon_url: site.brand.faviconUrl ?? null,
        accent: accents.light,
        accent_dark: accents.dark,
      },
    },
    { caller: auth.caller, origin: auth.origin }
  );
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
