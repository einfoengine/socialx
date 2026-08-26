"use client";

import React, { useEffect, useRef, useState } from "react";
import SocialXLogo from "@socialx/ui/SocialXLogo";

/* The three brands behind socialX, on dark tiles in BOTH themes: the growX mark
   has a white wordmark that would vanish on this section's cream background.
   socialX renders through the inline component instead of an <img>, because its
   source wordmark is #04044A and would disappear on the dark tile — inlined, it
   takes currentColor and can go white.

   GHL Video points at the trimmed copy — the source file centres a 613x138 logo
   inside a 1080x1080 canvas, which would render the mark at ~13% scale. */
const BRANDS: { name: string; src: string | null; role: string; detail: string }[] = [
  {
    name: "growX",
    src: "/GrowX.svg",
    role: "Parent company",
    detail: "The studio socialX is built inside.",
  },
  {
    name: "socialX",
    src: null,
    role: "You are here",
    detail: "Social media management, built only for HighLevel SaaS resellers.",
  },
  {
    name: "GHL Video",
    src: "/ghl-video-mark.svg",
    role: "Sister brand",
    detail: "HL-native video for 800+ HighLevel SaaS businesses.",
  },
];

/**
 * Counts up to `to` the first time it scrolls into view, then stops.
 *
 * Renders the final value during SSR so the number is right without JS and the
 * layout never shifts, then rewinds to `from` on mount. This sits well below the
 * fold, so that rewind is never on screen. Matches ScrollReveal's approach:
 * IntersectionObserver, fires once, and honours prefers-reduced-motion by
 * simply leaving the final number in place.
 */
function CountUp({
  to,
  from = 0,
  duration = 1800,
}: {
  to: number;
  from?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setValue(from);

    let rafId = 0;
    let startedAt = 0;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.unobserve(el);

        const step = (now: number) => {
          if (!startedAt) startedAt = now;
          const p = Math.min((now - startedAt) / duration, 1);
          // easeOutExpo: sprints through the low numbers, then settles slowly on
          // the final digits, so the year is legible as it lands.
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          setValue(Math.round(from + (to - from) * eased));
          if (p < 1) rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [from, to, duration]);

  // tabular-nums keeps every digit the same width, so the number doesn't
  // jitter sideways while it counts.
  return (
    <span ref={ref} className="tabular-nums">
      {value}
    </span>
  );
}

export default function ClientLogos() {
  return (
    <section id="gw-client-logos" className="py-28 md:py-36 relative overflow-hidden bg-[#F4F2EF] dark:bg-[#0c0c10] transition-colors duration-300">
      {/* Background Subtle Gradient & Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] is-circle pointer-events-none filter blur-[120px] opacity-15"
        style={{
          background: "radial-gradient(circle, #3D4AFF 0%, transparent 70%)"
        }}
      />
      
      <div 
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
      />

      <div data-reveal className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="section-eyebrow text-[#3D4AFF] dark:text-[#00A3FF] transition-colors duration-300">[ Why trust a new name ]</div>
          <h2 className="section-title text-gray-900 dark:text-white font-grotesk text-3xl md:text-5xl font-bold tracking-tight transition-colors duration-300">
            New name. <span className="gradient-text">Not a new team</span>.
          </h2>
          <p className="section-sub text-gray-600 dark:text-white/70 mt-4 max-w-2xl mx-auto font-body text-[16px] md:text-[18px] transition-colors duration-300">
            socialX is the social arm of growX, built by the same team behind GHL
            Video. Everything we already know about HighLevel, pointed at your feed.
          </p>
        </div>

        {/* Brand tiles */}
        <div className="grid sm:grid-cols-3 gap-5 mb-20 max-w-5xl mx-auto">
          {BRANDS.map((b) => (
            <div
              key={b.name}
              className="group relative flex flex-col items-center text-center px-6 py-10 bg-[#04044A] border border-white/8 transition-all duration-300 hover:-translate-y-1 hover:border-blue-neon/40 hover:shadow-[0_16px_40px_rgba(61,74,255,0.18)]"
            >
              {/* Fixed logo box so three different aspect ratios still line up:
                  each mark is contained within the same 170x36 area. */}
              <div className="flex h-9 w-full items-center justify-center mb-7">
                {b.src ? (
                  <img
                    src={b.src}
                    alt={`${b.name} logo`}
                    className="max-h-9 max-w-[170px] w-auto object-contain"
                  />
                ) : (
                  <SocialXLogo className="max-h-9 w-auto max-w-[170px] text-white" />
                )}
              </div>

              <div className="font-grotesk text-[11px] font-semibold uppercase tracking-[1.2px] text-blue-sky mb-2">
                {b.role}
              </div>
              <p className="text-[13px] leading-relaxed text-gray-400 font-body">
                {b.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Single proof point, replacing the old three-metric banner */}
        <div className="relative px-6 py-14 md:py-20 text-center bg-white/40 dark:bg-white/1 border border-black/5 dark:border-white/4 transition-colors duration-300">
          <div className="font-grotesk text-[12px] md:text-[13px] font-semibold uppercase tracking-[1.5px] text-gray-500 dark:text-gray-400 mb-3 transition-colors">
            We have been serving since
          </div>
          <div
            className="font-grotesk font-bold leading-none tracking-[-3px]"
            style={{ fontSize: "clamp(64px, 10vw, 132px)" }}
          >
            <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-sky to-blue-neon">
              <CountUp to={2019} />
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
