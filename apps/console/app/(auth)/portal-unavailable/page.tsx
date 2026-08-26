import { LogoMark } from "@socialx/ui/Logo";
import { siteUrl } from "@socialx/core/urls";

/**
 * Shown when the portal is reachable but its backend is not configured. Better than
 * a 500: it tells whoever hit it exactly which knob is missing.
 */
export default function PortalUnavailable() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F2EF] dark:bg-[#050508] px-6">
      <div className="max-w-[480px]">
        <div className="mb-8"><LogoMark className="h-7" /></div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#2B50DC] dark:text-[#5B8DEF] mb-3">
          Portal not configured
        </div>
        <h1 className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white mb-3">
          The backend is not connected yet
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-5">
          This environment has no Supabase credentials, so there is no session to sign
          into. The marketing site is unaffected.
        </p>
        <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4 font-mono text-[11.5px] text-gray-600 dark:text-gray-400 leading-relaxed">
          NEXT_PUBLIC_SUPABASE_URL
          <br />
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
          Copy <span className="font-mono">.env.example</span> to{" "}
          <span className="font-mono">.env.local</span> and fill these in.
        </p>
        <a
          href={siteUrl()}
          className="inline-block mt-6 font-grotesk text-xs font-semibold uppercase tracking-[1px] text-[#2B50DC] dark:text-[#5B8DEF]"
        >
          Back to the site
        </a>
      </div>
    </main>
  );
}
