import type { Metadata } from "next";
import { portalUrl } from "@socialx/core/urls";
import Link from "next/link";
import { LogoMark } from "@socialx/ui/Logo";

export const metadata: Metadata = {
  title: "Welcome to socialX",
  robots: { index: false, follow: false },
};

/**
 * Post-checkout landing.
 *
 * Deliberately says nothing about what has been created, because at this instant it
 * may not exist yet: provisioning runs on the webhook, which can land a second
 * before or after this page. Promising an account that is still being created is
 * how you generate a support ticket.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F2EF] dark:bg-[#050508] px-6 py-20 transition-colors duration-300">
      <div className="w-full max-w-[560px]">
        <div className="mb-10">
          <LogoMark className="h-8" />
        </div>

        <div className="bg-white dark:bg-[#111118] border border-black/10 dark:border-white/10 p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#2B50DC] dark:text-[#5B8DEF] mb-3">
            Payment received
          </div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white mb-4">
            You are in. Check your email.
          </h1>
          <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            We are setting up your workspace now. A sign-in link is on its way to the
            address you paid with. Open it and you will go straight to onboarding.
          </p>

          <ol className="flex flex-col gap-4 mb-8">
            {[
              ["Onboarding", "Fifteen minutes, once. Brand, voice, platforms, and the access we need."],
              ["Your first batch", "We build it and you review it before anything publishes."],
              ["It runs", "Approved posts land scheduled in your HL Social Planner."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="font-mono text-[11px] text-[#2B50DC] dark:text-[#5B8DEF] pt-0.5 shrink-0">
                  0{i + 1}
                </span>
                <span>
                  <span className="block font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">
                    {title}
                  </span>
                  <span className="block text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <Link
            href={portalUrl("/login")}
            className="btn gradient-bg text-white inline-block px-6 py-3 font-grotesk font-semibold text-sm no-underline"
          >
            Go to sign in
          </Link>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-500 mt-5 leading-relaxed">
          Nothing in your inbox after a few minutes? Email{" "}
          <a href="mailto:hi@socialx.studio" className="text-[#2B50DC] dark:text-[#5B8DEF]">
            hi@socialx.studio
          </a>{" "}
          {session_id ? `and quote ${session_id.slice(-12)}.` : "and we will sort it."}
        </p>
      </div>
    </main>
  );
}
