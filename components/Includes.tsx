const items = [
  {
    icon: "⚡",
    title: "HL-targeted library",
    body: "Continuously updated posts tagged by HL feature, platform, and audience.",
  },
  {
    icon: "✦",
    title: "Per-client customization",
    body: "Adapted to your brand, voice, ICP, and the services your white-label sells.",
  },
  {
    icon: "↗",
    title: "HL Social Planner delivery",
    body: "Direct scheduling. No exports, no copy-paste, no third-party tools.",
  },
  {
    icon: "◑",
    title: "Multi-platform formatting",
    body: "Each post properly adapted per platform — not just resized.",
  },
  {
    icon: "●",
    title: "HL-fluent team",
    body: "Writers and designers who use HighLevel daily. No onboarding needed.",
  },
  {
    icon: "↺",
    title: "Revisions included",
    body: "Unlimited revisions on your first batch. No surprise charges.",
  },
];

export default function Includes() {
  return (
    <section id="gw-includes" className="py-32 md:py-40 bg-white dark:bg-[#050508] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="section-eyebrow">[ Standard across all plans ]</div>
        <h2 className="section-title">
          Every plan includes<br />the core socialX system.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-20">
          {items.map((item) => (
            <div key={item.title} className="card-sky rounded-none p-7">
              <div
                className="w-11 h-11 rounded-none flex items-center justify-center text-xl mb-5 bg-[#2B50DC]/10 dark:bg-[#2B50DC]/20 text-[#2B50DC] dark:text-[#5B8DEF] transition-colors"
              >
                {item.icon}
              </div>
              <h3 className="font-grotesk text-[17px] font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-300">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed transition-colors duration-300">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
