import type { Metadata } from "next";
import Logo from "@/components/Logo";
import { redirect } from "next/navigation";
import { platform } from "@/lib/platform";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout | socialX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Include = { text: string; highlight?: boolean };

type Catalog = {
  plans: {
    key: string;
    name: string;
    tagline: string | null;
    includes: Include[];
    entitlements: {
      posts_per_month: number;
      motion_videos: number;
      platforms_max: number;
      revision_rounds: number | null;
      first_batch_days: number;
    } | null;
    prices: { cycle: string; monthly_amount_cents: number; total_amount_cents: number }[];
  }[];
  add_ons: { key: string; name: string; description: string; amount: number }[];
  standing_discounts: { cycle: string; percent_off: number }[];
};

/**
 * socialX's own checkout.
 *
 * Two calls to the platform and no database of its own. The catalogue call
 * carries the package, its copy, its price ladder, its add-ons and the standing
 * offer per cycle; the quote call prices the specific basket this link asked
 * for.
 *
 * The order is still priced on a server before anything renders, so the summary
 * a buyer reads is the same object the payment is created from. The browser
 * still never learns a price it could change. What changed is only which server
 * does the pricing, and that this one no longer holds a credential that could
 * read every other customer's data.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string; code?: string }>;
}) {
  const sp = await searchParams;
  const planKey = (sp.plan ?? "growth").toLowerCase().trim();
  const cycleKey = (sp.cycle ?? "monthly").toLowerCase().trim();
  const code = sp.code?.trim() || null;

  const api = platform();

  /* A bad link, an unknown package, or an unreachable platform all go back to
     the pricing section rather than showing an error. There is nothing useful a
     buyer can do on a checkout screen that cannot name a price. */
  let catalog: Catalog;
  let quote;
  try {
    [catalog, quote] = await Promise.all([
      api.catalog<Catalog>(planKey),
      api.quote({ plan: planKey, cycle: cycleKey, code }),
    ]);
  } catch {
    redirect("/#gw-pricing");
  }

  const plan = catalog.plans.find((p) => p.key === planKey);
  if (!plan) redirect("/#gw-pricing");

  const ent = plan.entitlements;
  const addons = catalog.add_ons ?? [];

  return (
    <main className="min-h-screen bg-[#F4F2EF] dark:bg-[#050508] transition-colors duration-300">
      <header className="border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#0C0C12]/80 backdrop-blur-md">
        <div className="max-w-[1080px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <Logo className="h-[26px]" />
          <ol className="hidden sm:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
            {[
              ["1", "Pay", true],
              ["2", "Onboard", false],
              ["3", "First batch", false],
            ].map(([n, label, active], i) => (
              <li key={label as string} className="flex items-center gap-2">
                {i > 0 && <span className="w-6 h-px bg-black/15 dark:bg-white/15" aria-hidden="true" />}
                <span
                  className={`grid h-[18px] w-[18px] place-items-center text-[9px] ${
                    active
                      ? "gradient-bg text-white"
                      : "border border-black/15 dark:border-white/20 text-gray-400 dark:text-gray-600"
                  }`}
                >
                  {n as string}
                </span>
                <span className={active ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"}>
                  {label as string}
                </span>
              </li>
            ))}
          </ol>
          <span className="sm:hidden font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">
            Secure checkout
          </span>
        </div>
      </header>

      <CheckoutClient
        planKey={plan.key}
        planName={plan.name}
        tagline={plan.tagline ?? ""}
        includes={plan.includes ?? []}
        entitlements={
          ent
            ? {
                posts: ent.posts_per_month,
                motion: ent.motion_videos,
                platforms: ent.platforms_max,
                revisions: ent.revision_rounds,
                firstBatchDays: ent.first_batch_days,
              }
            : null
        }
        cycles={plan.prices.map((p) => ({
          key: p.cycle,
          listTotal: p.total_amount_cents,
          monthly: p.monthly_amount_cents,
        }))}
        addons={addons}
        firstBatchDays={ent?.first_batch_days ?? 7}
        discounts={(catalog.standing_discounts ?? []).map((d) => ({
          cycle: d.cycle,
          percentOff: d.percent_off,
        }))}
        initialCycle={cycleKey}
        initialCode={code}
        initial={{
          listTotal: quote.list_total,
          total: quote.total,
          coupon: quote.coupon
            ? { code: quote.coupon.code, percentOff: quote.coupon.percent_off }
            : null,
          autoApplied: quote.auto_applied,
        }}
        publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
      />
    </main>
  );
}
