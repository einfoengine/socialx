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
    <section className="py-32 md:py-40" id="gw-problem" style={{ background: "#2B50DC" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="section-eyebrow text-white/80" style={{ color: "rgba(255,255,255,0.8)" }}>[ The reseller&apos;s social problem ]</div>
        <h2 className="section-title text-white" style={{ color: "white" }}>
          Your prospects research you<br />before booking. What do they find?
        </h2>
        <p className="section-sub mb-20 text-white/70" style={{ color: "rgba(255,255,255,0.7)" }}>
          Every HL reseller hits the same wall. Social matters for trust at the
          sales stage — and every alternative fails differently.
        </p>

        <div className="grid sm:grid-cols-2 gap-0">
          {problems.map((p) => (
            <div 
              key={p.title} 
              className="bg-black p-10 border border-white/5 transition-all duration-300 hover:z-10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:scale-[1.02] hover:bg-[#111118]"
            >
              <div className="text-3xl mb-5">{p.icon}</div>
              <h3 className="font-grotesk text-[22px] font-semibold mb-3 leading-snug tracking-[-0.4px] text-white">
                {p.title}
              </h3>
              <p className="text-gray-400 text-base leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
