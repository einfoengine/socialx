import type { Metadata } from "next";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";
import { Status } from "@/components/portal/DataTable";
import { formatMoney, CYCLE_LABELS, CYCLE_MONTHS, applyDiscount } from "@/lib/format";
import { openBillingPortal } from "../actions";

export const metadata: Metadata = { title: "Billing | socialX" };

export default async function BillingPage() {
  const session = await requireOrg();
  const supabase = await createClient();

  const [{ data: sub }, { data: invoices }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, cycle_key, rate_card_key, current_period_end, cancel_at_period_end, plan_id, plans(name, key)")
      .eq("org_id", session.orgId)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("id, number, amount_paid, status, issued_at, hosted_invoice_url")
      .eq("org_id", session.orgId)
      .order("issued_at", { ascending: false }),
  ]);

  const { data: listPrice } = sub?.plan_id
    ? await supabase
        .from("plan_prices")
        .select("monthly_amount, total_amount")
        .eq("plan_id", sub.plan_id)
        .eq("cycle_key", sub.cycle_key)
        .maybeSingle()
    : { data: null };

  const { data: discount } = sub
    ? await supabase
        .from("rate_card_discounts")
        .select("percent_off")
        .eq("rate_card_key", sub.rate_card_key)
        .eq("cycle_key", sub.cycle_key)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  const price = listPrice
    ? applyDiscount(
        listPrice.total_amount,
        Number(discount?.percent_off ?? 0),
        CYCLE_MONTHS[sub?.cycle_key ?? "monthly"] ?? 1
      )
    : null;

  const { data: ent } = sub?.plan_id
    ? await supabase
        .from("plan_entitlements")
        .select("posts_per_month, motion_videos, platforms_max, revision_rounds")
        .eq("plan_id", sub.plan_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="max-w-[760px]">
      <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
        Billing
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8">
        Your plan, your invoices, and your card. Month to month, cancel anytime.
      </p>

      {!sub ? (
        <div className="border border-dashed border-black/15 dark:border-white/15 p-8 text-sm text-gray-500">
          No subscription on this workspace yet.
        </div>
      ) : (
        <>
          <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <div className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white">
                  {(sub.plans as { name?: string } | null)?.name}
                </div>
                <div className="text-[13px] text-gray-500 mt-0.5">
                  {CYCLE_LABELS[sub.cycle_key] ?? sub.cycle_key}
                  {sub.rate_card_key === "launch" && ", launch pricing"}
                </div>
              </div>
              <div className="text-right">
                {price && (
                  <>
                    <div className="font-grotesk text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatMoney(price.perMonth)}
                      <span className="text-[13px] text-gray-400 font-normal">/mo</span>
                    </div>
                    <div className="text-[12px] text-gray-500">
                      {formatMoney(price.total)} per {CYCLE_LABELS[sub.cycle_key]?.toLowerCase()}
                    </div>
                    {price.saving > 0 && (
                      <div className="text-[12px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        {price.percentOff}% off, saving {formatMoney(price.saving)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {ent && (
              <div className="grid sm:grid-cols-4 gap-px bg-black/8 dark:bg-white/8 border border-black/8 dark:border-white/8 mb-5">
                <Fact label="Posts" value={`${ent.posts_per_month}/mo`} />
                <Fact label="Motion" value={String(ent.motion_videos)} />
                <Fact label="Platforms" value={String(ent.platforms_max)} />
                <Fact
                  label="Revisions"
                  value={ent.revision_rounds === null ? "unlimited" : `${ent.revision_rounds}/batch`}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <Status value={sub.status} />
              {sub.current_period_end && (
                <span className="text-[13px] text-gray-600 dark:text-gray-400">
                  {sub.cancel_at_period_end ? "Ends" : "Renews"}{" "}
                  {new Date(sub.current_period_end).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </span>
              )}
              <form action={openBillingPortal} className="ml-auto">
                <button className="btn btn-ink bg-[#111118] dark:bg-white text-white dark:text-[#111118] px-5 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0">
                  Manage billing
                </button>
              </form>
            </div>

            {sub.status === "past_due" && (
              <div className="mt-4 border border-rose-500/40 bg-rose-500/6 p-3.5 text-[13px] text-rose-700 dark:text-rose-400">
                A payment did not go through. Update your card to keep delivery running.
              </div>
            )}
          </div>

          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
            Invoices
          </h2>
          {(invoices ?? []).length === 0 ? (
            <p className="text-[13.5px] text-gray-500">
              Nothing yet. Invoices appear here as they are issued.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {(invoices ?? []).map((i) => (
                <div
                  key={i.id}
                  className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-3.5 flex flex-wrap items-center gap-4 text-[13px]"
                >
                  <span className="font-mono text-[11px] text-gray-500">{i.number ?? "draft"}</span>
                  <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                    {formatMoney(i.amount_paid ?? 0)}
                  </span>
                  <Status value={i.status} />
                  <span className="text-gray-500 ml-auto">
                    {i.issued_at
                      ? new Date(i.issued_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : ""}
                  </span>
                  {i.hosted_invoice_url && (
                    <a
                      href={i.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#2B50DC] dark:text-[#5B8DEF]"
                    >
                      view
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-[#111118] p-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-400 mb-1">{label}</div>
      <div className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}
