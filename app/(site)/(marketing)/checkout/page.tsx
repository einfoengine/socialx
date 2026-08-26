import type { Metadata } from "next";
import Logo from "@/components/Logo";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveCheckout, addonsForPlan } from "@/lib/billing/resolve";
import { isStripeConfigured } from "@/lib/stripe";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout | socialX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Include = { text: string; highlight?: boolean };

/**
 * socialX's own checkout.
 *
 * The order is resolved on the server before anything renders, so the summary a
 * buyer reads is the same object the payment is created from. The browser never
 * learns a price it could change.
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

  if (!isStripeConfigured()) redirect("/#gw-pricing");

  let resolved;
  try {
    resolved = await resolveCheckout(planKey, cycleKey, code);
  } catch {
    // A bad link goes back to the pricing section rather than showing an error.
    redirect("/#gw-pricing");
  }

  const db = createServiceClient();
  const [{ data: plan }, { data: ent }, { data: prices }, { data: discounts }] = await Promise.all([
    db.from("plans").select("key, name, tagline, includes").eq("key", planKey).maybeSingle(),
    db
      .from("plan_entitlements")
      .select("posts_per_month, motion_videos, platforms_max, revision_rounds, first_batch_days, plans!inner(key)")
      .eq("plans.key", planKey)
      .maybeSingle(),
    db
      .from("plan_prices")
      .select("cycle_key, total_amount, monthly_amount, plans!inner(key)")
      .eq("plans.key", planKey)
      .eq("is_active", true),
    /* The standing offer per cycle, so the ladder can price every rung without a
       round trip for each one. */
    db
      .from("coupons")
      .select("cycle_key, percent_off")
      .eq("kind", "launch")
      .eq("auto_apply", true)
      .eq("is_active", true),
  ]);

  if (!plan) redirect("/#gw-pricing");

  const addons = await addonsForPlan(planKey);

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
        includes={(plan.includes ?? []) as Include[]}
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
        cycles={(prices ?? []).map((p) => ({
          key: p.cycle_key as string,
          listTotal: p.total_amount as number,
          monthly: p.monthly_amount as number,
        }))}
        addons={addons}
        firstBatchDays={ent?.first_batch_days ?? 7}
        discounts={(discounts ?? []).map((d) => ({
          cycle: d.cycle_key as string,
          percentOff: Number(d.percent_off),
        }))}
        initialCycle={resolved.cycleKey}
        initialCode={code}
        initial={{
          listTotal: resolved.listTotal,
          total: resolved.total,
          coupon: resolved.coupon
            ? { code: resolved.coupon.code, percentOff: resolved.coupon.percentOff }
            : null,
          autoApplied: resolved.autoApplied,
        }}
        publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
      />
    </main>
  );
}
