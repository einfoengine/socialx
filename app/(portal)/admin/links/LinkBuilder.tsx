"use client";

import { useMemo, useState } from "react";
import CopyLink from "@/components/portal/CopyLink";

type Plan = { key: string; name: string; id: string };
type Price = { planId: string; cycle: string; total: number; monthly: number };
type Coupon = {
  code: string; name: string; kind: string;
  percentOff: number; cycle: string | null; auto: boolean;
};

const CYCLES = [
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["half", "Half yearly"],
  ["yearly", "Yearly"],
] as const;

const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, half: 6, yearly: 12 };
const money = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

/**
 * Builds a checkout link and shows exactly what the buyer will be charged.
 *
 * The preview is the point. Sending a link without knowing what it charges is how
 * somebody ends up promising one number and Stripe taking another.
 */
export default function LinkBuilder({
  plans,
  prices,
  coupons,
}: {
  plans: Plan[];
  prices: Price[];
  coupons: Coupon[];
}) {
  const [plan, setPlan] = useState(plans[1]?.key ?? plans[0]?.key ?? "growth");
  const [cycle, setCycle] = useState("yearly");
  const [code, setCode] = useState("");

  const planRow = plans.find((p) => p.key === plan);
  const price = prices.find((p) => p.planId === planRow?.id && p.cycle === cycle);

  /* Which coupon actually applies: a typed code beats the standing offer. */
  const applied = useMemo(() => {
    if (code) {
      const c = coupons.find((x) => x.code === code);
      if (!c) return null;
      if (c.cycle && c.cycle !== cycle) return null;
      return c;
    }
    return coupons.find((c) => c.auto && c.kind === "launch" && c.cycle === cycle) ?? null;
  }, [code, coupons, cycle]);

  const total = price ? Math.round(price.total * (1 - (applied?.percentOff ?? 0) / 100)) : 0;
  const saving = price ? price.total - total : 0;

  const path =
    `/checkout?plan=${plan}&cycle=${cycle}` + (code ? `&code=${encodeURIComponent(code)}` : "");

  const mismatch = Boolean(code && !applied);

  return (
    <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Field label="Package">
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={INPUT}>
            {plans.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Billing cycle">
          <select value={cycle} onChange={(e) => setCycle(e.target.value)} className={INPUT}>
            {CYCLES.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Coupon code">
          <select value={code} onChange={(e) => setCode(e.target.value)} className={INPUT}>
            <option value="">Whatever is running today</option>
            {coupons.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.percentOff}% off{c.cycle ? `, ${c.cycle}` : ""})
              </option>
            ))}
          </select>
        </Field>
      </div>

      {mismatch && (
        <div className="border border-amber-500/50 bg-amber-500/6 p-3 mb-4 text-[12.5px] text-amber-800 dark:text-amber-300">
          That code is for a different billing cycle, so it would be ignored and the buyer
          would pay whatever is running today. Change the cycle or pick another code.
        </div>
      )}

      {price && (
        <div className="border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/3 p-4 mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 mb-3">
            What the buyer sees
          </div>
          <div className="flex flex-col gap-1.5 text-[13.5px] max-w-[340px]">
            <Line k="List price" v={money(price.total)} />
            {applied ? (
              <Line
                k={`Discount, ${applied.percentOff}% off`}
                v={`-${money(saving)}`}
                tone="good"
              />
            ) : (
              <Line k="Discount" v="none" muted />
            )}
            <div className="h-px bg-black/10 dark:bg-white/10 my-1" />
            <Line k="Charged" v={money(total)} strong />
            <Line
              k="Works out at"
              v={`${money(Math.round(total / (MONTHS[cycle] ?? 1)))}/mo`}
              muted
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <CopyLink path={path} label="Copy link" full />
      </div>
    </div>
  );
}

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Line({
  k, v, strong, muted, tone,
}: {
  k: string; v: string; strong?: boolean; muted?: boolean; tone?: "good";
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 dark:text-gray-500">{k}</span>
      <span
        className={
          tone === "good"
            ? "text-emerald-700 dark:text-emerald-400 font-medium"
            : strong
              ? "font-grotesk font-semibold text-gray-900 dark:text-white"
              : muted
                ? "text-gray-400"
                : "text-gray-900 dark:text-white"
        }
      >
        {v}
      </span>
    </div>
  );
}
