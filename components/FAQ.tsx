"use client";

import { useState } from "react";

const faqs = [
  {
    q: "What does 'customization' actually mean?",
    a: "socialX is not generic AI-generated content. For Starter, we swap your brand assets and styles into our proven templates. For Growth, we adapt the copies to your exact tone of voice and vertical niche. For Scale, we build highly specialized posts targeting your specific SaaS client testimonials, visual wins, and software features.",
  },
  {
    q: "How does onboarding work?",
    a: "Onboarding takes less than 15 minutes. After sign-up, you submit a brief brand form (logo, colors, voice guidelines, ICP). Our native HighLevel copywriters and designers build your first batch within 7 business days. You approve, and it goes live.",
  },
  {
    q: "How does the HighLevel Social Planner sync work?",
    a: "You grant us secure, restricted content manager access to your subaccounts during onboarding. Once you approve a batch in your socialX dashboard, we schedule the posts directly inside your HighLevel Social Planner. No manual copy-pasting, CSV files, or third-party platforms.",
  },
  {
    q: "Can I change plans or pause anytime?",
    a: "Yes. All our monthly reseller plans operate on a flexible cancel-anytime model. You can upgrade, downgrade, or pause your subscriptions at the end of your billing cycle directly from your customer portal with zero drama.",
  },
  {
    q: "What if my reseller agency serves highly specialized niches?",
    a: "HighLevel features (missed call text-back, review request builders, visual pipelines) are universal across local business niches. Our custom copywriters adapt the examples, graphics, and hooks to speak directly to plumbers, dentists, gym owners, or whatever vertical your SaaS platform serves.",
  },
  {
    q: "Is there a setup fee or contract lock-in?",
    a: "Absolutely not. We believe in transparent partnerships. There are zero onboarding fees, zero setup costs, and zero long-term contract lock-ins. You pay only the flat monthly plan price.",
  },
];

function FAQItem({ 
  faq, 
  isOpen, 
  onToggle 
}: { 
  faq: typeof faqs[0]; 
  isOpen: boolean; 
  onToggle: () => void; 
}) {
  return (
    <div
      onClick={onToggle}
      className={`border transition-all duration-300 p-6 mb-4 select-none cursor-pointer bg-white dark:bg-[#111118] ${
        isOpen 
          ? "border-[#2B50DC]/40 dark:border-[#2B50DC]/60 shadow-[0_12px_24px_rgba(43,80,220,0.03)]" 
          : "border-black/10 dark:border-white/10 hover:border-[#2B50DC]/25 dark:hover:border-[#2B50DC]/40"
      }`}
    >
      <div className="flex justify-between items-center gap-6">
        <span 
          className={`font-grotesk text-lg font-semibold transition-colors duration-300 ${
            isOpen ? "text-[#2B50DC] dark:text-[#5B8DEF]" : "text-gray-900 dark:text-white"
          }`}
        >
          {faq.q}
        </span>
        <button
          className={`shrink-0 w-8 h-8 border flex items-center justify-center font-grotesk text-[15px] transition-all duration-300 ${
            isOpen
              ? "bg-[#2B50DC] border-[#2B50DC] text-white rotate-180"
              : "bg-white dark:bg-[#111118] border-black/10 dark:border-white/10 text-gray-500 hover:text-[#2B50DC] dark:hover:text-white hover:border-[#2B50DC]/40 hover:bg-[#2B50DC]/8 dark:hover:bg-[#2B50DC]/20"
          }`}
        >
          {isOpen ? "−" : "+"}
        </button>
      </div>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ 
          maxHeight: isOpen ? "300px" : "0",
          marginTop: isOpen ? "16px" : "0"
        }}
      >
        <p className="font-body text-sm text-gray-500 dark:text-gray-400 leading-relaxed pr-10 transition-colors duration-300">
          {faq.a}
        </p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="gw-faq" className="py-32 md:py-40 relative overflow-hidden border-t border-black/5 dark:border-white/5 bg-[#F4F2EF] dark:bg-[#0c0c10] transition-colors duration-300">
      {/* Subtle Grid Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
      />

      <div data-reveal className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="section-eyebrow">[ Frequently Asked ]</div>
        <h2 className="section-title">
          The questions resellers<br /><span className="gradient-text">actually ask us</span>.
        </h2>
        <p className="section-sub mb-20 text-gray-600">
          Simple, transparent answers about our white-label SaaS content service.
        </p>

        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
