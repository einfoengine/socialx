"use client";

import React from "react";

const portfolioItems = [
  {
    brand: "ApexCRM",
    logoBg: "bg-blue-600",
    logoLetter: "A",
    handle: "@apexcrm",
    tag: "Auto-Scheduling",
    time: "4h • 🌐",
    content: "Are you still losing clients because you take hours to reply to booking requests? Our auto-scheduler books leads directly into your calendar 24/7. No friction, just booked appointments. 📆✨",
    image: "/portfolio-post-1.png",
    likes: "142",
    comments: "18"
  },
  {
    brand: "LaunchPad CRM",
    logoBg: "bg-purple-600",
    logoLetter: "L",
    handle: "@launchpad",
    tag: "Lead Conversion",
    time: "1d • 🌐",
    content: "62% of calls to local businesses go unanswered—and 85% of those prospects won't call back. Our Missed Call Text-Back automatically texts prospects back instantly so you never lose a deal again. 📲",
    image: "/portfolio-post-2.png",
    likes: "285",
    comments: "37"
  },
  {
    brand: "GrowthCRM",
    logoBg: "bg-emerald-600",
    logoLetter: "G",
    handle: "@growthcrm",
    tag: "Visual Pipelines",
    time: "2d • 🌐",
    content: "Stop paying separate bills for activecampaign, Mailchimp, and Twilio. Our consolidated workflow builder runs all your SMS, email, and pipeline automations under one single login. Consolidate & scale. 🛠️",
    image: "/portfolio-post-3.png",
    likes: "342",
    comments: "42"
  },
  {
    brand: "Zeta CRM",
    logoBg: "bg-amber-600",
    logoLetter: "Z",
    handle: "@zetacrm",
    tag: "Reputation Engine",
    time: "3d • 🌐",
    content: "93% of customers read local reviews before booking. Our automated engine reaches out to clients right after service delivery to collect 5-star Google reviews on autopilot. Sell on trust. ⭐📈",
    image: "/portfolio-post-4.png",
    likes: "198",
    comments: "24"
  }
];

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
        <p className="text-[13px] text-gray-300 leading-relaxed font-chillax whitespace-normal mb-4 line-clamp-3">
          {item.content}
        </p>
      </div>

      {/* Client Graphic Image Mockup */}
      <div className="w-full h-48 overflow-hidden mb-4 border border-white/5 bg-navy-lift">
        <img 
          src={item.image} 
          alt={`${item.brand} Feature Visual`} 
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
          <p className="text-gray-400 text-[13.5px] leading-relaxed font-chillax">
            Real posts, engineered around real HighLevel features, in your branding, published automatically. Not stock filler with a logo on top.
          </p>
        </div>

        {/* Right Side: Attached Portfolio Marquee (No Gaps, Welded Grid) */}
        <div className="relative flex-1 overflow-hidden flex items-center bg-black">
          <div className="flex gap-0 w-max animate-marquee py-0 whitespace-nowrap hover:[animation-play-state:paused] cursor-grab active:cursor-grabbing">
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
