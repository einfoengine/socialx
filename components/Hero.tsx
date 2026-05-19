import Image from 'next/image';

export default function Hero() {
  return (
    <section className="relative py-32 lg:py-48 overflow-hidden" style={{ background: "#F4F2EF" }}>
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
              [ For HighLevel SaaS resellers ]
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

          {/* ── RIGHT: blue blob + floating hand image ── */}
          <div className="hidden lg:flex flex-col items-center relative w-full h-[600px] justify-center">

            {/* Aurora blob (the Crunchy-style visual) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
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

            {/* Hand Image */}
            <div className="relative z-10 w-full max-w-[500px] animate-float drop-shadow-[0_20px_50px_rgba(43,80,220,0.4)] rounded-[2.5rem] overflow-hidden border-[1px] border-white/20">
              <Image 
                src="/hero-hand.png" 
                alt="Social Media Automation" 
                width={600} 
                height={600} 
                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-700 ease-out"
                priority
              />
              {/* Optional overlay for blending */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 to-transparent pointer-events-none mix-blend-overlay"></div>
            </div>
            
            {/* Floating Element 1 */}
            <div
              className="absolute top-12 -right-4 z-20 px-5 py-2.5 rounded-full font-grotesk text-xs font-semibold animate-float flex items-center gap-2 backdrop-blur-md"
              style={{
                background: "rgba(255, 255, 255, 0.8)",
                border: "1px solid rgba(43,80,220,0.2)",
                color: "#2B50DC",
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                animationDelay: "1.5s"
              }}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Social Networks Synced
            </div>

            {/* Floating Element 2 */}
            <div
              className="absolute bottom-16 -left-8 z-20 px-5 py-2.5 rounded-2xl font-grotesk text-xs font-semibold animate-float flex items-center gap-3 backdrop-blur-md"
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                border: "1px solid rgba(43,80,220,0.15)",
                color: "#111827",
                boxShadow: "0 15px 40px rgba(0,0,0,0.12)",
                animationDelay: "0.5s"
              }}
            >
              <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white font-bold">
                ✓
              </div>
              <div className="flex flex-col">
                <span className="text-gray-900">Done for You</span>
                <span className="text-gray-500 font-normal text-[10px]">Auto-scheduled</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
