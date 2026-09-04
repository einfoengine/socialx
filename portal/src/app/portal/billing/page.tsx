import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import { Suspense } from "react";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@/lib/core/supabase/server";
import { Status } from "@/components/DataTable";
import { formatMoney, CYCLE_LABELS, CYCLE_MONTHS, applyDiscount } from "@/lib/format";
import { openBillingPortal } from "../actions";
import { SkeletonCard, SkeletonRows } from "@/components/Skeleton";
import { freshness } from "@/lib/core/payments";
import { billingMaxAgeHours } from "@/lib/billing/external";
import { siteForOrg } from "@/lib/sites/resolve";

export const metadata: Metadata = { title: "Billing | Portal" };

/* Nothing here is guessable, so everything below the heading waits. The heading
   and the promise are static and land immediately. */
export default function BillingPage() {
  return (
    <div className="max-w-[760px]">
      <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">{pageMeta("/portal/billing").title}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-8">{pageMeta("/portal/billing").sub}</p>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <SkeletonCard lines={4} />
            <SkeletonRows n={3} />
          </div>
        }
      >
        <BillingDetail />
      </Suspense>
    </div>
  );
}

async function BillingDetail() {
  const session = await requireOrg();
  const supabase = await createClient();

  /*
   * One subscription, chosen rather than assumed.
   *
   * This used to be maybeSingle(), which errors outright the moment an
   * organization has two rows, and an organization can now have two: a client
   * who moved from this platform's card checkout to their site's own billing has
   * the old one and the imported one. The current one is the most recently
   * touched, which is true whichever direction the move went in.
   */
  const [{ data: subs }, { data: invoices }, site, maxAge] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "status, cycle_key, rate_card_key, current_period_end, cancel_at_period_end, plan_id, source, amount, currency, external_manage_url, synced_at, plans(name, key)"
      )
      .eq("org_id", session.orgId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("invoices")
      .select("id, number, amount_paid, currency, status, issued_at, hosted_invoice_url")
      .eq("org_id", session.orgId)
      .order("issued_at", { ascending: false }),
    siteForOrg(session.orgId),
    billingMaxAgeHours(),
  ]);

  const sub = subs?.[0] ?? null;

  /* Who takes this client's money, read off their own subscription rather than
     off the site's current setting. A row imported from a site's feed stays a
     record of that site's billing even if the platform switch is turned off
     tomorrow, and offering them a card form here would be this product lying
     about where their money goes. */
  const external = sub?.source === "external";
  const age = external ? freshness(sub?.synced_at ?? null, maxAge) : null;
  const manageUrl = external
    ? (sub?.external_manage_url as string | null) ?? site?.billingManageUrl ?? null
    : null;

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

  const months = CYCLE_MONTHS[sub?.cycle_key ?? "monthly"] ?? 1;
  const currency = (sub?.currency as string | null) ?? "usd";

  /*
   * What this client actually pays.
   *
   * An externally billed subscription is priced by the site that bills it, and
   * the catalogue here is not that price. So the feed's own figure wins when it
   * gave one, with no discount arithmetic applied on top: the amount is the
   * charge, not a list price to be worked down from. It falls back to the
   * catalogue only when the feed said nothing, which is better than a plan card
   * with no number on it and is why the fallback exists at all.
   */
  const price =
    external && typeof sub?.amount === "number"
      ? { total: sub.amount, perMonth: Math.round(sub.amount / months), saving: 0, percentOff: 0 }
      : listPrice
        ? applyDiscount(listPrice.total_amount, Number(discount?.percent_off ?? 0), months)
        : null;

  const { data: ent } = sub?.plan_id
    ? await supabase
        .from("plan_entitlements")
        .select("posts_per_month, motion_videos, platforms_max, revision_rounds")
        .eq("plan_id", sub.plan_id)
        .maybeSingle()
    : { data: null };

  return (
    <>
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
                      {formatMoney(price.perMonth, currency)}
                      <span className="text-[13px] text-gray-400 font-normal">/mo</span>
                    </div>
                    <div className="text-[12px] text-gray-500">
                      {formatMoney(price.total, currency)} per {CYCLE_LABELS[sub.cycle_key]?.toLowerCase()}
                    </div>
                    {price.saving > 0 && (
                      <div className="text-[12px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        {price.percentOff}% off, saving {formatMoney(price.saving, currency)}
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
              {/*
                * Two different offers, because there are two different truths
                * behind them. A card this platform holds can be changed here and
                * now. A subscription billed by the company that sold it cannot
                * be touched from this screen at all, and a button that opened a
                * card form anyway would be collecting a card nothing charges.
                */}
              {external ? (
                manageUrl ? (
                  <a
                    href={manageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto btn btn-ink bg-[#111118] dark:bg-white text-white dark:text-[#111118] px-5 py-2.5 font-grotesk font-semibold text-[13px] no-underline"
                  >
                    Manage billing
                  </a>
                ) : site?.supportEmail ? (
                  <a
                    href={`mailto:${site.supportEmail}`}
                    className="ml-auto text-[13px] text-gray-600 dark:text-gray-400 no-underline hover:underline"
                  >
                    Write to {site.supportEmail} to change your billing
                  </a>
                ) : null
              ) : (
                <form action={openBillingPortal} className="ml-auto">
                  <button className="btn btn-ink bg-[#111118] dark:bg-white text-white dark:text-[#111118] px-5 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0">
                    Manage billing
                  </button>
                </form>
              )}
            </div>

            {/*
              * How old this is, printed rather than implied.
              *
              * Everything above was fetched from the system that actually bills
              * this client, at some point in the past. Presenting it with no age
              * would be presenting a copy as if it were the source, and the first
              * person hurt by that is somebody who paid yesterday and is looking
              * at a screen that still says past due.
              */}
            {external && age && (
              <p
                className={`mt-4 text-[12px] ${
                  age.stale ? "text-amber-700 dark:text-amber-400" : "text-gray-500"
                }`}
              >
                Billed by {site?.name ?? "the company you bought from"}, and shown here as
                fetched from them: {age.label}.
                {age.stale && " It may be behind what they hold."}
              </p>
            )}

            {sub.status === "past_due" && (
              <div className="mt-4 border border-rose-500/40 bg-rose-500/6 p-3.5 text-[13px] text-rose-700 dark:text-rose-400">
                {external
                  ? "A payment did not go through. Settle it with the company that bills you to keep delivery running."
                  : "A payment did not go through. Update your card to keep delivery running."}
              </div>
            )}
          </div>

          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
            Invoices
          </h2>
          {(invoices ?? []).length === 0 ? (
            <p className="text-[13.5px] text-gray-500">
              {external
                ? "Nothing yet. Invoices appear here as they are fetched from the company that bills you."
                : "Nothing yet. Invoices appear here as they are issued."}
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
                    {formatMoney(i.amount_paid ?? 0, i.currency ?? "usd")}
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
    </>
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
