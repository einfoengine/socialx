"use client";

import { useState } from "react";

type Period = "monthly" | "quarterly" | "halfyearly" | "yearly";

const PERIODS: { key: Period; label: string; savings: string | null; months: number }[] = [
  { key: "monthly",    label: "Monthly",     savings: null,   months: 1  },
  { key: "quarterly",  label: "Quarterly",   savings: "−5%",  months: 3  },
  { key: "halfyearly", label: "Half-Yearly", savings: "−10%", months: 6  },
  { key: "yearly",     label: "Yearly",      savings: "−20%", months: 12 },
];

const TIERS = [
  {
    name: "Starter",
    tagline: "Show up consistently. Look professional. Without the agency price tag.",
    prices: { monthly: 197, quarterly: 187, halfyearly: 177, yearly: 158 },
    cta: "Start with Starter",
    featured: false,
    featuresLabel: "What you get",
    features: [
      { text: "8 customized posts/month (2 per week)", hi: true },
      { text: "2 platforms of your choice", hi: true },
      { text: "Light customization — brand, CTAs, voice basics" },
      { text: "Scheduled to your HL Social Planner" },
      { text: "First batch in 7 days" },
      { text: "1 revision round per batch" },
    ],
  },
  {
    name: "Growth",
    tagline: "Library posts plus custom content and motion videos about your actual business.",
    prices: { monthly: 397, quarterly: 377, halfyearly: 357, yearly: 318 },
    cta: "Start with Growth",
    featured: true,
    featuresLabel: "Everything in Starter, plus",
    features: [
      { text: "16 posts/month — 12 library + 2 custom + 2 motion videos", hi: true },
      { text: "2 motion videos (30+ sec) per month", hi: true, video: true },
      { text: "3 platforms — LinkedIn, Facebook, Instagram", hi: true },
      { text: "Full voice adaptation plus client examples" },
      { text: "Custom posts: wins, onboardings, milestones" },
      { text: "First batch in 5 days" },
      { text: "2 revision rounds per batch" },
      { text: "Monthly 30-min content review call", hi: true },
    ],
  },
  {
    name: "Scale",
    tagline: "Daily presence, full personalization, your choice of 4th platform. Agency-grade.",
    prices: { monthly: 597, quarterly: 567, halfyearly: 537, yearly: 478 },
    cta: "Start with Scale",
    featured: false,
    featuresLabel: "Everything in Growth, plus",
    features: [
      { text: "30 posts/month — 22 library + 4 custom + 4 motion videos", hi: true },
      { text: "4 motion videos (30+ sec) per month", hi: true, video: true },
      { text: "4 platforms — LI + FB + IG + TikTok or X", hi: true },
      { text: "Heavy customization, full personalization" },
      { text: "First batch in 3 days — priority queue" },
      { text: "Unlimited revisions" },
      { text: "Real-time content for wins and feedback" },
      { text: "Monthly 30-min content review call", hi: true },
    ],
  },
];

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function priceNote(tier: (typeof TIERS)[0], period: Period, months: number) {
  const cur = tier.prices[period];
  const total = cur * months;
  if (period === "monthly") return "Billed monthly. Cancel anytime.";
  const suffix: Record<Exclude<Period, "monthly">, string> = {
    quarterly:  `$${fmt(total)} billed every 3 months.`,
    halfyearly: `$${fmt(total)} billed every 6 months.`,
    yearly:     `$${fmt(total)} billed annually.`,
  };
  return suffix[period as Exclude<Period, "monthly">];
}

