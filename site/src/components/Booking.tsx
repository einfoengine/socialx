
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
        {/* Stacked, not side-by-side: the pitch reads across the top and the
            calendar takes the full width beneath it. Giving the widget the whole
            column also lets it lay the month out beside the slot list instead of
            stacking them, which is what made the slot list run so long. */}
        <div data-reveal className="text-center">
          <div className="font-grotesk text-[12px] font-semibold text-[#3D4AFF] dark:text-[#00A3FF] uppercase tracking-[1.5px] mb-4 transition-colors">
            [ Book a Call ]
          </div>
          <h2 className="font-grotesk font-semibold tracking-[-1.2px] leading-[1.08] text-[32px] md:text-[42px] text-gray-900 dark:text-white mb-4 transition-colors duration-300">
            See <span className="gradient-text">real posts</span> for your brand.
            Then decide.
          </h2>
          <p className="text-[16px] md:text-[17px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto mb-9 transition-colors duration-300">
            A quick, no-pressure call. We audit your HighLevel presence and show
            you real feature-targeted posts for your niche, so you know exactly
            what you are getting.
          </p>

          {/* Points run across in one row now that they sit above the calendar */}
          <ul className="grid gap-x-8 gap-y-3 mb-8 text-left sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="inline-flex items-center gap-3.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-white/5 px-4 py-2 border border-gray-200 dark:border-white/10 backdrop-blur-sm shadow-sm mb-12">
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

        {/* Calendar — full width */}
        <div className="w-full overflow-hidden border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#04044A] shadow-[0_16px_48px_rgba(61,74,255,0.10)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] transition-colors duration-300">
          {/* Slim header strip so the third-party widget reads as part of the page */}
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

              Fixed height, and form_embed.js is deliberately not loaded here:
              that script grows the iframe to fit its content, which defeats the
              widget's own slot-list scrolling and forces a second scrollbar.
              With a fixed viewport only the time-slot column scrolls.

              CROP: the widget's own stylesheet puts 64px of padding on
              #appointment_widgets--revamp (.appointment_widgets-xl--revamp in
              _main.*.css), which renders as a blank band directly under our
              header strip. It's cross-origin, so it can't be overridden, and the
              iframe is instead pulled up by that amount and clipped by the
              parent. In the two-column layout it is pulled up by 116px rather
              than 64px so the widget's own heading goes with the padding: see
              the note on that below. pt-3.5 gives the panel back a little room
              under the header strip, on a white ground because the widget
              renders white in both site themes. */}
          <div className="relative isolate bg-white min-[1056px]:pt-3.5">
            {/* The clip lives on this inner box, not on the padded parent:
                overflow-hidden clips at the border box, so padding on the same
                element would just slide the iframe back down and reveal the very
                heading the crop removes. Clipping below the padding keeps the two
                independent. */}
            <div className="overflow-hidden">
              <iframe
                src="https://api.leadconnectorhq.com/widget/booking/RbjuKxBNLN8bLfUEviTE"
                title="Book a call with socialX"
                className="mt-[-64px] block h-[764px] w-full border-0 min-[1056px]:mt-[-116px]"
                scrolling="no"
                id="RbjuKxBNLN8bLfUEviTE_1781096728327"
              />
            </div>
            {/* The widget prints its own "Select Date & Time" heading
                (h4.label-select-date) above the date column, which repeats the
                "Pick a time" strip and wastes a band of vertical space. It is
                cross-origin, so it cannot be hidden with CSS, and painting over
                it would leave the empty band behind. Instead the crop above is
                deepened to lift the heading clean off the top of the frame,
                so the band it occupied is gone rather than painted over.

                116px is measured, not guessed. The heading's TEXT box ends at
                y=115 and the service name's text box starts at y=117, so the
                crop has to land in that 2px window to take the heading without
                shaving the name. It holds from 992 to 1216px of iframe width,
                which is the full two-column range.

                The widget switches to a stacked layout below 992px of IFRAME
                width, where the heading sits mid-flow and no crop can reach it.
                The iframe is the container width (viewport-48 below lg, then
                min(viewport,1280)-64), so that threshold is a 1056px viewport,
                hence the explicit pixel variants rather than lg. In the stacked
                band the heading is covered in place instead. Under an 816px
                viewport the widget drops the heading itself. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[35%] right-0 top-0 hidden h-[20px] bg-white min-[1056px]:block"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-[206px] hidden h-[46px] bg-white min-[816px]:block min-[1056px]:hidden"
            />

            {/* Vertical rule sitting in the GUTTER between the month grid and the
                slot column — centred in the gap rather than hugging either side
                (grid edge falls near 70%, slots begin near 74%).

                The widget is cross-origin, so no element inside it can be given a
                real border — this is a hairline drawn over the iframe, with
                pointer-events:none so the widget stays clickable. The position is
                measured off the rendered widget rather than read from its DOM, so
                `left` is the one value to nudge if it doesn't sit flush.

                lg and up only: below that the widget stacks the month above the
                slots, where a full-height rule would cut through the calendar
                instead of dividing two columns. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 hidden w-px bg-black/10 dark:bg-white/10 lg:block"
              style={{ left: "72%" }}
            />
          </div>
        </div>
      </div>

    </section>
  );
}
