"use client";

import { useState } from "react";

const faqs = [
  {
    q: 'What does "customization" actually mean?',
    a: "Starter swaps your logo, colors, and CTAs into library posts. Growth adds full voice adaptation with niche-specific examples. Scale personalizes every post around your services, wins, and audience pain points.",
  },
  {
    q: "How does onboarding work?",
    a: "After signup you fill out a brand intake form — logo, colors, voice, ICP, platforms. Most clients finish within 24–48 hours. Your first batch ships within your tier's SLA from there.",
  },
  {
    q: "How does HL Social Planner scheduling work?",
    a: "You grant us limited access during onboarding. Once posts are approved, we load them directly into your HL Social Planner at the agreed schedule. No exports, no third-party tools.",
  },
  {
    q: "Can I change plans or billing cycles?",
    a: "Upgrade anytime — the price difference is prorated to your next batch. Downgrade or switch billing cycles at the end of your current period. No fees, no penalties.",
  },
  {
    q: "What if my niche is highly specialized?",
    a: "The library is built around HL features, which are universal across niches. Customization adapts the posts to your audience. We've worked with resellers serving chiropractors, law firms, e-commerce, and more.",
  },
  {
    q: "Can I cancel or pause anytime?",
    a: "Monthly plans cancel anytime — your month finishes, no further charges. Multi-month plans can be paused up to 2 months per cycle. No drama, no fees.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-32" id="faq" style={{ background: "#F4F2EF" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="section-eyebrow">Frequently Asked</div>
        <h2 className="section-title">
          The questions resellers<br />actually ask us.
        </h2>

        <div className="max-w-205 mx-auto mt-16">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                style={{
                  borderTop: i === 0 ? "1px solid rgba(0,0,0,0.09)" : "none",
                  borderBottom: "1px solid rgba(0,0,0,0.09)",
                }}
              >
                <button
                  className="w-full flex justify-between items-center gap-6 py-7 font-grotesk text-[18px] font-medium text-left cursor-pointer transition-colors"
                  style={{ color: isOpen ? "#2B50DC" : "#111118" }}
                  onClick={() => setOpenIndex((prev) => (prev === i ? null : i))}
                >
                  <span>{faq.q}</span>
                  <span
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-light text-[18px] transition-all duration-300"
                    style={{
                      background: isOpen ? "var(--gradient-x)" : "white",
                      border: isOpen ? "none" : "1px solid rgba(0,0,0,0.1)",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                      color: isOpen ? "white" : "#555",
                      boxShadow: isOpen ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
                    }}
                  >
                    +
                  </span>
                </button>

                <div
                  className="overflow-hidden transition-all duration-400"
                  style={{ maxHeight: isOpen ? "400px" : "0" }}
                >
                  <p className="text-base text-gray-500 leading-[1.7] pb-7 pr-14">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
