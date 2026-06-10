import Script from "next/script";

const CHECKLIST = [
  "We audit your current HighLevel social presence",
  "You see real, feature-targeted post examples for your niche",
  "Live in your HL Social Planner within 7 days",
  "No pitch, no contracts, no agency theater",
];

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2B50DC]/10 dark:bg-[#5B8DEF]/15">
      <svg
        className="h-3 w-3 text-[#2B50DC] dark:text-[#5B8DEF]"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 6.5 5 9l4.5-5.5" />
      </svg>
    </span>
  );
}

export default function Booking() {
  return (
    <section
      id="gw-book"
      className="py-28 md:py-36 relative overflow-hidden bg-[#F4F2EF] dark:bg-[#050508] transition-colors duration-300"
    >
      {/* Soft color blob */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div
          style={{
            width: "680px",
            height: "680px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, #2B50DC 0%, #5B8DEF 45%, transparent 70%)",
            filter: "blur(120px)",
            opacity: 0.14,
          }}
        />
      </div>

      {/* Masked subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
        style={{
          maskImage:
            "radial-gradient(ellipse at center, black 5%, transparent 65%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 5%, transparent 65%)",
        }}
      />

      <div data-reveal className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          {/* Left: persuasion */}
          <div className="text-center lg:text-left">
            <div className="font-grotesk text-[12px] font-semibold text-[#2B50DC] dark:text-[#5B8DEF] uppercase tracking-[1.5px] mb-4 transition-colors">
              [ Book a Call ]
            </div>
            <h2 className="font-grotesk font-semibold tracking-[-1.2px] leading-[1.08] text-[34px] md:text-[44px] text-gray-900 dark:text-white mb-5 transition-colors duration-300">
              Let&apos;s get your socials{" "}
              <span className="gradient-text">running</span>.
            </h2>
            <p className="text-[17px] md:text-[18px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg mx-auto lg:mx-0 mb-8 transition-colors duration-300">
              Pick a time that works for you. It&apos;s a quick, no-pressure call to
              see exactly how your content gets built, branded, and published.
            </p>

            <ul className="space-y-3.5 text-left max-w-md mx-auto lg:mx-0 mb-10">
              {CHECKLIST.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-[15px] md:text-[16px] text-gray-700 dark:text-gray-300 transition-colors duration-300"
                >
                  <CheckIcon />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>

            {/* Trust pill */}
            <div className="inline-flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-white/5 px-5 py-2.5 rounded-full border border-gray-200 dark:border-white/10 backdrop-blur-sm shadow-sm">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#F4F2EF] dark:border-[#050508] bg-gray-200 dark:bg-gray-800 shadow-sm"
                    style={{
                      backgroundImage: `url(https://i.pravatar.cc/100?img=${i + 11})`,
                      backgroundSize: "cover",
                    }}
                  />
                ))}
              </div>
              <span>Trusted by 800+ HL Resellers</span>
            </div>
          </div>

          {/* Right: calendar */}
          <div className="rounded-[4px] overflow-hidden border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#111118] shadow-[0_16px_48px_rgba(43,80,220,0.10)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-colors duration-300">
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
      </div>

      <Script
        src="https://link.msgsndr.com/js/form_embed.js"
        strategy="lazyOnload"
      />
    </section>
  );
}
