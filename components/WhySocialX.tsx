"use client";

import React, { useState } from "react";

const reasons = [
  {
    num: "01",
    title: "100% Feature-Targeted Content",
    body: "Reputation managers, missed call text-backs, consolidated pipelines, custom app builders. Every single post is custom-engineered to sell a specific HighLevel feature, turning your social presence into a sales enablement machine.",
  },
  {
    num: "02",
    title: "Direct Sync to Your Social Planner",
    body: "Forget about zip files, Google Drive links, or manual uploads. Approved posts sync directly into your HighLevel Social Planner on autopilot, scheduling themselves exactly where you already run your business.",
  },
  {
    num: "03",
    title: "Auto-Refreshes When HighLevel Ships",
    body: "HighLevel moves at breakneck speed. When they launch a new UI or update features, we rewrite and refresh the affected templates instantly. Other libraries go stale in a month, ours remains current week by week.",
  },
  {
    num: "04",
    title: "HighLevel Ecosystem Pioneers",
    body: "Built by the team behind GHL Explainer (2021), GHL Animation Studios (2022), and GHL Video (2024). We've served over 800+ HL agencies since 2019. We know exactly what CRM resellers fight with every day.",
  },
];

function SpotlightCard({ r, i }: { r: typeof reasons[0]; i: number }) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      className="relative overflow-hidden bg-white dark:bg-[#111118] border border-black/10 dark:border-white/10 p-10 animate-fade-up transition-all duration-500 hover:scale-[1.02] hover:border-[#2B50DC]/30 hover:shadow-[0_20px_40px_rgba(43,80,220,0.05)] dark:hover:shadow-md select-none"
      style={{ animationDelay: `${i * 0.1}s` }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Dynamic Cursor Spotlight Effect */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, rgba(43, 80, 220, 0.05), transparent 80%)`,
        }}
      />
      {/* Subtle border shine glow using mouse coordinates */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-[1] border border-[#2B50DC]/20"
        style={{
          opacity: isHovered ? 0.3 : 0,
          maskImage: `radial-gradient(150px circle at ${coords.x}px ${coords.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(150px circle at ${coords.x}px ${coords.y}px, black, transparent)`,
        }}
      />

      <div className="relative z-10">
        <span className="font-grotesk text-xs font-bold uppercase tracking-[2px] text-blue-neon bg-[#2B50DC]/5 px-2.5 py-1 mb-6 inline-block">
          {r.num}
        </span>
        <h3 className="font-grotesk text-2xl font-bold leading-tight tracking-[-0.6px] mb-4 text-gray-900 dark:text-white transition-colors duration-300">
          {r.title}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed font-body transition-colors duration-300">
          {r.body}
        </p>
      </div>
    </div>
  );
}

export default function WhySocialX() {
  return (
    <section id="gw-why-socialx" className="py-32 md:py-40 bg-[#EEF2FF] dark:bg-[#0c0c10] relative overflow-hidden border-t border-black/5 dark:border-white/5 transition-colors duration-300">
      {/* Interactive Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 subtle-grid-why"
      />

      {/* Ambient Blue Core Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none rounded-full filter blur-[150px] opacity-[0.03]"
        style={{
          background: "radial-gradient(circle, #2B50DC 0%, transparent 70%)"
        }}
      />

      <div data-reveal className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="section-eyebrow text-blue-neon/80">[ Why socialX ]</div>
        <h2 className="section-title text-gray-900 dark:text-white transition-colors duration-300">
          Not another social media agency.<br />
          <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky">Built for HighLevel, only</span>.
        </h2>
        <p className="section-sub mb-20 text-gray-600 dark:text-gray-400 transition-colors duration-300">
          Built strictly around HighLevel features, by pioneers in the SaaS ecosystem since 2019.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          {reasons.map((r, i) => (
            <SpotlightCard key={r.num} r={r} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
