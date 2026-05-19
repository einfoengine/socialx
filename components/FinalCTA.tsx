export default function FinalCTA() {
  return (
    <section className="py-40 md:py-48 text-center relative overflow-hidden" style={{ background: "#EEF2FF" }}>
      {/* Blob */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div
          style={{
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #2B50DC 0%, #5B8DEF 40%, transparent 70%)",
            filter: "blur(100px)",
            opacity: 0.18,
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <h2
          className="font-grotesk font-semibold tracking-[-2.2px] mb-5 leading-[1.05] text-gray-900"
          style={{ fontSize: "clamp(36px, 5.5vw, 64px)" }}
        >
          Stop fighting blank<br />
          <span className="gradient-text">content calendars</span>.
        </h2>
        <p className="text-[19px] text-gray-500 max-w-140 mx-auto mb-10 leading-relaxed">
          Your social can be running in your HL Social Planner in 7 days. No setup
          fee. No contracts. No agency theater.
        </p>
        <a
          href="#pricing"
          className="gradient-bg text-white px-10 py-4.5 rounded-full font-grotesk font-semibold text-base inline-flex items-center gap-2 transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "0 8px 32px rgba(43,80,220,0.3)" }}
        >
          See plans →
        </a>
      </div>
    </section>
  );
}
