"use client";

import React from "react";

export default function FooterReveal() {
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 -z-50 h-[280px] md:h-[380px] bg-[#050508] flex flex-col items-center justify-center overflow-hidden border-t border-white/5 pointer-events-none"
    >
      {/* Background Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Radial Glow Highlight */}
      <div
        className="absolute w-[600px] h-[300px] pointer-events-none rounded-full filter blur-[100px] opacity-[0.08]"
        style={{
          background: "radial-gradient(circle, #2B50DC 0%, transparent 70%)"
        }}
      />

      {/* Colossal brand logo centered */}
      <div className="font-grotesk font-black tracking-[-5px] md:tracking-[-10px] select-none text-[64px] sm:text-[100px] md:text-[140px] lg:text-[180px] xl:text-[220px] leading-none text-center flex items-baseline relative z-10">
        <span className="text-white/10">social</span>
        <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky leading-none">X</span>
      </div>

      {/* Subtle Parent Studio indicator under the logo */}
      <div className="font-grotesk text-[10px] md:text-xs text-white/20 uppercase tracking-[3px] mt-4 relative z-10 font-bold">
        [ Productized SaaS Socials by growX ]
      </div>
    </div>
  );
}
