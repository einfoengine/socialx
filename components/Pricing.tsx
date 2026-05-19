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
    <section className="py-32 md:py-40" id="pricing" style={{ background: "white" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="section-eyebrow">[ Pricing ]</div>
          <h2 className="section-title">
            Pick your tier.<br />Cancel anytime.
          </h2>
          <p className="section-sub">
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
            className="inline-flex items-center p-1.5 rounded-full flex-wrap justify-center gap-1"
            style={{
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.07)",
            }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className="font-grotesk text-sm font-medium px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-200 whitespace-nowrap cursor-pointer"
                style={{
                  background: period === p.key ? "#111118" : "transparent",
                  color: period === p.key ? "white" : "#555560",
                  boxShadow: period === p.key ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {p.label}
                {p.savings && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: period === p.key ? "rgba(255,255,255,0.15)" : "rgba(43,80,220,0.1)",
                      color: period === p.key ? "rgba(255,255,255,0.9)" : "#2B50DC",
                    }}
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
              className="relative flex flex-col rounded-3xl p-10 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
              style={{
                animationDelay: `${i * 0.1 + 0.05}s`,
                background: tier.featured ? "var(--gradient-x)" : "white",
                border: tier.featured ? "none" : "1px solid rgba(0,0,0,0.08)",
                boxShadow: tier.featured
                  ? "0 24px 64px rgba(43,80,220,0.35)"
                  : "0 2px 16px rgba(0,0,0,0.05)",
                transform: tier.featured ? "scale(1.03)" : "scale(1)",
              }}
            >
              {tier.featured && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 font-grotesk text-[12px] font-semibold px-4 py-1.75 rounded-full tracking-[0.8px] uppercase whitespace-nowrap"
                  style={{ background: "#111118", color: "white" }}
                >
                  Most Popular
                </div>
              )}

              <div
                className="font-grotesk text-sm font-medium uppercase tracking-[1.5px] mb-2"
                style={{ color: tier.featured ? "rgba(255,255,255,0.8)" : "#2B50DC" }}
              >
                {tier.name}
              </div>
              <div
                className="text-[15px] leading-relaxed mb-8"
                style={{
                  color: tier.featured ? "rgba(255,255,255,0.7)" : "#55555E",
                  minHeight: "70px",
                }}
              >
                {tier.tagline}
              </div>

              {/* Price block */}
              <div className="mb-7" style={{ minHeight: "120px" }}>
                {period !== "monthly" && (
                  <div
                    className="font-grotesk text-base line-through mb-1"
                    style={{ color: tier.featured ? "rgba(255,255,255,0.4)" : "#9CA3AF" }}
                  >
                    ${fmt(tier.prices.monthly)}/month
                  </div>
                )}
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span
                    className="font-grotesk text-2xl font-medium"
                    style={{ color: tier.featured ? "rgba(255,255,255,0.7)" : "#9CA3AF" }}
                  >
                    $
                  </span>
                  <span
                    className="font-grotesk font-semibold leading-none"
                    style={{
                      fontSize: "64px",
                      letterSpacing: "-2px",
                      color: tier.featured ? "white" : "#111118",
                    }}
                  >
                    {fmt(tier.prices[period])}
                  </span>
                  <span
                    className="font-grotesk text-base"
                    style={{ color: tier.featured ? "rgba(255,255,255,0.6)" : "#9CA3AF" }}
                  >
                    /month
                  </span>
                </div>
                <div
                  className="font-grotesk text-sm"
                  style={{ color: tier.featured ? "rgba(255,255,255,0.5)" : "#9CA3AF" }}
                >
                  {priceNote(tier, period, cfg.months)}
                </div>
              </div>

              {/* CTA */}
              <button
                className="w-full py-4 rounded-xl font-grotesk font-semibold text-[15px] mb-8 transition-transform hover:-translate-y-0.5 cursor-pointer"
                style={
                  tier.featured
                    ? { background: "white", color: "#111118" }
                    : { background: "#111118", color: "white" }
                }
              >
                {tier.cta}
              </button>

              {/* Features */}
              <div
                className="h-px mb-6"
                style={{
                  background: tier.featured ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.07)",
                }}
              />
              <div
                className="font-grotesk text-[11px] uppercase tracking-[1.2px] font-medium mb-4"
                style={{ color: tier.featured ? "rgba(255,255,255,0.5)" : "#9CA3AF" }}
              >
                {tier.featuresLabel}
              </div>
              <ul className="flex flex-col gap-3 flex-1">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-[15px] leading-relaxed">
                    <span
                      className="shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={
                        tier.featured
                          ? { background: "rgba(255,255,255,0.2)", color: "white" }
                          : f.video
                          ? { background: "rgba(43,80,220,0.1)", color: "#2B50DC" }
                          : { background: "rgba(43,80,220,0.1)", color: "#2B50DC" }
                      }
                    >
                      {f.video ? "▶" : "✓"}
                    </span>
                    <span
                      style={{
                        color: tier.featured
                          ? f.hi ? "white" : "rgba(255,255,255,0.75)"
                          : f.hi ? "#2B50DC" : "#374151",
                        fontWeight: f.hi ? 500 : 400,
                      }}
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
