"use client";
 
import { useState } from "react";
 
type Period = "monthly" | "quarterly" | "halfyearly" | "yearly";
 
const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: "monthly",    label: "Monthly",     months: 1  },
  { key: "quarterly",  label: "Quarterly",   months: 3  },
  { key: "halfyearly", label: "Half-Yearly", months: 6  },
  { key: "yearly",     label: "Yearly",      months: 12 },
];
 
const TIERS = [
  {
    name: "Starter",
    tagline: "Show up consistently and look professional, without the agency price tag.",
    baseMonthlyPrice: 197,
    cta: "Start with Starter",
    featured: false,
    customization: {
      level: "Light customization",
      desc: "Your logo, colors, and CTAs dropped into proven, feature-targeted posts. Strong copy, wearing your brand."
    },
    features: [
      { text: "8 posts per month (2 per week)", hi: true },
      { text: "2 platforms of your choice", hi: true },
      { text: "Scheduled to your HL Social Planner" },
      { text: "1 revision round per batch" },
      { text: "First batch live in 7 days" },
    ],
  },
  {
    name: "Growth",
    tagline: "Content that sounds like you and speaks to your niche, plus custom posts and motion video.",
    baseMonthlyPrice: 397,
    cta: "Start with Growth",
    featured: true,
    customization: {
      level: "Heavy customization",
      desc: "Rewritten in your voice, angled to your niche and the exact services your SaaS sells, with your positioning woven in. Tailored, not templated."
    },
    features: [
      { text: "16 posts per month (12 library, 2 custom, 2 motion videos)", hi: true },
      { text: "2 motion videos, around 30 seconds", hi: true, video: true },
      { text: "3 platforms: LinkedIn, Facebook, Instagram", hi: true },
      { text: "Custom posts for wins, onboardings, milestones" },
      { text: "2 revision rounds per batch" },
      { text: "Monthly 30-minute content review call", hi: true },
      { text: "First batch live in 7 days" },
    ],
  },
  {
    name: "Scale",
    tagline: "A content partner that works from your business, not a template library. Daily presence, fully bespoke.",
    baseMonthlyPrice: 597,
    cta: "Start with Scale",
    featured: false,
    customization: {
      level: "Built around your business",
      desc: "No fixed formula. We study your offer and audience, then decide post by post: rebuild a library piece completely for you, or write one from scratch. Whatever sells your software best."
    },
    features: [
      { text: "24 posts per month (20 static, 4 motion videos), built bespoke for you", hi: true },
      { text: "Motion videos run around 30 seconds", hi: true, video: true },
      { text: "4 platforms: LinkedIn, Facebook, Instagram, plus TikTok or X", hi: true },
      { text: "Real-time content for launches, wins, and feedback" },
      { text: "Unlimited revisions" },
      { text: "Monthly 30-minute strategy call", hi: true },
      { text: "First batch live in 5 days, priority queue" },
    ],
  },
];

function fmt(n: number) {
  return n.toLocaleString("en-US");
}
 
function getDiscountPercent(period: Period, isLaunch: boolean): number {
  if (isLaunch) {
    const launchDiscounts: Record<Period, number> = {
      monthly: 0,
      quarterly: 0.30,
      halfyearly: 0.40,
      yearly: 0.50,
    };
    return launchDiscounts[period];
  } else {
    const regularDiscounts: Record<Period, number> = {
      monthly: 0,
      quarterly: 0.05,
      halfyearly: 0.10,
      yearly: 0.20,
    };
    return regularDiscounts[period];
  }
}
 
/**
 * What a tier actually costs on a given cycle.
 *
 * The catalog holds LIST prices, and the discount is a Stripe coupon applied at
 * checkout, so the arithmetic here has to match: the percentage comes off the
 * cycle total, not off a rounded monthly figure. Rounding the monthly rate first
 * and multiplying would disagree with Stripe on every discounted combination,
 * which is a number on the page the card is not charged.
 */
function getPricing(baseMonthly: number, period: Period, isLaunch: boolean) {
  const months = PERIODS.find((p) => p.key === period)?.months ?? 1;
  const pct = getDiscountPercent(period, isLaunch);
  const listTotal = baseMonthly * months;
  const total = Math.round(listTotal * (1 - pct) * 100) / 100;
  return {
    months,
    pct,
    listTotal,
    total,
    perMonth: total / months,
    saving: listTotal - total,
  };
}

/** Whole dollars stay whole; a discount that lands on cents shows them. */
function price(n: number) {
  return Number.isInteger(n) ? fmt(n) : n.toFixed(2);
}

function getCycleNote(period: Period) {
  const notes: Record<Period, string> = {
    monthly: "billed monthly",
    quarterly: "billed quarterly",
    halfyearly: "billed half-yearly",
    yearly: "billed yearly",
  };
  return notes[period];
}
 