export default function Pricing() {
  const [period, setPeriod] = useState<Period>("monthly");
  const cfg = PERIODS.find((p) => p.key === period)!;

  return (
    <section id="gw-pricing" className="py-32 md:py-40 bg-white dark:bg-[#050508] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="section-eyebrow">[ Pricing ]</div>
          <h2 className="section-title">
            Pick your tier.<br />Cancel anytime.
          </h2>
          <p className="section-sub mb-16">
            Plans start at $197. No setup fee. No long-term contracts. Discount
            when you commit to longer cycles.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex flex-col items-center gap-4 mb-14">
          <div className="font-grotesk text-[13px] text-gray-400 uppercase tracking-[1.2px] font-medium">
            Billing cycle
          </div>
          <div
            className="inline-flex items-center p-1.5 rounded-[3px] flex-wrap justify-center gap-1 bg-black/4 dark:bg-white/4 border border-black/7 dark:border-white/8 transition-colors duration-300"
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`font-grotesk text-sm font-medium px-5 py-2.5 rounded-[3px] flex items-center gap-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  period === p.key
                    ? "bg-[#111118] text-white dark:bg-white dark:text-[#111118] shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    : "bg-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {p.label}
                {p.savings && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-[3px] transition-colors duration-200 ${
                      period === p.key
                        ? "bg-white/15 text-white/90 dark:bg-black/10 dark:text-black/80"
                        : "bg-[#2B50DC]/10 text-[#2B50DC] dark:bg-[#2B50DC]/20 dark:text-[#5B8DEF]"
                    }`}
                  >
                    {p.savings}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="grid lg:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto lg:max-w-none">
          {TIERS.map((tier, i) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-none p-10 transition-all duration-300 hover:-translate-y-1 animate-fade-up ${
                tier.featured
                  ? "gradient-bg border-none shadow-[0_24px_64px_rgba(43,80,220,0.35)] scale-[1.03]"
                  : "bg-white dark:bg-[#111118] border border-black/8 dark:border-white/8 shadow-sm dark:shadow-md scale-100"
              }`}
              style={{
                animationDelay: `${i * 0.1 + 0.05}s`,
              }}
            >
              {tier.featured && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 font-grotesk text-[12px] font-semibold px-4 py-1.75 rounded-[3px] tracking-[0.8px] uppercase whitespace-nowrap bg-[#111118] dark:bg-white text-white dark:text-[#111118] transition-colors duration-300"
                >
                  Most Popular
                </div>
              )}

              <div
                className={`font-grotesk text-sm font-medium uppercase tracking-[1.5px] mb-2 ${
                  tier.featured ? "text-white/80" : "text-[#2B50DC] dark:text-[#5B8DEF]"
                }`}
              >
                {tier.name}
              </div>
              <div
                className={`text-[15px] leading-relaxed mb-8 ${
                  tier.featured ? "text-white/70" : "text-gray-600 dark:text-gray-400"
                }`}
                style={{
                  minHeight: "70px",
                }}
              >
                {tier.tagline}
              </div>

              {/* Price block */}
              <div className="mb-7" style={{ minHeight: "120px" }}>
                {period !== "monthly" && (
                  <div
                    className={`font-grotesk text-base line-through mb-1 ${
                      tier.featured ? "text-white/40" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    ${fmt(tier.prices.monthly)}/month
                  </div>
                )}
                <div className="flex items-baseline gap-1.5 mb-1.5">
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
                    style={{
                      fontSize: "64px",
                      letterSpacing: "-2px",
                    }}
                  >
                    {fmt(tier.prices[period])}
                  </span>
                  <span
                    className={`font-grotesk text-base ${
                      tier.featured ? "text-white/60" : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    /month
                  </span>
                </div>
                <div
                  className={`font-grotesk text-sm ${
                    tier.featured ? "text-white/50" : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {priceNote(tier, period, cfg.months)}
                </div>
              </div>

              {/* CTA */}
              <button
                className={`w-full py-4 rounded-[3px] font-grotesk font-semibold text-[15px] mb-8 transition-transform hover:-translate-y-0.5 cursor-pointer ${
                  tier.featured
                    ? "bg-white text-[#111118] hover:bg-gray-100"
                    : "bg-[#111118] text-white hover:bg-black dark:bg-white dark:text-[#111118] dark:hover:bg-gray-100"
                }`}
              >
                {tier.cta}
              </button>

              {/* Features */}
              <div
                className={`h-px mb-6 ${
                  tier.featured ? "bg-white/20" : "bg-black/7 dark:bg-white/8"
                }`}
              />
              <div
                className={`font-grotesk text-[11px] uppercase tracking-[1.2px] font-medium mb-4 ${
                  tier.featured ? "text-white/50" : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {tier.featuresLabel}
              </div>
              <ul className="flex flex-col gap-3 flex-1">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-[15px] leading-relaxed">
                    <span
                      className={`shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        tier.featured
                          ? "bg-white/20 text-white"
                          : "bg-[#2B50DC]/10 dark:bg-[#2B50DC]/20 text-[#2B50DC] dark:text-[#5B8DEF]"
                      }`}
                    >
                      {f.video ? "▶" : "✓"}
                    </span>
                    <span
                      className={`${
                        tier.featured
                          ? f.hi ? "text-white" : "text-white/75"
                          : f.hi ? "text-[#2B50DC] dark:text-[#5B8DEF]" : "text-gray-700 dark:text-gray-300"
                      } ${f.hi ? "font-medium" : "font-normal"}`}
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
