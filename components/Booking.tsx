import Script from "next/script";

export default function Booking() {
  return (
    <section
      id="gw-book"
      className="py-28 md:py-36 relative overflow-hidden bg-white dark:bg-[#050508] transition-colors duration-300"
    >
      <div className="max-w-4xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <div className="section-eyebrow">[ Book a Call ]</div>
          <h2 className="section-title">
            Let&apos;s get your socials{" "}
            <span className="gradient-text">running</span>.
          </h2>
          <p className="section-sub">
            Pick a time that works for you. We&apos;ll walk through your HighLevel
            SaaS, your branding, and exactly how your content gets published. No
            pressure, no agency theater.
          </p>
        </div>

        <div className="rounded-[3px] overflow-hidden border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#111118] shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-colors duration-300">
          <iframe
            src="https://api.leadconnectorhq.com/widget/booking/RbjuKxBNLN8bLfUEviTE"
            title="Book a call with socialX"
            style={{
              width: "100%",
              border: "none",
              overflow: "hidden",
              minHeight: "720px",
            }}
            scrolling="no"
            id="RbjuKxBNLN8bLfUEviTE_1781096728327"
          />
        </div>
      </div>

      <Script
        src="https://link.msgsndr.com/js/form_embed.js"
        strategy="lazyOnload"
      />
    </section>
  );
}
