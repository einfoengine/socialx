import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead } from "@/components/DataTable";
import { formatMoney, CYCLE_LABELS } from "@/lib/format";
import { rel } from "@/lib/rel";

export const metadata: Metadata = { title: "Packages | socialX Admin" };

type Include = { text: string; highlight?: boolean };

export default async function PackagesPage() {
  await requirePermission("packages");
  const supabase = await createClient();

  const [{ data: plans }, { data: prices }, { data: ents }] = await Promise.all([
    supabase.from("plans").select("id, key, name, tagline, description, includes, sort").order("sort"),
    supabase.from("plan_prices").select("plan_id, cycle_key, monthly_amount, total_amount, stripe_price_id"),
    supabase.from("plan_entitlements").select("*"),
  ]);

  return (
    <div>
      <PageHead {...pageMeta("/admin/packages")} />

      <div className="flex flex-col gap-5">
        {(plans ?? []).map((plan) => {
          const my = (prices ?? []).filter((p) => p.plan_id === plan.id);
          const ent = (ents ?? []).find((e) => e.plan_id === plan.id);
          const includes = (plan.includes ?? []) as Include[];
          const monthly = my.find((p) => p.cycle_key === "monthly");

          return (
            <section
              key={plan.id}
              className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]"
            >
              <header className="flex flex-wrap items-start gap-4 p-5 border-b border-black/8 dark:border-white/8">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h2 className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white">
                      {plan.name}
                    </h2>
                    {plan.key === "growth" && (
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] gradient-bg text-white px-2 py-0.5">
                        core tier
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed max-w-[70ch]">
                    {plan.tagline}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-grotesk text-2xl font-semibold text-gray-900 dark:text-white">
                    {monthly ? formatMoney(monthly.monthly_amount) : "unpriced"}
                    <span className="text-[13px] text-gray-400 font-normal">/mo</span>
                  </div>
                  <Link
                    href={`/admin/packages/${plan.key}`}
                    className="font-mono text-[10px] uppercase tracking-[0.11em] text-[#2B50DC] dark:text-[#5B8DEF] no-underline"
                  >
                    open package
                  </Link>
                </div>
              </header>

              <div className="grid md:grid-cols-2 gap-px bg-black/8 dark:bg-white/8">
                <div className="bg-white dark:bg-[#111118] p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
                    What is included
                  </div>
                  <ul className="flex flex-col gap-2">
                    {includes.map((i, n) => (
                      <li key={n} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-[#2B50DC] dark:bg-[#5B8DEF]" />
                        <span
                          className={
                            i.highlight
                              ? "text-gray-900 dark:text-white font-medium"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {i.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white dark:bg-[#111118] p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
                    Billing options
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {["monthly", "quarterly", "half", "yearly"].map((cy) => {
                      const p = my.find((x) => x.cycle_key === cy);
                      return (
                        <div
                          key={cy}
                          className="flex items-center gap-3 text-[13px] border-b border-black/5 dark:border-white/5 last:border-0 pb-1.5 last:pb-0"
                        >
                          <span className="text-gray-600 dark:text-gray-400 w-[92px] shrink-0">
                            {CYCLE_LABELS[cy]}
                          </span>
                          <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                            {p ? formatMoney(p.total_amount) : "not set"}
                          </span>
                          {!p?.stripe_price_id && p && (
                            <span className="font-mono text-[9.5px] uppercase text-rose-600">
                              no stripe price
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {ent && (
                    <div className="mt-4 pt-3 border-t border-black/8 dark:border-white/8 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-gray-500">
                      <span>{ent.posts_per_month} posts</span>
                      <span>{ent.motion_videos} motion</span>
                      <span>{ent.platforms_max} platforms</span>
                      <span>
                        {ent.revision_rounds === null ? "unlimited revisions" : `${ent.revision_rounds} revisions`}
                      </span>
                      <span>{ent.first_batch_days}d first batch</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-[12.5px] text-gray-500 dark:text-gray-500 mt-6 max-w-[76ch]">
        Prices and specs are locked at $197, $397, and $597. They change in
        <span className="font-mono"> supabase/seed/0001_catalog.sql</span>, are pushed with
        <span className="font-mono"> pnpm stripe:sync</span>, and need Shariful&apos;s approval first.
      </p>
    </div>
  );
}
