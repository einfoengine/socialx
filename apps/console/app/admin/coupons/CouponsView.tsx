import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell, EmptyRow } from "@/components/DataTable";
import { CYCLE_LABELS } from "@/lib/format";
import { createCoupon, toggleCoupon, deleteCoupon } from "./actions";
import CopyLink from "@/components/CopyLink";

const TABS = [
  { key: "regular", label: "Regular discount", href: "/admin/coupons/regular" },
  { key: "launch", label: "Launch discount", href: "/admin/coupons/launch" },
];

const PRESETS: Record<string, number[]> = {
  regular: [5, 10, 15, 20],
  launch: [30, 40, 50],
};

export default async function CouponsView({ kind }: { kind: "regular" | "launch" }) {
  await requirePermission("coupons");
  const supabase = await createClient();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, code, name, kind, percent_off, cycle_key, auto_apply, is_active, max_redemptions, times_redeemed, redeem_by, stripe_coupon_id")
    .eq("kind", kind)
    .order("auto_apply", { ascending: false })
    .order("percent_off", { ascending: true });

  const rows = coupons ?? [];

  return (
    <div>
      <PageHead
        title="Coupons"
        sub="Discounts applied at checkout. The buyer sees the list price struck through and what they are saving, which a pre-discounted price cannot show."
      />

      {/* Tabs are real routes, so each one deep links and appears in history. */}
      <nav className="flex border-b border-black/10 dark:border-white/10 mb-6">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === kind ? "page" : undefined}
            className={`px-4 py-3 font-grotesk text-[13.5px] font-medium no-underline border-b-2 -mb-px transition-colors ${
              t.key === kind
                ? "border-[#2B50DC] text-[#2B50DC] dark:border-[#5B8DEF] dark:text-[#5B8DEF]"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4 mb-6 text-[13px] text-gray-600 dark:text-gray-400 max-w-[80ch] leading-relaxed">
        {kind === "regular" ? (
          <>
            <strong className="text-gray-900 dark:text-white">Regular discounts</strong> are the
            standing longer-cycle savings. They apply when no launch offer is running.
          </>
        ) : (
          <>
            <strong className="text-gray-900 dark:text-white">Launch discounts</strong> are the
            current offer and override the regular card while it is live. Every coupon is
            duration forever, so whoever buys on one keeps that rate at each renewal until it
            is removed from their subscription.
          </>
        )}
      </div>

      <details className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] mb-6 group">
        <summary className="px-5 py-3.5 cursor-pointer font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white select-none list-none flex items-center gap-2">
          <span className="text-[#2B50DC] dark:text-[#5B8DEF] group-open:rotate-45 transition-transform inline-block">
            +
          </span>
          Create a {kind} coupon
        </summary>
        <form action={createCoupon} className="px-5 pb-5 pt-2 border-t border-black/8 dark:border-white/8 flex flex-col gap-4 max-w-[640px]">
          <input type="hidden" name="kind" value={kind} />

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Code" hint="Letters, numbers and hyphens. Shown in links.">
              <input name="code" required placeholder="LAUNCH-YEARLY-50" className={INPUT} />
            </F>
            <F label="Discount" hint={`Common for ${kind}: ${PRESETS[kind].join(", ")}%`}>
              <input
                name="percent_off"
                type="number"
                min={1}
                max={100}
                step="0.01"
                required
                className={INPUT}
              />
            </F>
          </div>

          <F label="Name" hint="For your reference in Stripe and here.">
            <input name="name" placeholder={`${kind} offer`} className={INPUT} />
          </F>

          <div className="grid sm:grid-cols-3 gap-4">
            <F label="Billing cycle" hint="Blank means any cycle.">
              <select name="cycle_key" className={INPUT} defaultValue="">
                <option value="">Any cycle</option>
                {Object.entries(CYCLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </F>
            <F label="Max redemptions" hint="Blank for unlimited.">
              <input name="max_redemptions" type="number" min={1} className={INPUT} />
            </F>
            <F label="Expires" hint="Blank for never.">
              <input name="redeem_by" type="date" className={INPUT} />
            </F>
          </div>

          <label className="flex items-start gap-2.5 text-[13px] text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" name="auto_apply" className="mt-0.5 accent-[#2B50DC]" />
            <span>
              <strong className="text-gray-900 dark:text-white">Apply automatically</strong>
              <span className="block text-[12px] text-gray-500 leading-relaxed">
                Applies at checkout for its cycle with no code typed. Needs a cycle, and only
                one automatic {kind} coupon can exist per cycle at a time.
              </span>
            </span>
          </label>

          <button
            type="submit"
            className="btn gradient-bg text-white px-6 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0 self-start"
          >
            Create in Stripe and here
          </button>
        </form>
      </details>

      <Table head={["Code", "Off", "Cycle", "Applies", "Used", "Status", ""]}>
        {rows.length === 0 && (
          <EmptyRow cols={7}>No {kind} coupons yet.</EmptyRow>
        )}
        {rows.map((c) => (
          <Row key={c.id}>
            <Cell strong>
              <span className="font-mono text-[12.5px]">{c.code}</span>
              <span className="block font-normal text-[11.5px] text-gray-500 mt-0.5">{c.name}</span>
            </Cell>
            <Cell>
              <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                {Number(c.percent_off)}%
              </span>
            </Cell>
            <Cell>{c.cycle_key ? CYCLE_LABELS[c.cycle_key] : "any"}</Cell>
            <Cell>
              {c.auto_apply ? (
                <span className="text-[#2B50DC] dark:text-[#5B8DEF]">automatically</span>
              ) : (
                <span className="text-gray-500">by link or code</span>
              )}
            </Cell>
            <Cell>
              {c.times_redeemed}
              {c.max_redemptions ? ` of ${c.max_redemptions}` : ""}
              {c.redeem_by && (
                <span className="block text-[11px] text-gray-400">until {c.redeem_by}</span>
              )}
            </Cell>
            <Cell>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.1em] border px-2 py-0.5 ${
                  c.is_active
                    ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-400"
                    : "border-gray-400/40 text-gray-500"
                }`}
              >
                {c.is_active ? "active" : "off"}
              </span>
              {!c.stripe_coupon_id && (
                <span className="block font-mono text-[9.5px] uppercase text-rose-600 mt-1">
                  not in stripe
                </span>
              )}
            </Cell>
            <Cell>
              <div className="flex flex-col items-start gap-1.5">
                <CopyLink path={`/checkout?plan=growth&cycle=${c.cycle_key ?? "yearly"}&code=${c.code}`} label="Link" />
                <form action={toggleCoupon}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={String(!c.is_active)} />
                  <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-[#2B50DC] cursor-pointer bg-transparent border-0 p-0">
                    {c.is_active ? "Turn off" : "Turn on"}
                  </button>
                </form>
                <form action={deleteCoupon}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-rose-500 cursor-pointer bg-transparent border-0 p-0">
                    Delete
                  </button>
                </form>
              </div>
            </Cell>
          </Row>
        ))}
      </Table>
    </div>
  );
}

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      {hint && <span className="text-[11.5px] text-gray-500 -mt-1">{hint}</span>}
      {children}
    </label>
  );
}
