"use client";

import React, { useState, useEffect } from 'react';

export default function Hero() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // YouTube product demo — played inline on click (privacy-friendly nocookie embed).
  const YT_ID = "DjGmzzNAXpM";
  const YT_EMBED_URL = `https://www.youtube-nocookie.com/embed/${YT_ID}?autoplay=1&rel=0`;
  const YT_THUMB = `https://img.youtube.com/vi/${YT_ID}/maxresdefault.jpg`;

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
          [ Social Media Management For HighLevel SaaS ]
        </div>

        {/* H1 */}
        <h1
          className="font-grotesk font-bold leading-[1.05] tracking-[-1.5px] sm:tracking-[-2.5px] mb-8 text-gray-900 dark:text-white drop-shadow-sm transition-colors duration-300"
          style={{ fontSize: "clamp(30px, 4.2vw, 58px)" }}
        >
          {/* <span className="block md:inline-block md:whitespace-nowrap">Social Media Management<br></br><span className='gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky'>for HighLevel resellers.</span></span><br /> */}
          {/* <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky">Done for you.</span> &nbsp;
          Not by you. */}
          Make your{" "}
          <span className='gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky'>
            HighLevel SaaS <br className="hidden sm:block" />look like the market leader.
          </span>{" "}
          <br className="hidden sm:block" />Without writing a single post.
        </h1>

        {/* Sub */}
        <p className="text-[17px] md:text-[18px] text-gray-600 dark:text-gray-400 leading-relaxed mb-12 max-w-5xl mx-auto transition-colors duration-300">
          We design and write feature-targeted posts, customize them to your brand and voice,{" "}
          <br className="hidden lg:block" />and schedule them straight into your HL Social Planner. You review, you approve, we handle the rest.
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

        {/* Product demo video */}
        <div className="w-full max-w-4xl mx-auto mt-16 lg:mt-20">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-black/10 dark:border-white/10 shadow-[0_30px_80px_-24px_rgba(43,80,220,0.4)] bg-[#0a0a14]">
            {videoPlaying ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={YT_EMBED_URL}
                title="socialX product demo"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setVideoPlaying(true)}
                aria-label="Play the product demo"
                className="group absolute inset-0 flex flex-col items-center justify-center gap-5 cursor-pointer"
                style={{
                  backgroundImage: `linear-gradient(rgba(10,10,20,0.45), rgba(10,10,20,0.55)), url(${YT_THUMB})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <span className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-white shadow-2xl transition-transform duration-300 group-hover:scale-110">
                  <svg className="w-7 h-7 text-[#2B50DC] ml-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="font-grotesk text-sm font-medium tracking-wide text-white/90">
                  Watch the product demo
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
