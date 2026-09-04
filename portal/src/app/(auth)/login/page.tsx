import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/core/supabase/env";
import { currentSite } from "@/lib/sites/resolve";
import { wordmarkOf } from "@/lib/core/sites";
import { safeNext } from "@/lib/core/urls";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // Without a backend there is nothing to sign into, and the browser client would
  // throw on submit. Say so plainly instead.
  if (!isSupabaseConfigured()) redirect("/portal-unavailable");

  // searchParams is a Promise in Next 16.
  const params = await searchParams;

  /* Resolved from the host, which is the only thing known before somebody signs
     in. A site with its own portal domain therefore gets its own sign-in screen;
     the shared host has no site to speak for and renders the platform mark with
     no outbound links, because "back to our website" has no honest answer when
     the visitor could belong to any of them. */
  const site = await currentSite();

  return (
    <LoginForm
      /* Cleaned here as well as at both landing routes. Those are the boundary
         that matters, but the form also puts this value into the magic link's
         emailRedirectTo, and an address that leaves in an email is worth not
         minting at all. */
      next={safeNext(params.next)}
      error={params.error}
      brand={
        site
          ? {
              wordmark: wordmarkOf(site),
              logoUrl: site.brand.logoUrl ?? null,
              logoDarkUrl: site.brand.logoDarkUrl ?? null,
              websiteUrl: site.primaryUrl,
              checkoutUrl: site.checkoutUrl,
            }
          : null
      }
    />
  );
}
