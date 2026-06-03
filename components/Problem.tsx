"use client";

import { useRef, useEffect } from "react";

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

function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 13;
    let cols = 0;
    let drops: number[] = [];

    const resize = (width: number, height: number) => {
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        cols = Math.floor(w / fontSize);
        drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -50));
      }
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        resize(width, height);
      }
    });

    resize(canvas.offsetWidth, canvas.offsetHeight);
    observer.observe(canvas);

    let rafId: number;
    let lastTime = 0;
    const interval = 1000 / 10; // 10 fps — slow, eerie

    const draw = (timestamp: number) => {
      rafId = requestAnimationFrame(draw);
      if (timestamp - lastTime < interval) return;
      lastTime = timestamp;

      // Fade using the section bg colour so old chars dissolve naturally
      ctx.fillStyle = "rgba(43, 80, 220, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * fontSize;
        if (y < 0) { drops[i]++; continue; }

        const char = Math.random() > 0.5 ? "1" : "0";

        // Bright leading character
        ctx.fillStyle = "#00219b";
        ctx.fillText(char, i * fontSize, y);

        if (y > canvas.height && Math.random() > 0.97) {
          drops[i] = Math.floor(Math.random() * -20);
        }
        drops[i]++;
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
    />
  );
}

function ProblemCard({ p }: { p: (typeof problems)[0] }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => videoRef.current?.play();

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="relative overflow-hidden bg-black p-10 border border-white/5 transition-all duration-300 hover:z-10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:scale-[1.02] group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src="/hover-bg.mp4"
        preload="none"
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-[1]" />
      <div className="relative z-10">
        <div className="text-3xl mb-5">{p.icon}</div>
        <h3 className="font-grotesk text-[22px] font-semibold mb-3 leading-snug tracking-[-0.4px] text-white">
          {p.title}
        </h3>
        <p className="text-gray-400 text-base leading-relaxed">{p.body}</p>
      </div>
    </div>
  );
}

export default function Problem() {
  return (
    <section id="gw-problem" className="relative py-32 md:py-40 overflow-hidden" style={{ background: "#2B50DC" }}>
      <MatrixCanvas />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
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
            <ProblemCard key={p.title} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
