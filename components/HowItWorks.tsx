const steps = [
  {
    num: "01",
    title: "Sign up and intake.",
    body: "15-minute brand form — logo, colors, voice, ICP, platforms. One time, then done.",
  },
  {
    num: "02",
    title: "We build your batch.",
    body: "We pull from the HL-feature library and customize everything to your brand. Growth and Scale get custom posts and motion videos too.",
  },
  {
    num: "03",
    title: "Approve. We schedule.",
    body: "Review and approve the batch. We load everything straight into your HL Social Planner. Posts publish on autopilot.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-32 md:py-40 relative overflow-hidden" id="gw-how" style={{ background: "white" }}>
      {/* Subtle blue glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(43,80,220,0.05) 0%, transparent 65%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="section-eyebrow">[ The socialX system ]</div>
        <h2 className="section-title">
          A social media engine that<br />
          runs <span className="gradient-text">without you</span>.
        </h2>
        <p className="section-sub mb-20">
          Three steps. Then it runs every month, on schedule, in your HL Social Planner.
        </p>

        <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className="card-sky rounded-none p-10 animate-fade-up"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div
                className="font-grotesk font-bold leading-none mb-6 gradient-text"
                style={{ fontSize: "72px", letterSpacing: "-3px" }}
              >
                {s.num}
              </div>
              <h3 className="font-grotesk text-[21px] font-semibold mb-3 leading-snug tracking-[-0.4px] text-gray-900">
                {s.title}
              </h3>
              <p className="text-gray-500 text-[15px] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="text-center mt-14 font-grotesk text-[17px] font-medium text-blue-neon">
          First batch in 7 days. After that, it just runs.
        </p>
      </div>
    </section>
  );
}
