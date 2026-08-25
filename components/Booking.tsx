import Script from "next/script";

const CHECKLIST = [
  "We audit your current HighLevel social presence",
  "You see real, feature-targeted post examples for your niche",
  "Live in your HL Social Planner within 7 days",
  "No pitch, no contracts, no agency theater",
];

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-[#3D4AFF]/10 dark:bg-[#00A3FF]/15">
      <svg
        className="h-3 w-3 text-[#3D4AFF] dark:text-[#00A3FF]"
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
              "radial-gradient(circle, #3D4AFF 0%, #00A3FF 45%, transparent 70%)",
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

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Balanced two-up, aligned to the top rather than centred: the copy
            column is deliberately light so the calendar reads as the focal
            point of the section rather than competing with a wall of text. */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left: the pitch, kept short */}
          <div data-reveal className="text-center lg:text-left lg:pt-4">
            <div className="font-grotesk text-[12px] font-semibold text-[#3D4AFF] dark:text-[#00A3FF] uppercase tracking-[1.5px] mb-4 transition-colors">
              [ Book a Call ]
            </div>
            <h2 className="font-grotesk font-semibold tracking-[-1.2px] leading-[1.08] text-[32px] md:text-[40px] text-gray-900 dark:text-white mb-4 transition-colors duration-300">
              See <span className="gradient-text">real posts</span> for your
              brand. Then decide.
            </h2>
            <p className="text-[16px] md:text-[17px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-md mx-auto lg:mx-0 mb-7 transition-colors duration-300">
              A quick, no-pressure call. We audit your HighLevel presence and show
              you real feature-targeted posts for your niche, so you know exactly
              what you are getting.
            </p>

            <ul className="grid gap-2.5 text-left max-w-md mx-auto lg:mx-0 mb-8 sm:grid-cols-2 lg:grid-cols-1">
              {CHECKLIST.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] md:text-[15px] text-gray-700 dark:text-gray-300 transition-colors duration-300"
                >
                  <CheckIcon />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>

            {/* Trust pill */}
            <div className="inline-flex items-center gap-3.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-white/5 px-4 py-2 border border-gray-200 dark:border-white/10 backdrop-blur-sm shadow-sm">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-7 h-7 border-2 border-[#F4F2EF] dark:border-[#050508] bg-gray-200 dark:bg-gray-800 shadow-sm"
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

          {/* Right: the calendar, presented as a panel rather than a bare embed */}
          <div className="overflow-hidden border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#04044A] shadow-[0_16px_48px_rgba(61,74,255,0.10)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-colors duration-300">
            {/* A slim header strip gives the embed a frame of our own, so the
                third-party widget reads as part of the page. */}
            <div className="flex items-center justify-between gap-4 border-b border-black/[0.07] dark:border-white/[0.08] px-5 py-3.5">
              <span className="font-grotesk text-[13px] font-semibold uppercase tracking-[1.2px] text-gray-900 dark:text-white">
                Pick a time
              </span>
              <span className="flex items-center gap-2 font-grotesk text-[11px] uppercase tracking-[1.2px] text-gray-500 dark:text-gray-400">
                <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping bg-[#3D4AFF] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 bg-[#3D4AFF]" />
                </span>
                Live availability
              </span>
            </div>

            {/* Calendar: socialX Discover Meeting.
                form_embed.js resizes this iframe by postMessage, keyed on the
                element id, so the id must stay in the <calendarId>_<ts> shape it
                expects.

                The widget is cross-origin, so its internals can't be styled, and
                the script writes the iframe height inline — capping the iframe
                itself would just be overwritten. Capping this wrapper works
                whatever the script does, and overscroll-contain stops the page
                scrolling on when the slot list reaches its end. */}
            <div className="max-h-[620px] overflow-y-auto overscroll-contain">
              <iframe
                src="https://api.leadconnectorhq.com/widget/booking/RbjuKxBNLN8bLfUEviTE"
                title="Book a call with socialX"
                style={{
                  width: "100%",
                  border: "none",
                  overflow: "hidden",
                  minHeight: "600px",
                }}
                scrolling="no"
                id="RbjuKxBNLN8bLfUEviTE_1781096728327"
              />
            </div>
          </div>
        </div>
      </div>

      <Script
        src="https://link.msgsndr.com/js/form_embed.js"
        strategy="afterInteractive"
      />
    </section>
  );
}
