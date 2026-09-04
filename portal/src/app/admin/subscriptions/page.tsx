import type { Metadata } from "next";
import { pageMeta, pageColumns } from "@/lib/page-meta";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { PageHead, Table, Row, Cell, Status, EmptyRow } from "@/components/DataTable";
import { formatMoney, CYCLE_LABELS, CYCLE_MONTHS, applyDiscount } from "@/lib/format";
import { applySiteFilter } from "@/lib/dal/scoped";
import { adminSiteContext } from "@/lib/sites/admin";

export const metadata: Metadata = { title: "Subscriptions | Admin" };

export default async function SubscriptionsPage() {
  await requirePermission("subscriptions");
  const supabase = await createClient();
  const { filterId } = await adminSiteContext();

  const { data } = await applySiteFilter(
    supabase
      .from("subscriptions")
      .select(
        "id, status, cycle_key, rate_card_key, current_period_end, delivery_hold, org_id, source, amount, currency, synced_at, organizations(name), plans(name, key)"
      ),
    filterId
  ).order("created_at", { ascending: false });

  const subs = data ?? [];

  // List prices and the discounts that apply to them, so each row can show what
  // it actually bills rather than what the tier costs at list.
  const [{ data: prices }, { data: discounts }] = await Promise.all([
    supabase.from("plan_prices").select("cycle_key, total_amount, monthly_amount, plans(key)"),
    supabase.from("rate_card_discounts").select("rate_card_key, cycle_key, percent_off").eq("is_active", true),
  ]);

  const priceFor = (planKey?: string, cycle?: string, card?: string) => {
    const list = (prices ?? []).find(
      (p) => (p.plans as { key?: string } | null)?.key === planKey && p.cycle_key === cycle
    );
    if (!list || !cycle) return null;
    const pct = Number(
      (discounts ?? []).find((d) => d.rate_card_key === card && d.cycle_key === cycle)?.percent_off ?? 0
    );
    return applyDiscount(list.total_amount, pct, CYCLE_MONTHS[cycle] ?? 1);
  };

  /*
   * What one subscription bills.
   *
   * A subscription this platform collects is priced from the catalogue, because
   * that is what it charged. A subscription the selling site collects is priced
   * by the site, and the only figure anybody here has is the one its feed
   * reported. Reading the catalogue for those rows would put this platform's
   * price list into somebody else's revenue total, which is a wrong number that
   * looks entirely plausible.
   *
   * A feed that reported no amount falls back to the catalogue rather than to
   * zero. Both are guesses; one of them silently deletes a client from the MRR.
   */
  const billed = (s: (typeof subs)[number]) => {
    if (s.source === "external" && typeof s.amount === "number") {
      const months = CYCLE_MONTHS[s.cycle_key] ?? 1;
      return { total: s.amount, perMonth: Math.round(s.amount / months), saving: 0, percentOff: 0 };
    }
    return priceFor((s.plans as { key?: string } | null)?.key, s.cycle_key, s.rate_card_key);
  };

  const mrr = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (billed(s)?.perMonth ?? 0), 0);

  return (
    <div>
      <PageHead {...pageMeta("/admin/subscriptions")} />

      <div className="grid sm:grid-cols-3 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 mb-6">
        {[
          ["Active", String(subs.filter((s) => s.status === "active").length)],
          ["Past due", String(subs.filter((s) => s.status === "past_due").length)],
          ["Monthly recurring", formatMoney(mrr)],
        ].map(([l, v]) => (
          <div key={l} className="bg-white dark:bg-[#111118] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-2">
              {l}
            </div>
            <div className="font-grotesk text-lg font-semibold text-gray-900 dark:text-white">{v}</div>
          </div>
        ))}
      </div>

      <Table head={pageColumns("/admin/subscriptions")}>
        {subs.length === 0 && <EmptyRow cols={6}>No subscriptions yet.</EmptyRow>}
        {subs.map((s) => {
          const p = billed(s);
          const external = s.source === "external";
          return (
            <Row key={s.id}>
              <Cell strong>
                <Link href={`/admin/clients/${s.org_id}`} className="no-underline hover:underline">
                  {(s.organizations as { name?: string } | null)?.name ?? "unknown"}
                </Link>
              </Cell>
              <Cell>
                {(s.plans as { name?: string } | null)?.name ?? "?"}
                {/* Whose money this is, on the row itself. The difference between
                    a charge this platform took and a charge it was told about is
                    the first thing anybody reconciling this list needs. */}
                {external && (
                  <span className="ml-2 font-mono text-[9.5px] uppercase text-gray-400">
                    external
                  </span>
                )}
              </Cell>
              <Cell>
                {CYCLE_LABELS[s.cycle_key] ?? s.cycle_key}
                {s.rate_card_key === "launch" && (
                  <span className="ml-2 font-mono text-[9.5px] uppercase text-[#2B50DC] dark:text-[#5B8DEF]">
                    launch
                  </span>
                )}
              </Cell>
              <Cell>
                {p ? (
                  <>
                    {formatMoney(p.total, s.currency ?? "usd")}
                    <span className="text-[11px] text-gray-400 ml-1">
                      ({formatMoney(p.perMonth, s.currency ?? "usd")}/mo)
                    </span>
                    {p.saving > 0 && (
                      <span className="block text-[11px] text-emerald-700 dark:text-emerald-400">
                        saves {formatMoney(p.saving, s.currency ?? "usd")}
                      </span>
                    )}
                  </>
                ) : (
                  "unpriced"
                )}
              </Cell>
              <Cell>
                {s.current_period_end
                  ? new Date(s.current_period_end).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "not set"}
              </Cell>
              <Cell>
                <Status value={s.status} />
                {s.delivery_hold && (
                  <div className="mt-1 font-mono text-[9.5px] uppercase text-rose-600">hold</div>
                )}
              </Cell>
            </Row>
          );
        })}
      </Table>
    </div>
  );
}
