"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { BadgePercent, Check, Loader2, Lock, ShieldCheck } from "lucide-react";

type Include = { text: string; highlight?: boolean };
type Cycle = { key: string; listTotal: number; monthly: number };
type Coupon = { code: string; percentOff: number } | null;
type Amounts = {
  listTotal: number; total: number; coupon: Coupon; autoApplied?: boolean;
  addonTotal?: number; dueToday?: number;
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half: "Half yearly",
  yearly: "Yearly",
};
const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, half: 6, yearly: 12 };
const ORDER = ["monthly", "quarterly", "half", "yearly"];

/**
 * The discount that applies to one rung of the ladder.
 *
 * For the cycle currently selected the server has already priced it, including a
 * typed code, so that answer wins. Every other rung shows the standing offer,
 * because a code for one cycle says nothing about another.
 */
function discountFor(
  c: string,
  discounts: { cycle: string; percentOff: number }[],
  amounts: Amounts,
  selectedCycle: string,
  removed: boolean
): number {
  if (removed) return 0;
  if (c === selectedCycle) return amounts.coupon?.percentOff ?? 0;
  return discounts.find((d) => d.cycle === c)?.percentOff ?? 0;
}

const money = (c: number) =>
  `$${(c / 100).toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export default function CheckoutClient(props: {
  planKey: string;
  planName: string;
  tagline: string;
  includes: Include[];
  entitlements: {
    posts: number; motion: number; platforms: number;
    revisions: number | null; firstBatchDays: number;
  } | null;
  cycles: Cycle[];
  addons: { key: string; name: string; description: string; amount: number }[];
  firstBatchDays: number;
  discounts: { cycle: string; percentOff: number }[];
  initialCycle: string;
  initialCode: string | null;
  initial: Amounts;
  publishableKey: string;
}) {
  const [cycle, setCycle] = useState(props.initialCycle);
  const [code, setCode] = useState(props.initialCode ?? "");
  const [amounts, setAmounts] = useState<Amounts>(props.initial);
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [showCodeField, setShowCodeField] = useState(Boolean(props.initialCode));
  const [addons, setAddons] = useState<string[]>([]);

  /*
   * The ladder never goes below what they arrived on.
   *
   * Somebody who clicked Yearly on the pricing page is not helped by being shown
   * Monthly here; it only invites them to commit less than they already decided
   * to. So the shortest cycle offered is the one they came in with, and anything
   * longer is shown with what it would save on top.
   */
  const anchorIndex = ORDER.indexOf(props.initialCycle);
  const ladder = ORDER.slice(anchorIndex < 0 ? 0 : anchorIndex);

  const stripePromise = useMemo(
    () => (props.publishableKey ? loadStripe(props.publishableKey) : null),
    [props.publishableKey]
  );

  /*
   * The summary is re-priced on the server whenever the cycle or the code
   * changes. Doing the arithmetic in the browser would mean the number a buyer
   * reads and the number Stripe charges come from two different places, which is
   * exactly the gap this whole pricing model exists to close.
   */
  const reprice = useCallback(
    async (nextCycle: string, nextCode: string, noDiscount = false, nextAddons?: string[]) => {
      setPricing(true);
      try {
        const res = await fetch("/api/checkout/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: props.planKey,
            cycle: nextCycle,
            code: nextCode || undefined,
            noDiscount,
            addons: nextAddons ?? addons,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not price that.");
        setAmounts({
          listTotal: data.listTotal,
          total: data.total,
          coupon: data.coupon,
          autoApplied: data.autoApplied,
          addonTotal: data.addonTotal ?? 0,
          dueToday: data.dueToday ?? data.total,
        });
        setCodeNote(
          data.codeRejected
            ? "That code does not apply to this billing cycle, so it has not been added."
            : data.coupon && nextCode
              ? `${data.coupon.code} applied.`
              : null
        );
      } catch {
        setCodeNote("Could not check that code. The price shown is unchanged.");
      } finally {
        setPricing(false);
      }
    },
    [props.planKey, addons]
  );

  const months = MONTHS[cycle] ?? 1;
  const saving = amounts.listTotal - amounts.total;
  const dueToday = amounts.dueToday ?? amounts.total;

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-10 grid lg:grid-cols-[1fr_400px] gap-8 items-start">
      {/* Payment */}
      <section className="order-2 lg:order-1">
        <h1 className="font-grotesk text-[30px] leading-[1.1] font-semibold tracking-[-1px] text-gray-900 dark:text-white mb-2">
          Your feed starts here.
        </h1>
        <p className="text-[15px] text-gray-600 dark:text-gray-400 mb-6 max-w-[54ch]">
          {props.planName}, billed {CYCLE_LABEL[cycle].toLowerCase()}. No setup fee, no contract,
          cancel anytime from your portal.
        </p>

        {/*
          What they get, on the left.
          It was in the summary panel, which pushed the total below the fold and
          left this column empty under the headline. It is reassurance rather than
          a decision, so it does not belong in the money panel at all.
        */}
        {props.includes.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-7 pb-7 border-b border-black/10 dark:border-white/10">
            {props.includes.map((i, n) => (
              <li key={n} className="flex gap-2 text-[13px] leading-relaxed">
                <Check size={14} className="mt-[3px] shrink-0 text-[#2B50DC] dark:text-[#5B8DEF]" />
                <span className={i.highlight ? "text-gray-900 dark:text-white font-medium" : "text-gray-600 dark:text-gray-400"}>
                  {i.text}
                </span>
              </li>
            ))}
          </ul>
        )}

        {stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{
              mode: "subscription",
              amount: amounts.total,
              currency: "usd",
              // Square corners and the brand blue, so the card fields belong to
              // the page rather than looking bolted on.
              appearance: {
                variables: {
                  colorPrimary: "#2B50DC",
                  borderRadius: "0px",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSizeBase: "14px",
                },
              },
            }}
          >
            <PayForm
              planKey={props.planKey}
              cycle={cycle}
              code={code}
              noDiscount={removed}
              addons={addons}
              total={dueToday}
              firstBatchDays={props.firstBatchDays}
              rushed={addons.includes("rush_first_batch")}
              disabled={pricing}
            />
          </Elements>
        ) : (
          <div className="border border-rose-500/40 bg-rose-500/5 p-4 text-[13.5px] text-rose-700 dark:text-rose-400">
            Payments are not configured in this environment.
          </div>
        )}
      </section>

      {/* Order summary */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-6">
        <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] shadow-[0_1px_2px_rgba(17,17,24,0.04),0_12px_32px_-12px_rgba(17,17,24,0.12)]">
          {/*
            The panel opens with what they are paying, not with a description they
            already read on the pricing page. Before this the total sat at the
            bottom of six stacked sections, below the fold on most screens, which
            is the one number a checkout exists to state.
          */}
          <div className="p-5 bg-[#111118] dark:bg-black text-white">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-white/50">
                Due today
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-white/50">
                {props.planName}, {CYCLE_LABEL[cycle].toLowerCase()}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 mt-1.5">
              <span className="font-grotesk text-[34px] font-semibold leading-none tracking-[-1.2px]">
                {pricing ? "..." : money(dueToday)}
              </span>
              {months > 1 && (
                <span className="text-[12px] text-white/60 text-right leading-tight">
                  {money(Math.round(amounts.total / months))}/mo
                </span>
              )}
            </div>
            {saving > 0 && (
              <div className="mt-2 pt-2 border-t border-white/12 text-[12.5px] font-semibold text-emerald-400">
                You save {money(saving)}
              </div>
            )}
          </div>

          <div className="p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-2.5">
              {ladder.length > 1 ? "Commit longer, pay less" : "Billing cycle"}
            </div>

            <div className="flex flex-col gap-1.5">
              {ladder.map((c) => {
                const row = props.cycles.find((x) => x.key === c);
                if (!row) return null;

                const months = MONTHS[c] ?? 1;
                const pct = discountFor(c, props.discounts, amounts, cycle, removed);
                const total = Math.round(row.listTotal * (1 - pct / 100));
                const perMonth = Math.round(total / months);
                const active = c === cycle;

                /* Against the cycle they are on now, so the number answers
                   "what do I get for going further" rather than "what is this". */
                const selectedRow = props.cycles.find((x) => x.key === cycle);
                const selectedPct = discountFor(cycle, props.discounts, amounts, cycle, removed);
                const selectedPerMonth = selectedRow
                  ? Math.round(
                      Math.round(selectedRow.listTotal * (1 - selectedPct / 100)) /
                        (MONTHS[cycle] ?? 1)
                    )
                  : perMonth;
                const better = selectedPerMonth - perMonth;

                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCycle(c);
                      void reprice(c, code, removed);
                    }}
                    className={`w-full border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                      active
                        ? "border-[#2B50DC] bg-[#2B50DC]/8"
                        : "border-black/12 dark:border-white/15 hover:border-[#2B50DC]/40"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={`font-grotesk text-[13.5px] font-semibold ${
                          active ? "text-[#2B50DC] dark:text-[#5B8DEF]" : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {CYCLE_LABEL[c]}
                      </span>
                      <span className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">
                        {money(perMonth)}
                        <span className="text-[11px] font-normal text-gray-500">/mo</span>
                      </span>
                    </span>
                    <span className="flex items-baseline justify-between gap-3 mt-0.5">
                      <span className="text-[11.5px] text-gray-500">
                        {months === 1 ? "billed monthly" : `${money(total)} every ${months} months`}
                      </span>
                      {better > 0 && !active && (
                        <span className="text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                          save {money(better)}/mo more
                        </span>
                      )}
                      {active && pct > 0 && (
                        <span className="text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {pct}% off applied
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {props.addons.length > 0 && (
            <div className="px-5 pb-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-2.5">
                Add to your order
              </div>
              {props.addons.map((a) => {
                const on = addons.includes(a.key);
                return (
                  <label
                    key={a.key}
                    className={`flex gap-3 border p-3.5 cursor-pointer transition-colors ${
                      on
                        ? "border-[#2B50DC] bg-[#2B50DC]/8"
                        : "border-black/12 dark:border-white/15 hover:border-[#2B50DC]/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...addons, a.key]
                          : addons.filter((k) => k !== a.key);
                        setAddons(next);
                        void reprice(cycle, removed ? "" : code, removed, next);
                      }}
                      className="mt-0.5 accent-[#2B50DC] shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-grotesk text-[13px] font-semibold text-gray-900 dark:text-white">
                          {a.name}
                        </span>
                        <span className="font-grotesk text-[12.5px] font-semibold text-[#2B50DC] dark:text-[#5B8DEF]">
                          Add {money(a.amount)}
                        </span>
                      </span>
                      <span className="block text-[11.5px] text-gray-600 dark:text-gray-400 leading-relaxed mt-0.5">
                        {a.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/*
            The applied discount, stated as a fact rather than left to be inferred
            from a smaller number. Before this, an automatic launch discount was
            indistinguishable from the price simply being what it is, which wastes
            the whole point of running an offer.
          */}
          {amounts.coupon && (
            <div className="mx-5 mb-5 border border-emerald-600/40 bg-emerald-600/8 px-4 py-3 flex items-start gap-2.5">
              <BadgePercent size={15} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="font-grotesk text-[12.5px] font-semibold text-emerald-800 dark:text-emerald-300 leading-snug">
                  {amounts.coupon.percentOff}% off applied
                </div>
                <div className="font-mono text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                  {amounts.coupon.code}
                </div>
                <div className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                  {amounts.autoApplied ? "Launch offer, applied automatically" : "Coupon code applied"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRemoved(true);
                  setCode("");
                  setCodeNote(null);
                  void reprice(cycle, "", true);
                }}
                className="font-mono text-[10px] uppercase tracking-[0.11em] text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer bg-transparent border-0 shrink-0 mt-0.5"
              >
                Remove
              </button>
            </div>
          )}

          {removed && !amounts.coupon && (
            <div className="mx-5 mb-5 border border-black/12 dark:border-white/15 px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1 text-[12.5px] text-gray-600 dark:text-gray-400">
                Discount removed. You are paying list price.
              </div>
              <button
                type="button"
                onClick={() => {
                  setRemoved(false);
                  void reprice(cycle, "", false);
                }}
                className="font-mono text-[10px] uppercase tracking-[0.11em] text-[#2B50DC] dark:text-[#5B8DEF] hover:underline cursor-pointer bg-transparent border-0 shrink-0"
              >
                Put it back
              </button>
            </div>
          )}

          <div className="px-5 pb-4 border-t border-black/8 dark:border-white/8 pt-4">
            {showCodeField ? (
              <>
                <label className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 block mb-2">
                  Coupon code
                </label>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Enter a code"
                    className="flex-1 min-w-0 bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-[13px] font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-[#2B50DC]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setRemoved(false);
                      void reprice(cycle, code, false);
                    }}
                    disabled={pricing || !code}
                    className="btn btn-ink bg-[#111118] dark:bg-white text-white dark:text-[#111118] px-4 py-2 font-grotesk text-[12.5px] font-semibold cursor-pointer border-0 disabled:opacity-40 shrink-0"
                  >
                    Apply
                  </button>
                </div>
                {codeNote && (
                  <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                    {codeNote}
                  </p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowCodeField(true)}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 hover:text-[#2B50DC] dark:hover:text-[#5B8DEF] cursor-pointer bg-transparent border-0 p-0"
              >
                Have a coupon code?
              </button>
            )}
          </div>

          <div className="px-5 pb-5">
            <div className="flex flex-col gap-1.5 text-[12.5px]">
              <Row k={`${CYCLE_LABEL[cycle]} list price`} v={money(amounts.listTotal)} muted />
              {amounts.coupon ? (
                <Row
                  k={`${amounts.coupon.percentOff}% off`}
                  v={`-${money(saving)}`}
                  tone="good"
                />
              ) : null}
              {props.addons
                .filter((a) => addons.includes(a.key))
                .map((a) => (
                  <Row key={a.key} k={a.name} v={money(a.amount)} muted />
                ))}
              <div className="h-px bg-black/10 dark:bg-white/10 my-1" />
              <Row k="Due today" v={pricing ? "..." : money(dueToday)} strong />
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-3 leading-relaxed">
              Renews at {money(amounts.total)} every{" "}
              {months === 1 ? "month" : `${months} months`} until you cancel.
              {(amounts.addonTotal ?? 0) > 0 && " Add-ons are charged once, today only."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 text-[11.5px] text-gray-500">
          <ShieldCheck size={13} className="shrink-0" />
          Card details go straight to Stripe. socialX never sees them.
        </div>
      </aside>
    </div>
  );
}

