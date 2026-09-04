import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isInstalled } from "@/lib/core/install";

/**
 * Proxy. This is what Next.js called Middleware before version 16; the rename is
 * cosmetic but the file convention is not.
 *
 * Two jobs, and deliberately no others:
 *   1. Refresh the Supabase auth cookie so server components see a live session.
 *   2. An optimistic redirect when there is plainly no session at all.
 *
 * It does NOT authorize. The Next docs are explicit that Proxy runs on every route
 * including prefetches and should not make database calls, so it cannot tell staff
 * from client, and a server action never passes through here at all. Real checks
 * live in lib/dal, with row level security underneath them.
 */

const PROTECTED = ["/portal", "/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * An install that has not been set up yet has no session to refresh and
   * nothing to authorize, so everything goes to /setup instead.
   *
   * This asks whether the *portal* is installed rather than whether Supabase is
   * configured, and the difference is the whole point: the connection is a
   * Postgres connection string now, and Supabase is one of the things that can
   * be on the other end of it rather than a requirement.
   *
   * The redirect is deliberately wide. It is not only the protected routes: an
   * unconfigured portal has no login to offer either, and sending somebody to a
   * sign-in form backed by no database is a worse answer than sending them to
   * the screen that fixes it. /setup itself and the static assets are excluded
   * so the destination can actually render.
   */
  if (!(await isInstalled())) {
    if (pathname.startsWith("/setup")) return NextResponse.next({ request });

    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    url.search = "";
    return NextResponse.redirect(url);
  }

  /* Configured, but without the Supabase half that the not-yet-migrated queries
     still need. Those pages cannot render, so say so rather than throwing. */
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (PROTECTED.some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal-unavailable";
      url.search = "";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  /*
   * getSession, not getUser, and the difference is the whole performance story
   * of this file.
   *
   * getUser calls the Auth server to validate the token, which measured at 145ms
   * median from here and made Proxy roughly half of all server time on every
   * single request. getSession reads and verifies the JWT locally and only
   * reaches the network when the token has actually expired and needs
   * refreshing, which is the side effect this file exists for.
   *
   * Safe precisely because Proxy does not authorize. Its own contract, stated
   * above, is "a token was present and parseable", which is exactly what
   * getSession answers. The real check is getUser inside lib/dal, on every
   * server component and every server action, with RLS underneath it.
   */
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Signed-in users have no reason to sit on the login screen.
  if (pathname === "/login" && user) {
    const home = request.nextUrl.clone();
    home.pathname = "/portal";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image files, and the public API.
     *
     * Auth cookies need refreshing on real navigations, not on every icon
     * request. /api is excluded for a second reason: nothing under it
     * authenticates by cookie. /api/v1 authenticates by key and /api/internal by
     * a shared secret, so refreshing a session on either is work nobody asked for
     * on a path that has no session. Leaving them in also meant an
     * unauthenticated public call paid for a Supabase client it never used.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|woff2?)$).*)",
  ],
};
