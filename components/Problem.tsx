const problems = [
  {
    icon: "⏱",
    title: "No time, no system.",
    body: "You're closing deals, onboarding clients, running support. Content falls off every time — and prospects notice the ghost account.",
  },
  {
    icon: "🎨",
    title: "DIY content kills positioning.",
    body: "Canva posts on Sunday nights look amateur next to real SaaS brands. Costs deals at the trust stage.",
  },
  {
    icon: "🤷",
    title: "Generic SMM doesn't speak HighLevel.",
    body: "Freelancers who've never touched the platform produce fluffy, platform-agnostic content. Useless for HL-aware prospects.",
  },
  {
    icon: "🔥",
    title: "Freelancer chaos costs deals.",
    body: "Three writers, two designers, missed deadlines. You end up managing people instead of growing your SaaS.",
  },
];

export default function Problem() {
  return (
    <section className="py-32 md:py-40" id="problem" style={{ background: "#F4F2EF" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="section-eyebrow">[ The reseller&apos;s social problem ]</div>
        <h2 className="section-title">
          Your prospects research you<br />before booking. What do they find?
        </h2>
        <p className="section-sub mb-20">
          Every HL reseller hits the same wall. Social matters for trust at the
          sales stage — and every alternative fails differently.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          {problems.map((p) => (
            <div key={p.title} className="card-red rounded-2xl p-10">
              <div className="text-3xl mb-5">{p.icon}</div>
              <h3 className="font-grotesk text-[22px] font-semibold mb-3 leading-snug tracking-[-0.4px] text-gray-900">
                {p.title}
              </h3>
              <p className="text-gray-500 text-base leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
