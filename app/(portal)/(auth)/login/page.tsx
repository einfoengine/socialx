import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign in | socialX",
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
  return <LoginForm next={params.next ?? "/portal"} error={params.error} />;
}
