"use client";

import React from "react";

import portfolioItems from "@/public/portfolio.json";

function PortfolioCard({ item }: { item: typeof portfolioItems[0] }) {
  return (
    <div className="w-[340px] h-[520px] bg-black border-r border-white/10 p-6 flex flex-col justify-between select-none shrink-0 text-left transition-colors hover:bg-[#111118]">
      {/* Header & Copy */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full ${item.logoBg} flex items-center justify-center font-grotesk text-white font-bold text-sm`}>
            {item.logoLetter}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-grotesk text-sm font-semibold text-white leading-none">{item.brand}</span>
              <span className="text-blue-500 text-xs" title="Verified SaaS Feature Post">✓</span>
            </div>
            <span className="text-gray-500 text-[11px] block mt-0.5">{item.handle} • {item.tag}</span>
          </div>
          <span className="ml-auto text-gray-500 text-[11px]">{item.time}</span>
        </div>
        
        {/* Post Text */}
        <p className="text-[13px] text-gray-300 leading-relaxed font-body whitespace-normal mb-4 line-clamp-3">
          {item.content}
        </p>
      </div>

      {/* Client Graphic Image Mockup */}
      <div className="w-full h-[280px] overflow-hidden mb-4 border border-white/5 bg-navy-lift">
        <img
          src={item.image}
          alt={`${item.brand} Feature Visual`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover filter brightness-90 hover:brightness-100 transition-all duration-300"
          draggable="false"
        />
      </div>

      {/* Engagement Footer */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-white/5 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-sky">👍</span>
          <span className="font-grotesk text-gray-400">{item.likes}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>💬</span>
          <span className="font-grotesk text-gray-400">{item.comments} comments</span>
        </div>
        <span className="text-gray-600 hover:text-gray-400 cursor-pointer font-grotesk">Share</span>
      </div>
    </div>
  );
}

export default function PortfolioMarquee() {
  return (
    <section id="gw-portfolio" className="bg-black py-0 relative overflow-hidden w-full border-b border-white/5">
      <div className="w-full flex flex-col md:flex-row items-stretch bg-black overflow-hidden">
        {/* Left Side: Solid Box */}
        <div className="p-8 md:p-12 lg:p-14 flex flex-col justify-center bg-[#111118] border-b md:border-b-0 md:border-r border-white/10 md:w-[380px] lg:w-[420px] shrink-0 z-10 pl-6 md:pl-16 lg:pl-24 xl:pl-32 2xl:pl-40">
          <span className="text-[11px] font-grotesk text-blue-sky uppercase tracking-[1.5px] mb-3 block">
            [ Live Content Proof ]
          </span>
          <h4 className="font-grotesk text-2xl lg:text-3xl font-bold leading-tight text-white tracking-[-0.8px] mb-4">
            This is how <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky">prospects should find you</span>.
          </h4>
          <p className="text-gray-400 text-[13.5px] leading-relaxed font-body">
            Real posts, engineered around real HighLevel features, in your branding, published automatically. Not stock filler with a logo on top.
          </p>
        </div>

        {/* Right Side: Attached Portfolio Marquee (No Gaps, Welded Grid) */}
        <div className="relative flex-1 overflow-hidden flex items-center bg-black">
          <div className="flex gap-0 w-max animate-[marquee_120s_linear_infinite] py-0 whitespace-nowrap hover:[animation-play-state:paused] cursor-grab active:cursor-grabbing">
            {/* Double arrays for perfect looping */}
            {portfolioItems.map((item, index) => (
              <PortfolioCard key={`${item.brand}-${index}`} item={item} />
            ))}
            {portfolioItems.map((item, index) => (
              <PortfolioCard key={`${item.brand}-dup-${index}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
