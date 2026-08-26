import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell } from "@/components/portal/DataTable";
import { formatMoney, CYCLE_LABELS, CYCLE_MONTHS, applyDiscount } from "@/lib/format";
import CopyLink from "@/components/portal/CopyLink";

export const metadata: Metadata = { title: "Package | socialX Admin" };

type Include = { text: string; highlight?: boolean };

export default async function PackageDetail({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requirePermission("packages");
  const { key } = await params;
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("id, key, name, tagline, description, includes")
    .eq("key", key)
    .maybeSingle();

  if (!plan) notFound();

  const [{ data: prices }, { data: ent }, { data: coupons }] = await Promise.all([
    supabase
      .from("plan_prices")
      .select("cycle_key, monthly_amount, total_amount, stripe_price_id")
      .eq("plan_id", plan.id),
    supabase.from("plan_entitlements").select("*").eq("plan_id", plan.id).maybeSingle(),
    supabase
      .from("coupons")
      .select("code, kind, percent_off, cycle_key, auto_apply")
      .eq("is_active", true)
      .eq("auto_apply", true),
  ]);

  const includes = (plan.includes ?? []) as Include[];
  const ordered = ["monthly", "quarterly", "half", "yearly"];

  return (
    <div>
      <Link
        href="/admin/packages"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 no-underline hover:text-[#2B50DC]"
      >
        back to packages
      </Link>

      <div className="mt-3">
        <PageHead title={plan.name} sub={plan.tagline ?? undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <Panel title="Description">
          <p className="text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed">
            {plan.description}
          </p>
        </Panel>

        <Panel title="What is included">
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
        </Panel>
      </div>

      <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
        Pricing
      </h2>
      <p className="text-[12.5px] text-gray-500 dark:text-gray-500 mb-3 max-w-[78ch]">
        List price is the monthly rate times the months, with no discount baked in. What a
        buyer is charged today is the list price with whichever coupon applies to that cycle,
        shown on Stripe&apos;s page as a saving rather than a smaller number.
      </p>

      <Table head={["Cycle", "List", "Auto discount", "Charged today", "Saving", "Checkout link"]}>
        {ordered.map((cy) => {
          const p = (prices ?? []).find((x) => x.cycle_key === cy);
          if (!p) return null;
          const c = (coupons ?? []).find((x) => x.cycle_key === cy && x.kind === "launch");
          const pct = c ? Number(c.percent_off) : 0;
          const calc = applyDiscount(p.total_amount, pct, CYCLE_MONTHS[cy] ?? 1);

          return (
            <Row key={cy}>
              <Cell strong>{CYCLE_LABELS[cy]}</Cell>
              <Cell>
                {formatMoney(p.total_amount)}
                <span className="block text-[11px] text-gray-400">
                  {formatMoney(p.monthly_amount)}/mo
                </span>
              </Cell>
              <Cell>
                {c ? (
                  <span className="text-[#2B50DC] dark:text-[#5B8DEF]">{pct}% off</span>
                ) : (
                  <span className="text-gray-400">none</span>
                )}
              </Cell>
              <Cell>
                <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                  {formatMoney(calc.total)}
                </span>
                <span className="block text-[11px] text-gray-400">
                  {formatMoney(calc.perMonth)}/mo
                </span>
              </Cell>
              <Cell>
                {calc.saving > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {formatMoney(calc.saving)}
                  </span>
                ) : (
                  <span className="text-gray-400">none</span>
                )}
              </Cell>
              <Cell>
                <CopyLink path={`/checkout?plan=${plan.key}&cycle=${cy}`} />
              </Cell>
            </Row>
          );
        })}
      </Table>

      {ent && (
        <>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mt-8 mb-3">
            Entitlements
          </h2>
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
            {[
              ["Posts", `${ent.posts_per_month}/mo`],
              ["Motion", String(ent.motion_videos)],
              ["Platforms", String(ent.platforms_max)],
              ["Revisions", ent.revision_rounds === null ? "unlimited" : `${ent.revision_rounds}/batch`],
              ["First batch", `${ent.first_batch_days} days`],
              ["Monthly call", ent.monthly_call ? "yes" : "no"],
            ].map(([l, v]) => (
              <div key={l} className="bg-white dark:bg-[#111118] p-4">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-400 mb-1.5">
                  {l}
                </div>
                <div className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">
                  {v}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}
