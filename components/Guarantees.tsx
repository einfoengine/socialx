"use client";

import React from "react";

const stats = [
  { 
    num: "$0",   
    label: "Setup Fees",             
    sub: "No hidden onboarding charges. Pay only your plan price." 
  },
  { 
    num: "0",    
    label: "Long-term Contracts",   
    sub: "Zero lock-ins. Cancel, pause, or scale your plan anytime." 
  },
  { 
    num: "100%", 
    label: "White-Label Ready",     
    sub: "Delivered strictly in your brand voice and visual style." 
  },
];

export default function Guarantees() {
  return (
    <section id="gw-guarantees" className="py-32 md:py-40 bg-[#F4F2EF] dark:bg-[#0c0c10] relative overflow-hidden border-t border-b border-black/10 dark:border-white/5 transition-colors duration-300">
      {/* Subtle Black and White Background Video - Disabled for performance optimization (20.4MB)
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none z-0 filter grayscale"
      >
        <source src="/section-bg.mp4" type="video/mp4" />
      </video>
      */}

      {/* Subtle Grid Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
      />

      {/* Subtle bottom-centered spotlight */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none rounded-full filter blur-[120px] opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, #2B50DC 0%, transparent 70%)"
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Consistent Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <div className="section-eyebrow text-[#2B50DC] dark:text-blue-sky/80 transition-colors duration-300">[ No-Risk Commitment ]</div>
          <h2 className="section-title text-gray-900 dark:text-white transition-colors duration-300">
            Grow with confidence.<br />
            We remove <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky">all the friction</span>.
          </h2>
          <p className="section-sub max-w-2xl mx-auto text-gray-600 dark:text-white/60 transition-colors duration-300">
            No setup fees, no long-term contract lock-ins, and 100% white-label ready content. Simple, transparent partnerships built for software resellers.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-3 gap-0 border border-black/10 dark:border-white/5 bg-gray-50/50 dark:bg-black/40 backdrop-blur-md transition-colors duration-300">
          {stats.map((s, index) => (
            <div
              key={s.label}
              className={`p-8 md:p-12 flex flex-col items-center text-center transition-all duration-300 hover:bg-black/5 dark:hover:bg-white/[0.02] ${
                index !== 2 ? "border-b sm:border-b-0 sm:border-r border-black/10 dark:border-white/5" : ""
              }`}
            >
              <div
                className="font-grotesk font-bold text-gray-900 dark:text-white mb-4 leading-none tracking-[-2px] text-5xl md:text-6xl transition-colors duration-300"
              >
                {s.num}
              </div>
              <div className="font-grotesk text-base font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-[0.5px] transition-colors duration-300">
                {s.label}
              </div>
              <p className="font-chillax text-xs text-gray-600 dark:text-gray-500 leading-relaxed max-w-[240px] transition-colors duration-300">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
