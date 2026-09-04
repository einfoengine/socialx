import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { PageHead } from "@/components/DataTable";
import { formatMoney, CYCLE_LABELS, CYCLE_MONTHS, applyDiscount } from "@/lib/format";
import LinkBuilder from "./LinkBuilder";
import CopyLink from "@/components/CopyLink";

export const metadata: Metadata = { title: "Links | Admin" };

/**
 * Checkout links.
 *
 * A link carries a package, a cycle and at most a coupon code. It cannot carry a
 * price, so a link that gets forwarded, edited or screenshotted can never charge
 * an amount the platform did not publish.
 */
export default async function LinksPage() {
  await requirePermission("links");
  const supabase = await createClient();

  const [{ data: plans }, { data: prices }, { data: coupons }] = await Promise.all([
    supabase.from("plans").select("id, key, name, sort").eq("is_active", true).order("sort"),
    supabase.from("plan_prices").select("plan_id, cycle_key, total_amount, monthly_amount"),
    supabase
      .from("coupons")
      .select("code, name, kind, percent_off, cycle_key, auto_apply, is_active")
      .eq("is_active", true)
      .order("kind")
      .order("percent_off"),
  ]);

  const planList = (plans ?? []).map((p) => ({ key: p.key, name: p.name, id: p.id }));
  const priceList = (prices ?? []).map((p) => ({
    planId: p.plan_id,
    cycle: p.cycle_key,
    total: p.total_amount,
    monthly: p.monthly_amount,
  }));
  const couponList = (coupons ?? []).map((c) => ({
    code: c.code,
    name: c.name,
    kind: c.kind as string,
    percentOff: Number(c.percent_off),
    cycle: c.cycle_key as string | null,
    auto: c.auto_apply as boolean,
  }));

  /* The standing links: every package on every cycle, with whatever applies today. */
  const auto = couponList.filter((c) => c.auto && c.kind === "launch");

  return (
    <div>
      <PageHead {...pageMeta("/admin/links")} />

      <LinkBuilder plans={planList} prices={priceList} coupons={couponList} />

      <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mt-10 mb-3">
        Standing links
      </h2>
      <p className="text-[12.5px] text-gray-500 dark:text-gray-500 mb-4 max-w-[78ch]">
        No code needed. These carry whatever discount is running today, so they stay correct
        when the launch offer ends without anyone reissuing them.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        {planList.map((plan) => (
          <div key={plan.key} className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4">
            <div className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white mb-3">
              {plan.name}
            </div>
            <div className="flex flex-col gap-2">
              {["monthly", "quarterly", "half", "yearly"].map((cy) => {
                const price = priceList.find((p) => p.planId === plan.id && p.cycle === cy);
                if (!price) return null;
                const c = auto.find((x) => x.cycle === cy);
                const calc = applyDiscount(price.total, c?.percentOff ?? 0, CYCLE_MONTHS[cy] ?? 1);
                return (
                  <div key={cy} className="flex items-center gap-2 text-[12.5px]">
                    <span className="text-gray-500 w-[76px] shrink-0">{CYCLE_LABELS[cy]}</span>
                    <span className="font-grotesk font-semibold text-gray-900 dark:text-white shrink-0">
                      {formatMoney(calc.total)}
                    </span>
                    <span className="ml-auto shrink-0">
                      <CopyLink path={`/checkout?plan=${plan.key}&cycle=${cy}`} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
