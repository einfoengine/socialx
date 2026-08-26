"use client";

import { useState } from "react";
import { LogoMark } from "@socialx/ui/Logo";
import { createClient } from "@socialx/core/supabase/client";
import { siteUrl } from "@socialx/core/urls";

/**
 * Sign in, two ways, one form.
 *
 * Password is the default because an account created on purchase or by an admin
 * is handed a password, and because a link every time is friction for someone who
 * opens the portal daily. The magic link stays as the way back in for anyone who
 * has no password set or has forgotten theirs, which is also every account created
 * before password sign-in existed.
 *
 * Which portal someone lands in is never decided here. Password sign-in hands off
 * to /auth/post-login and the link to /auth/callback, and both ask lib/dal the same
 * question.
 */
type Mode = "password" | "link";
type Status = "idle" | "working" | "sent" | "error";

export default function LoginForm({ next, error }: { next: string; error?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(error ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setMessage(null);

    const supabase = createClient();

    if (mode === "link") {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (linkError) {
        setStatus("error");
        setMessage("That did not send. Check the address and try again.");
        return;
      }
      setStatus("sent");
      return;
    }

    const { error: pwError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (pwError) {
      setStatus("error");
      /* Supabase answers a wrong password and an unknown address with the same
         error on purpose, so the form must not narrow it down either. Saying which
         one was wrong would confirm whether an address holds an account. */
      setMessage(
        pwError.message.toLowerCase().includes("email not confirmed")
          ? "That address is not confirmed yet. Use the link instead."
          : "That email and password do not match. Try again, or use a link."
      );
      return;
    }

    /* A full navigation, not a router push: the session cookie was just written by
       the browser client and the server has to read it on this next request. */
    window.location.assign(`/auth/post-login?next=${encodeURIComponent(next)}`);
  }

  function switchMode(to: Mode) {
    setMode(to);
    setStatus("idle");
    setMessage(null);
  }

  const working = status === "working";

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
                onClick={() => switchMode("password")}
                className="mt-6 font-grotesk text-xs font-semibold uppercase tracking-[1px] text-[#2B50DC] dark:text-[#5B8DEF] cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Sign in
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-7 leading-relaxed">
                {mode === "password"
                  ? "Use the password from your welcome email."
                  : "We will email you a link. No password needed."}
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

              {mode === "password" && (
                <>
                  <label
                    htmlFor="password"
                    className="block font-grotesk text-[11px] font-semibold uppercase tracking-[1.2px] text-gray-500 dark:text-gray-400 mb-2 mt-5"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full bg-transparent border border-black/15 dark:border-white/15 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors"
                  />
                </>
              )}

              {message && (
                <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{message}</p>
              )}

              <button
                type="submit"
                disabled={working}
                className="btn btn-primary gradient-bg text-white w-full mt-6 py-3.5 font-grotesk font-semibold text-sm disabled:opacity-60 cursor-pointer"
              >
                {working
                  ? mode === "password" ? "Signing in" : "Sending"
                  : mode === "password" ? "Sign in" : "Email me a link"}
              </button>

              {/* The fallback matters more than it looks: every account made before
                  password sign-in existed has no password at all, and can only get
                  in this way. */}
              <button
                type="button"
                onClick={() => switchMode(mode === "password" ? "link" : "password")}
                className="mt-4 w-full text-center font-grotesk text-[11px] font-semibold uppercase tracking-[1px] text-gray-500 hover:text-[#2B50DC] dark:text-gray-400 dark:hover:text-[#5B8DEF] transition-colors cursor-pointer"
              >
                {mode === "password" ? "Email me a link instead" : "Use a password instead"}
              </button>
            </form>
          )}
        </div>

        {/* Two ways out for someone who cannot sign in: buy, or go back to the
            site they came from. The divider is an element rather than a middot,
            which the copy rules rule out. */}
        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-500">
          <span>
            Not a client yet?{" "}
            <a href={siteUrl("/#gw-pricing")} className="text-[#2B50DC] dark:text-[#5B8DEF]">
              See the plans
            </a>
          </span>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-black/15 dark:bg-white/15" />
          <a href={siteUrl()} className="text-[#2B50DC] dark:text-[#5B8DEF]">
            Back to socialx.studio
          </a>
        </div>
      </div>
    </main>
  );
}
