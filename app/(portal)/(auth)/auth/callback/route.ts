import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing point. Exchanges the code for a session, then routes the user
 * to the portal that matches who they are.
 *
 * Route Handlers never pass through proxy.ts, which is exactly why the routing
 * decision is made here against real data rather than assumed upstream.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/portal";

  const supabase = await createClient();

  /* Two shapes arrive here.
     A link the browser asked for carries ?code=, because signInWithOtp stores a
     PKCE verifier first. A link minted server side with the service role carries
     ?token_hash=, and has no verifier to exchange against. Supporting both means
     seeded accounts can sign in without a deliverable inbox, which is the only
     way to reach an address like nathan@flowstackpro.demo. */
  let failed: boolean;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else {
    return NextResponse.redirect(`${origin}/login?error=Missing sign-in code`);
  }

  if (failed) {
    return NextResponse.redirect(`${origin}/login?error=That link has expired`);
  }

  // Staff land in admin, clients in the portal, regardless of the link they used.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_staff")
      .eq("id", user.id)
      .single();

    if (profile?.is_staff && next.startsWith("/portal")) {
      return NextResponse.redirect(`${origin}/admin`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
