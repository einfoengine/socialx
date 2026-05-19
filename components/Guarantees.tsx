const stats = [
  { num: "$0",   label: "Setup fee",             sub: "No onboarding charges." },
  { num: "0",    label: "Long-term contracts",   sub: "Cancel or pause anytime." },
  { num: "100%", label: "White-label ready",     sub: "Your brand. Your voice." },
];

export default function Guarantees() {
  return (
    <section className="py-32 md:py-40 relative overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,8,119,0.95) 0%, rgba(0,163,255,0.22) 100%)",
        }}
      />
      {/* Glowing top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,163,255,0.6) 50%, transparent 100%)",
        }}
      />
      {/* Glowing bottom edge */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,163,255,0.3) 50%, transparent 100%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="grid sm:grid-cols-3 gap-10 max-w-3xl mx-auto text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div
                className="font-grotesk font-bold text-white mb-3 leading-none"
                style={{ fontSize: "64px", letterSpacing: "-2px" }}
              >
                {s.num}
              </div>
              <div className="font-grotesk text-[16px] font-semibold text-white/90 mb-1">
                {s.label}
              </div>
              <div className="font-grotesk text-sm text-white/55">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
