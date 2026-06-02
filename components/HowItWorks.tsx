"use client";

import React, { useRef, useState } from "react";

const steps = [
  {
    num: "01",
    title: "Sign up and intake.",
    body: "15-minute brand form — logo, colors, ICP, platforms. One time, then done.",
  },
  {
    num: "02",
    title: "We build your batch.",
    body: "We pull from the HL-feature library and customize everything to your ICP. Growth and Scale get custom posts and motion videos too.",
  },
  {
    num: "03",
    title: "Approve. We schedule.",
    body: "Review and approve the batch. We load everything straight into your HL Social Planner. Posts publish on autopilot.",
  },
];

function StepCard({ s, i }: { s: typeof steps[0]; i: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        // Handle potential autoplay block gracefully
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="relative overflow-hidden card-sky rounded-none p-10 animate-fade-up transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_20px_40px_rgba(43,80,220,0.15)] hover:border-blue-neon/30"
      style={{ animationDelay: `${i * 0.12}s` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Background on Hover */}
      <video
        ref={videoRef}
        src="/hover-bg-2.mp4"
        preload="none"
        muted
        loop
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 z-0 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Dark overlay to protect text contrast on hover */}
      <div 
        className={`absolute inset-0 bg-black/60 transition-opacity duration-500 z-[1] ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Content Container */}
      <div className="relative z-10">
        <div
          className={`font-grotesk font-bold leading-none mb-6 transition-all duration-500 ${
            isHovered ? "text-white bg-none" : "gradient-text"
          }`}
          style={{ fontSize: "72px", letterSpacing: "-3px" }}
        >
          {s.num}
        </div>
        <h3 
          className={`font-grotesk text-[21px] font-semibold mb-3 leading-snug tracking-[-0.4px] transition-colors duration-300 ${
            isHovered ? "text-white" : "text-gray-900"
          }`}
        >
          {s.title}
        </h3>
        <p 
          className={`text-[15px] leading-relaxed transition-colors duration-300 ${
            isHovered ? "text-gray-300" : "text-gray-500"
          }`}
        >
          {s.body}
        </p>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="py-32 md:py-40 relative overflow-hidden" id="gw-how" style={{ background: "white" }}>
      {/* Subtle Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at top center, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top center, black 20%, transparent 70%)'
        }}
      />

      {/* Subtle blue glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(43,80,220,0.05) 0%, transparent 65%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="section-eyebrow">[ The socialX system ]</div>
        <h2 className="section-title">
          A social media engine that<br />
          runs <span className="gradient-text">without you</span>.
        </h2>
        <p className="section-sub mb-20">
          Three steps. Then it runs every month, on schedule, in your HL Social Planner.
        </p>

        <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {steps.map((s, i) => (
            <StepCard key={s.num} s={s} i={i} />
          ))}
        </div>

        <p className="text-center mt-14 font-grotesk text-[17px] font-medium text-blue-neon">
          First batch in 7 days. After that, it just runs.
        </p>
      </div>
    </section>
  );
}
