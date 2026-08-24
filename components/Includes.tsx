import type { ReactNode } from "react";

/* One shared shell so stroke weight, caps and sizing are identical across the
   set — that consistency is what makes six separate marks read as one family.
   Rectangles are left un-rounded to match the site's square corners, and the
   stroke inherits currentColor from the tile. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="w-6 h-6"
    >
      {children}
    </svg>
  );
}

const items = [
  {
    // Stacked layers — a deep library of ready posts.
    icon: (
      <Icon>
        <path d="M12 2.5 2.5 7 12 11.5 21.5 7 12 2.5Z" />
        <path d="M2.5 12 12 16.5 21.5 12" />
        <path d="M2.5 17 12 21.5 21.5 17" />
      </Icon>
    ),
    title: "HL-targeted library",
    body: "Continuously updated posts tagged by HL feature, platform, and audience.",
  },
  {
    // Sliders — every post tuned to the individual client.
    icon: (
      <Icon>
        <path d="M3 6h8M15 6h6" />
        <path d="M3 12h4M11 12h10" />
        <path d="M3 18h11M18 18h3" />
        <circle cx="13" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="16" cy="18" r="2" />
      </Icon>
    ),
    title: "Per-client customization",
    body: "Adapted to your brand, voice, ICP, and the services your white-label sells.",
  },
  {
    // Calendar with a tick — scheduled straight into the planner.
    icon: (
      <Icon>
        <rect x="3" y="5" width="18" height="16" />
        <path d="M8 2.5v5M16 2.5v5M3 10.5h18" />
        <path d="m8.5 15.5 2.5 2.5 4.5-4.5" />
      </Icon>
    ),
    title: "HL Social Planner delivery",
    body: "Direct scheduling. No exports, no copy-paste, no third-party tools.",
  },
  {
    // Desktop beside a phone — one post, reformatted per platform.
    icon: (
      <Icon>
        <rect x="2.5" y="4" width="12" height="9.5" />
        <path d="M8.5 13.5V17M5.5 17h6" />
        <rect x="17" y="7" width="4.5" height="13" />
        <path d="M19.25 17.5h.01" />
      </Icon>
    ),
    title: "Multi-platform formatting",
    body: "Each post properly adapted per platform, not just resized.",
  },
  {
    // Two people — the writers and designers behind the work.
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
        <path d="M16.8 5.2a3.5 3.5 0 0 1 0 5.6" />
        <path d="M18.4 14.9c1.9.7 3.1 2.4 3.1 4.4" />
      </Icon>
    ),
    title: "HL-fluent team",
    body: "Writers and designers who use HighLevel daily. No onboarding needed.",
  },
  {
    // Loop arrow — send it back round as many times as you need.
    icon: (
      <Icon>
        <path d="M20.5 11.5a8.5 8.5 0 1 1-2.5-6" />
        <path d="M20.5 3.5v6h-6" />
      </Icon>
    ),
    title: "Revisions included",
    body: "Unlimited revisions on your first batch. No surprise charges.",
  },
];

export default function Includes() {
  return (
    <section id="gw-includes" className="py-32 md:py-40 bg-white dark:bg-[#050508] transition-colors duration-300">
      <div data-reveal className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="section-eyebrow">[ Standard across all plans ]</div>
        <h2 className="section-title">
          Every plan includes<br />the <span className="gradient-text">core socialX system</span>.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-20">
          {items.map((item) => (
            <div key={item.title} className="card-sky p-7">
              <div
                className="w-11 h-11 flex items-center justify-center mb-5 bg-[#3D4AFF]/10 dark:bg-[#3D4AFF]/20 text-[#3D4AFF] dark:text-[#00A3FF] transition-colors"
              >
                {item.icon}
              </div>
              <h3 className="font-grotesk text-[17px] font-semibold leading-snug mb-2 text-gray-900 dark:text-white transition-colors duration-300">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed transition-colors duration-300">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
