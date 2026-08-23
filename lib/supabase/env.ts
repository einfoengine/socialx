/**
 * Is the portal backend configured at all?
 *
 * The marketing site is a live business asset and must keep serving even when the
 * portal is not set up: a fresh clone, a preview deploy without secrets, or a
 * misconfigured environment. Proxy runs on every route, so without this guard one
 * missing variable 500s the landing page and the pricing section along with it.
 *
 * Public routes degrade to "portal unavailable". They never go down.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
