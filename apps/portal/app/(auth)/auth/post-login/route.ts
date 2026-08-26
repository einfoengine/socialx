import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@socialx/core/supabase/server";

/**
 * Landing point for a password sign-in.
 *
 * A magic link already has somewhere to land: /auth/callback exchanges the code
 * and then decides which portal the person belongs in. A password sign-in has no
 * such round trip, because supabase-js sets the session in the browser. Without
 * this route the form would have to guess the destination, and staff who also
 * hold a client membership would be sent to the wrong one.
 *
 * The decision below is deliberately the same as the one at the end of
 * /auth/callback, so both ways in agree about where a given person goes.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/portal";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The form only sends people here after a session exists, so a miss means the
  // cookie did not survive. Bounce rather than render a portal with no identity.
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=That sign-in did not stick`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .single();

  if (profile?.is_staff && next.startsWith("/portal")) {
    return NextResponse.redirect(`${origin}/admin`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