export default function Pricing() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [showLaunchDiscount, setShowLaunchDiscount] = useState<boolean>(true);
 
  return (
    <section id="gw-pricing" className="py-32 md:py-40 bg-white dark:bg-[#050508] transition-colors duration-300">
      <div data-reveal className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="section-eyebrow text-[#3D4AFF] dark:text-[#00A3FF] transition-colors duration-300">[ Pricing ]</div>
          <h2 className="section-title text-gray-900 dark:text-white font-grotesk text-3xl md:text-5xl font-bold tracking-tight mb-6 transition-colors duration-300">
            Pick your tier. <span className="gradient-text">Cancel anytime</span>.
          </h2>
          <p className="section-sub text-gray-600 dark:text-white/70 max-w-3xl mx-auto font-body text-[16px] md:text-[18px] leading-relaxed transition-colors duration-300">
            Every plan is customized to your brand and scheduled into your HL Social Planner for you. The higher the tier, the deeper we tailor: from <strong>brand-matched posts</strong>, to content <strong>rewritten in your voice</strong>, to a <strong>fully bespoke feed</strong> built around your business.
          </p>
        </div>
 
        {/* Launch Promotion Callout & Toggle */}
        <div className="flex flex-col items-center gap-3 mb-12 text-center animate-fade-up">
          <div className="font-grotesk text-[13px] font-bold tracking-[1.5px] uppercase text-rose-500 dark:text-rose-400 flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 bg-rose-500"></span>
            </span>
            Hey, our launching mega offer is going on.
          </div>
          
          <div className="inline-flex items-center p-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 shadow-inner">
            <button
              onClick={() => setShowLaunchDiscount(false)}
              className={`font-grotesk text-xs font-semibold px-5 py-2.5 transition-all duration-200 cursor-pointer whitespace-nowrap ${
                !showLaunchDiscount
                  ? "bg-[#04044A] text-white dark:bg-white dark:text-[#04044A] shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
                  : "bg-transparent text-gray-500 hover:text-gray-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/8"
              }`}
            >
              Regular
            </button>
            <button
              onClick={() => setShowLaunchDiscount(true)}
              className={`font-grotesk text-xs font-semibold px-5 py-2.5 transition-all duration-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                showLaunchDiscount
                  ? "bg-gradient-to-r from-[#3D4AFF] to-[#00A3FF] text-white shadow-[0_2px_6px_rgba(61,74,255,0.3)]"
                  : "bg-transparent text-gray-500 hover:text-gray-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/8"
              }`}
            >
              🚀 Launch Offer
            </button>
          </div>
        </div>
 
        {/* Billing cycle tabs */}
        <div className="flex flex-col items-center gap-4 mb-20">
          <div className="font-grotesk text-[13px] text-gray-400 dark:text-gray-500 uppercase tracking-[1.2px] font-semibold">
            Billing cycle
          </div>
          <div
            className="inline-flex items-center p-1.5 flex-wrap justify-center gap-1 bg-black/4 dark:bg-white/4 border border-black/7 dark:border-white/8 transition-colors duration-300"
          >
            {PERIODS.map((p) => {
              const discountPercent = getDiscountPercent(p.key, showLaunchDiscount);
              return (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`font-grotesk text-sm font-medium px-5 py-2.5 flex items-center gap-2.5 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                    period === p.key
                      ? "bg-[#04044A] text-white dark:bg-white dark:text-[#04044A] shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                      : "bg-transparent text-gray-500 hover:text-gray-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/8"
                  }`}
                >
                  {p.label}
                  {discountPercent > 0 && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 transition-colors duration-200 ${
                        period === p.key
                          ? "bg-white/15 text-white/90 dark:bg-black/10 dark:text-black/80"
                          : "bg-[#3D4AFF]/10 text-[#3D4AFF] dark:bg-[#3D4AFF]/20 dark:text-[#00A3FF]"
                      }`}
                    >
                      {Math.round(discountPercent * 100)}% off
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
 
        {/* Cards Grid */}
        <div className="grid lg:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto lg:max-w-none">
          {TIERS.map((tier, i) => {
            const p = getPricing(tier.baseMonthlyPrice, period, showLaunchDiscount);
            const discountPercent = p.pct;
            const hasDiscount = discountPercent > 0;
 
            return (
              <div
                key={tier.name}
                className={`relative flex flex-col p-8 md:p-10 transition-all duration-300 hover:-translate-y-1 animate-fade-up ${
                  tier.featured
                    ? "gradient-bg border-none shadow-[0_24px_64px_rgba(61,74,255,0.35)] scale-[1.03]"
                    : "bg-white dark:bg-[#04044A] border border-black/8 dark:border-white/8 shadow-sm dark:shadow-md scale-100"
                }`}
                style={{
                  animationDelay: `${i * 0.1 + 0.05}s`,
                }}
              >
                {tier.featured && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 font-grotesk text-[12px] font-semibold px-4 py-1.75 tracking-[0.8px] uppercase whitespace-nowrap bg-[#04044A] dark:bg-white text-white dark:text-[#04044A] transition-colors duration-300"
                  >
                    Most Popular
                  </div>
                )}
 
                {/* Header info */}
                <div
                  className={`font-grotesk text-sm font-semibold uppercase tracking-[1.5px] mb-2.5 ${
                    tier.featured ? "text-white/80" : "text-[#3D4AFF] dark:text-[#00A3FF]"
                  }`}
                >
                  {tier.name}
                </div>
                <div
                  className={`text-[14.5px] leading-relaxed mb-6 font-body ${
                    tier.featured ? "text-white/70" : "text-gray-600 dark:text-gray-400"
                  }`}
                  style={{
                    minHeight: "48px",
                  }}
                >
                  {tier.tagline}
                </div>
 
                {/* Price block */}
                <div className="mb-7 flex flex-col justify-end" style={{ minHeight: "105px" }}>
                  {hasDiscount ? (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`font-grotesk text-sm line-through ${
                          tier.featured ? "text-white/40" : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        ${fmt(tier.baseMonthlyPrice)}/month
                      </span>
                      <span
                        className={`font-grotesk text-[10px] font-bold px-2 py-0.5 uppercase tracking-[0.5px] ${
                          tier.featured
                            ? "bg-white text-[#3D4AFF]"
                            : "bg-rose-500 text-white"
                        }`}
                      >
                        {Math.round(discountPercent * 100)}% OFF
                      </span>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span
                      className={`font-grotesk text-2xl font-medium ${
                        tier.featured ? "text-white/70" : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      $
                    </span>
                    <span
                      className={`font-grotesk font-semibold leading-none ${
                        tier.featured ? "text-white" : "text-gray-900 dark:text-white"
                      }`}
                      style={{ fontSize: "60px", letterSpacing: "-2px" }}
                    >
                      {price(p.perMonth)}
                    </span>
                    <span
                      className={`font-grotesk text-base ${
                        tier.featured ? "text-white/60" : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      /mo
                    </span>
                  </div>
                  <div
                    className={`font-grotesk text-xs uppercase tracking-[0.5px] ${
                      tier.featured ? "text-white/50" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {p.months === 1 ? (
                      getCycleNote(period)
                    ) : (
                      <>
                        ${price(p.total)} {getCycleNote(period)}
                      </>
                    )}
                  </div>
                  {/* The saving, stated in money. A percentage is an argument;
                      a dollar figure is the thing they keep. */}
                  {hasDiscount && (
                    <div
                      className={`font-grotesk text-[12.5px] font-semibold mt-1.5 ${
                        tier.featured ? "text-cyan-300" : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      You save ${price(p.saving)}
                    </div>
                  )}
                </div>

                {/* Customization Level Box */}
                <div className={`mb-8 p-5 border transition-colors duration-300 ${
                  tier.featured
                    ? "bg-white/10 border-white/10"
                    : "bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5"
                }`}>
                  <div className={`flex items-center gap-1.5 font-grotesk text-[12px] font-bold uppercase tracking-[0.8px] ${
                    tier.featured ? "text-white" : "text-gray-900 dark:text-white"
                  }`}>
                    <span className={`w-1.5 h-1.5 ${
                      tier.featured ? "bg-cyan-300 animate-pulse" : "bg-[#3D4AFF]"
                    }`} />
                    {tier.customization.level}
                  </div>
                  <p className={`text-[12.5px] leading-relaxed mt-2 font-body ${
                    tier.featured ? "text-white/85" : "text-gray-500 dark:text-gray-400"
                  }`}>
                    {tier.customization.desc}
                  </p>
                </div>
 
                {/* CTA Button */}
                {/* Straight to socialX's own checkout. The link carries a tier
                    and a cycle, never a price, so it cannot be edited into a
                    different amount. */}
                <a
                  href={`/checkout?plan=${tier.name.toLowerCase()}&cycle=${period}`}
                  className={`btn w-full py-4 text-center font-grotesk font-semibold text-[15px] mb-8 block no-underline ${
                    tier.featured
                      ? "btn-light bg-white text-[#04044A]"
                      : "btn-ink bg-[#04044A] text-white dark:bg-white dark:text-[#04044A]"
                  }`}
                >
                  {tier.cta}
                </a>

                {/* Features List */}
                <div
                  className={`h-px mb-6 ${
                    tier.featured ? "bg-white/20" : "bg-black/7 dark:bg-white/8"
                  }`}
                />
                <ul className="flex flex-col gap-3.5 flex-1">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3.5 text-[14.5px] leading-relaxed font-body">
                      <span className="shrink-0 mt-0.5">
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2.4" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          className={`w-4.5 h-4.5 ${
                            tier.featured
                              ? "text-cyan-300"
                              : "text-blue-neon dark:text-blue-sky"
                          }`}
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                      <span
                        className={`${
                          tier.featured
                            ? f.hi ? "text-white" : "text-white/80"
                            : f.hi ? "text-[#3D4AFF] dark:text-[#00A3FF] font-medium" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
 
        {/* Footer info banner */}
        <p className="text-center mt-16 text-sm text-gray-500 dark:text-gray-400 font-body transition-colors">
          <span className="font-semibold text-gray-900 dark:text-white">No setup fee. No contracts. Cancel anytime.</span>
          &nbsp;&nbsp;&nbsp;&nbsp;Longer billing cycles save you up to {showLaunchDiscount ? "50%" : "20%"}.
        </p>
      </div>
    </section>
  );
}
