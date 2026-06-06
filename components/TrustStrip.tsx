export default function TrustStrip() {
  const benefits = [
    "100% Native to HighLevel",
    "Auto-Scheduled to Social Planner",
    "Feature-Specific Content",
    "No CSV Exports",
    "White-labeled",
    "Updates When HL Ships",
    "Sales Enablement Focused",
    "Zero Client Management"
  ];

  // Duplicate to allow seamless infinite scrolling (translateX -50%)
  const marqueeItems = [...benefits, ...benefits];

  return (
    <section
      id="gw-trust-strip"
      className="py-6 overflow-hidden relative bg-[#111118] dark:bg-[#111118] border-t border-black/10 dark:border-white/10 transition-colors duration-300"
    >
      {/* Gradient masks for smooth fade on edges */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#111118] dark:from-[#050508] to-transparent z-10 pointer-events-none transition-colors duration-300" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#111118] dark:from-[#050508] to-transparent z-10 pointer-events-none transition-colors duration-300" />

      {/* Leftward Scrolling Marquee */}
      <div className="flex animate-marquee whitespace-nowrap w-max items-center">
        {marqueeItems.map((benefit, i) => (
          <div key={i} className="flex items-center mx-8">
            <span className="text-[#2B50DC] mr-4 text-xl leading-none">✦</span>
            <span className="font-grotesk text-[13px] font-semibold text-white/80 uppercase tracking-[1.5px]">
              {benefit}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
