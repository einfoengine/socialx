const reasons = [
  {
    num: "01",
    title: "Every post targets a specific HighLevel feature.",
    body: "Reputation Management, AI Employee, Social Planner, Workflows — each post is built to showcase a real HL feature. Sales enablement disguised as social content.",
  },
  {
    num: "02",
    title: "The library refreshes when HighLevel ships.",
    body: "When HL pushes an update, affected posts get rewritten. Other libraries go stale in months. Ours stays current week by week.",
  },
  {
    num: "03",
    title: "Scheduled directly to your HL Social Planner.",
    body: "No CSV exports, no third-party tools, no copy-paste. Approved posts go straight into your HL Social Planner exactly where you already operate.",
  },
  {
    num: "04",
    title: "Built by operators who have served 800+ HL clients.",
    body: "Same team behind GHL Explainer (2021), GHL Animation Studios (2022), GHL Video (2024). We don't need educating on HL. We know what resellers fight with every day.",
  },
];

export default function WhySocialX() {
  return (
    <section
      className="py-32"
      style={{ background: "#EEF2FF" }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="section-eyebrow">Why socialX</div>
        <h2 className="section-title">
          Not a generic social service.<br />
          An <span className="gradient-text">HL-native one</span>.
        </h2>
        <p className="section-sub mb-20">
          Built around HighLevel, by people in the ecosystem since 2019.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          {reasons.map((r, i) => (
            <div
              key={r.num}
              className="card-sky rounded-2xl p-10 animate-fade-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="font-grotesk text-sm font-semibold text-blue-neon tracking-widest mb-4">
                {r.num}
              </div>
              <h3 className="font-grotesk text-[22px] font-semibold leading-snug tracking-[-0.5px] mb-4 text-gray-900">
                {r.title}
              </h3>
              <p className="text-gray-500 text-base leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
