"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

/**
 * Magic-link sign in. One flow for staff and clients: which portal someone lands in
 * is decided after the session exists, by lib/dal, not by which form they used.
 */
export default function LoginForm({ next, error }: { next: string; error?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(error ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (signInError) {
      setStatus("error");
      setMessage("That did not send. Check the address and try again.");
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F2EF] dark:bg-[#050508] px-6 transition-colors duration-300">
      <div className="w-full max-w-[420px]">
        {/* Was a white PNG shown only in dark plus a text fallback in light, so the
            real mark never appeared on the default theme. */}
        <div className="mb-10 flex justify-center">
          <LogoMark className="h-8" />
        </div>

        <div className="bg-white dark:bg-[#111118] border border-black/10 dark:border-white/10 p-8">
          {status === "sent" ? (
            <div>
              <h1 className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Check your email
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                We sent a sign-in link to <strong className="text-gray-900 dark:text-white">{email}</strong>.
                It is good for one hour.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-6 font-grotesk text-xs font-semibold uppercase tracking-[1px] text-[#2B50DC] dark:text-[#5B8DEF] cursor-pointer"
              >
                Use a different address
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Sign in
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-7 leading-relaxed">
                We will email you a link. No password to remember.
              </p>

              <label
                htmlFor="email"
                className="block font-grotesk text-[11px] font-semibold uppercase tracking-[1.2px] text-gray-500 dark:text-gray-400 mb-2"
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@youragency.com"
                className="w-full bg-transparent border border-black/15 dark:border-white/15 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors"
              />

              {message && (
                <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{message}</p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="btn btn-primary gradient-bg text-white w-full mt-6 py-3.5 font-grotesk font-semibold text-sm disabled:opacity-60 cursor-pointer"
              >
                {status === "sending" ? "Sending" : "Email me a link"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-xs text-gray-500 dark:text-gray-500">
          Not a client yet?{" "}
          <Link href="/#gw-pricing" className="text-[#2B50DC] dark:text-[#5B8DEF]">
            See the plans
          </Link>
        </p>
      </div>
    </main>
  );
}
