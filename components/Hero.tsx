"use client";

import React, { useState, useEffect } from 'react';

export default function Hero() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section
      id="gw-hero"
      className="relative pt-16 pb-32 lg:pt-20 lg:pb-40 overflow-hidden flex flex-col items-center justify-center min-h-[90vh] bg-[#F4F2EF] dark:bg-[#050508] transition-colors duration-300"
    >
      {/* Interactive Cursor Spotlight */}
      {isMounted && (
        <div
          className="absolute top-0 left-0 w-[800px] h-[800px] rounded-full pointer-events-none opacity-40 blur-[100px] transition-transform duration-75 ease-linear z-0"
          style={{
            background: "radial-gradient(circle, rgba(43,80,220,0.3) 0%, rgba(91,141,239,0.1) 50%, transparent 70%)",
            transform: `translate(${mousePos.x - 400}px, ${mousePos.y - 400}px)`
          }}
        />
      )}

      {/* Subtle Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
        style={{
          maskImage: 'radial-gradient(ellipse at top center, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top center, black 20%, transparent 70%)'
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 xl:px-0 relative z-10 flex flex-col items-center text-center">

        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 mb-8 px-5 py-2.5 rounded-full font-grotesk text-[13px] font-medium tracking-[0.5px] uppercase shadow-sm transition-transform hover:scale-105 cursor-default bg-white/80 dark:bg-[#111118]/80 backdrop-blur-sm border border-[#2B50DC]/18 text-[#2B50DC] dark:text-[#5B8DEF]"
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(43,80,220,0.8)]" />
          [ For HighLevel SaaS resellers ]
        </div>

        {/* H1 */}
        <h1
          className="font-grotesk font-bold leading-[1.05] tracking-[-1.5px] sm:tracking-[-2.5px] mb-8 text-gray-900 dark:text-white drop-shadow-sm transition-colors duration-300"
          style={{ fontSize: "clamp(32px, 4.8vw, 64px)" }}
        >
          <span className="block md:inline-block md:whitespace-nowrap">Social media for HighLevel resellers.</span><br />
          <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky">Done for you.</span><br />
          Not by you.
        </h1>

        {/* Sub */}
        <p className="text-[20px] md:text-[22px] text-gray-600 dark:text-gray-400 leading-relaxed mb-12 max-w-3xl mx-auto transition-colors duration-300">
          We pull HighLevel-feature-targeted posts from a library that updates
          every time HL ships. Customized to your brand. Scheduled straight to
          your HL Social Planner. Your job ends at approval.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-5 items-center justify-center">
          <a
            href="#gw-pricing"
            className="group relative gradient-bg text-white px-10 py-5 rounded-[3px] font-grotesk font-semibold text-lg inline-flex items-center gap-3 transition-all duration-300 hover:scale-105 hover:shadow-[0_20px_40px_rgba(43,80,220,0.3)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative">See pricing</span>
            <span className="relative group-hover:translate-x-1 transition-transform">→</span>
          </a>
          <a
            href="#gw-how"
            className="group text-gray-700 dark:text-gray-300 px-10 py-5 rounded-[3px] font-grotesk font-semibold text-lg inline-flex items-center gap-2 transition-all duration-300 hover:scale-105 bg-white dark:bg-[#111118] hover:bg-gray-50 dark:hover:bg-gray-800 border border-black/10 dark:border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-md"
          >
            How it works
          </a>
        </div>

        {/* Mini Trust Indicator */}
        <div className="mt-16 flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-white/5 px-6 py-3 rounded-full border border-gray-200 dark:border-white/10 backdrop-blur-sm shadow-sm transition-transform hover:scale-105">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-[#F4F2EF] dark:border-[#050508] bg-gray-200 dark:bg-gray-800 shadow-sm"
                style={{
                  backgroundImage: `url(https://i.pravatar.cc/100?img=${i + 11})`,
                  backgroundSize: 'cover'
                }}
              />
            ))}
          </div>
          <span>Trusted by 800+ HL Resellers</span>
        </div>

      </div>
    </section>
  );
}
