export default function Hero() {
  return (
    <section className="relative py-28 lg:py-36 overflow-hidden" style={{ background: "#F4F2EF" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── LEFT: copy ── */}
          <div>
            {/* Eyebrow */}
            <div
              className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full font-grotesk text-[13px] font-medium tracking-[0.5px] uppercase"
              style={{
                background: "rgba(43,80,220,0.08)",
                border: "1px solid rgba(43,80,220,0.18)",
                color: "#2B50DC",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-neon animate-pulse-dot shrink-0" />
              For HighLevel SaaS resellers
            </div>

            {/* H1 */}
            <h1
              className="font-grotesk font-semibold leading-[1.02] tracking-[-2.5px] mb-7 text-gray-900"
              style={{ fontSize: "clamp(44px, 6vw, 76px)" }}
            >
              Social media for<br />
              HighLevel resellers.<br />
              <span className="gradient-text">Done for you.</span><br />
              Not by you.
            </h1>

            {/* Sub */}
            <p className="text-[20px] text-gray-500 leading-relaxed mb-10 max-w-150 lg:max-w-none">
              We pull HighLevel-feature-targeted posts from a library that updates
              every time HL ships. Customized to your brand. Scheduled straight to
              your HL Social Planner. Your job ends at approval.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <a
                href="#pricing"
                className="gradient-bg text-white px-9 py-4.5 rounded-full font-grotesk font-semibold text-base inline-flex items-center gap-2 transition-transform hover:-translate-y-0.5"
              >
                See pricing →
              </a>
              <a
                href="#how"
                className="text-gray-700 px-9 py-4.5 rounded-full font-grotesk font-medium text-base inline-flex items-center gap-2 transition-all hover:-translate-y-0.5"
                style={{
                  background: "white",
                  border: "1px solid rgba(0,0,0,0.1)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                How it works
              </a>
            </div>
          </div>

          {/* ── RIGHT: blue blob + floating post card ── */}
          <div className="hidden lg:flex flex-col items-center relative">

            {/* Aurora blob (the Crunchy-style visual) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                style={{
                  width: "520px",
                  height: "520px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, #2B50DC 0%, #5B8DEF 40%, transparent 70%)",
                  filter: "blur(90px)",
                  opacity: 0.38,
                }}
              />
            </div>

            {/* Queue pill */}
            <div
              className="absolute top-4 right-4 z-20 px-4 py-1.5 rounded-full font-grotesk text-xs font-semibold"
              style={{
                background: "white",
                border: "1px solid rgba(43,80,220,0.2)",
                color: "#2B50DC",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              }}
            >
              30 posts queued this month ✓
            </div>

            {/* Back card */}
            <div
              className="absolute -bottom-3 left-6 right-0 h-24 rounded-2xl -z-10 -rotate-2"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(0,0,0,0.07)",
              }}
            />

            {/* Front post card */}
            <div
              className="w-full max-w-95 rounded-3xl p-6 animate-float relative z-10"
              style={{
                background: "white",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 20px 60px rgba(43,80,220,0.15), 0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              {/* Post header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full gradient-bg shrink-0 flex items-center justify-center font-grotesk font-bold text-sm text-white">
                  YS
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-grotesk font-semibold text-sm text-gray-900 truncate">
                      Your SaaS Co.
                    </span>
                    <span
                      className="text-[10px] font-grotesk font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: "rgba(10,102,194,0.12)", color: "#0A66C2" }}
                    >
                      in
                    </span>
                  </div>
                  <div className="font-grotesk text-xs text-gray-400 mt-0.5">
                    Just now · LinkedIn
                  </div>
                </div>
              </div>

              {/* Post body */}
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                Stop losing 5-star reviews before they go public. HighLevel&apos;s
                Reputation Manager catches every request automatically. 🔥
              </p>

              {/* Post graphic */}
              <div className="h-36 rounded-2xl mb-4 relative overflow-hidden gradient-bg flex items-center justify-center">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 20px)",
                  }}
                />
                <div className="relative text-center px-4">
                  <div className="font-grotesk font-semibold text-sm text-white/90">
                    HL Reputation Management
                  </div>
                  <div className="font-grotesk text-xs text-white/60 mt-1">
                    Feature spotlight · socialX
                  </div>
                </div>
              </div>

              {/* Engagement row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 font-grotesk text-xs text-gray-400">
                  <span>❤️ 47</span>
                  <span>💬 8</span>
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full font-grotesk text-xs font-semibold"
                  style={{ background: "rgba(43,80,220,0.1)", color: "#2B50DC" }}
                >
                  <span>✓</span>
                  <span>Scheduled to HL</span>
                </div>
              </div>
            </div>

            {/* Second mini card */}
            <div
              className="w-full max-w-95 mt-3 rounded-2xl px-5 py-3 flex items-center gap-3 relative z-10"
              style={{
                background: "white",
                border: "1px solid rgba(0,0,0,0.07)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              }}
            >
              <div className="w-8 h-8 rounded-full gradient-bg shrink-0 flex items-center justify-center font-grotesk font-bold text-xs text-white">
                YS
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-grotesk text-xs text-gray-600 truncate">
                  HighLevel AI Employee just changed how our clients handle…
                </div>
                <div className="font-grotesk text-[10px] text-gray-400 mt-0.5">
                  Scheduled · Facebook · Tomorrow 9am
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