function Row({
  k, v, tone, muted, strong,
}: {
  k: string; v: string; tone?: "good"; muted?: boolean; strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className={strong ? "font-grotesk font-semibold text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-500"}>
        {k}
      </span>
      <span
        className={
          tone === "good"
            ? "text-emerald-700 dark:text-emerald-400 font-medium"
            : strong
              ? "font-grotesk font-semibold text-gray-900 dark:text-white"
              : muted
                ? "text-gray-600 dark:text-gray-400"
                : "text-gray-900 dark:text-white"
        }
      >
        {v}
      </span>
    </div>
  );
}

/* ---------------- the payment form ---------------- */

function PayForm({
  planKey, cycle, code, noDiscount, addons, total, firstBatchDays, rushed, disabled,
}: {
  planKey: string; cycle: string; code: string; noDiscount: boolean;
  addons: string[]; total: number; firstBatchDays: number; rushed: boolean;
  disabled: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();

  /* All four are required: the client account is created from exactly these. */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /* One subscription per attempt. Without this, a second click while the first is
     in flight creates a second incomplete subscription on the same customer. */
  const inFlight = useRef(false);

  /* Nothing is submittable until every required field has something in it, so the
     buyer finds out before the payment attempt rather than after. */
  const complete =
    fullName.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    company.trim().length >= 2 &&
    phone.replace(/[^0-9]/g, "").length >= 7;

  /*
   * A stale error must not survive a change of cycle or coupon: it would be
   * describing an attempt the buyer has already moved on from.
   *
   * Adjusted during render rather than in an effect. An effect would paint the
   * old error once before clearing it, which is a visible flicker on the one
   * screen where a red message costs the most confidence.
   */
  const inputKey = `${cycle}|${code}|${addons.join(",")}`;
  const [lastInputKey, setLastInputKey] = useState(inputKey);
  if (inputKey !== lastInputKey) {
    setLastInputKey(inputKey);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || inFlight.current) return;

    setError(null);
    setBusy(true);
    inFlight.current = true;

    try {
      const submit = await elements.submit();
      if (submit.error) throw new Error(submit.error.message ?? "Check the card details.");

      const res = await fetch("/api/checkout/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey, cycle, code: code || undefined, noDiscount, addons,
          email, fullName, company, phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the subscription.");

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/welcome?sub=${data.subscriptionId}`,
          payment_method_data: {
            billing_details: { email, name: fullName || company, phone: phone || undefined },
          },
        },
      });

      /*
       * Reaching here means the confirmation came back rather than redirecting,
       * which only happens on failure. A success leaves the page.
       */
      if (confirmError) throw new Error(confirmError.message ?? "That payment did not go through.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-4">
          Your details
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Your name"
            hint="Who we will be talking to."
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
            placeholder="Nathan Cole"
          />
          <Field
            label="Work email"
            hint="Your login and receipts go here."
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            placeholder="you@youragency.com"
          />
          <Field
            label="Company"
            hint="The brand we will be posting for."
            value={company}
            onChange={setCompany}
            autoComplete="organization"
            placeholder="FlowStack Pro"
          />
          <Field
            label="Phone"
            hint="Only for anything urgent about delivery."
            value={phone}
            onChange={setPhone}
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 000 0000"
          />
        </div>
        <p className="text-[11.5px] text-gray-500 dark:text-gray-500 mt-4 leading-relaxed">
          Your portal account is created from these the moment payment clears.
        </p>
      </div>

      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-4">
          Payment
        </div>
        <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs" }} />
        {!ready && (
          <div className="flex items-center gap-2 text-[12.5px] text-gray-500 py-4">
            <Loader2 size={14} className="animate-spin" />
            Loading secure payment fields
          </div>
        )}
      </div>

      {error && (
        <div className="border border-rose-500/40 bg-rose-500/5 p-4 text-[13px] text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || busy || disabled || !ready || !complete}
        className="btn gradient-bg text-white w-full max-w-[420px] py-4 font-grotesk font-semibold text-[15px] cursor-pointer border-0 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_8px_24px_-8px_rgba(43,80,220,0.6)]"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
        {busy ? "Processing" : `Pay ${money(total)} and start`}
      </button>

      {/*
        The trust rail. Every line is a fact the buyer can check, and the numbers
        obey the guardrails: 1000+ is the founding team's record through GHL Video,
        never socialX's own count, and the non-affiliation line is required
        wherever HighLevel is named.
      */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-gray-600 dark:text-gray-400">
        {[
          `$0 setup fee`,
          `No contract, cancel anytime`,
          `First batch in ${rushed ? 3 : firstBatchDays} days`,
        ].map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <Check size={13} className="shrink-0 text-[#2B50DC] dark:text-[#5B8DEF]" />
            {t}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-gray-500 dark:text-gray-500 pt-1 border-t border-black/8 dark:border-white/8">
        <span className="inline-flex items-center gap-1.5 pt-3">
          <ShieldCheck size={13} className="shrink-0" />
          Built by the team behind GHL Video, 1000+ HighLevel clients served
        </span>
        <span className="inline-flex items-center gap-1.5 pt-3">
          <Lock size={12} className="shrink-0" />
          Stripe secure
        </span>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-500 leading-relaxed">
        By paying you agree the subscription renews until cancelled. Cancel anytime from your
        portal, and delivery continues to the end of the period you paid for. socialX is not
        affiliated with, endorsed by, or sponsored by HighLevel, Inc.
      </p>
    </form>
  );
}

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

function Field({
  label, hint, value, onChange, type = "text", autoComplete, placeholder,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
  type?: string; autoComplete?: string; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      <input
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
      <span className="text-[11px] text-gray-500">{hint}</span>
    </label>
  );
}
