"use client";

import React from "react";

const LOGOS = [
  {
    name: "AuraCRM",
    svg: (
      <svg className="w-7 h-7 text-blue-sky transition-colors group-hover:text-blue-400" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="16" cy="16" r="12" strokeDasharray="4 2" />
        <circle cx="16" cy="16" r="6" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
    description: "SaaS CRM Integration",
    stats: "3.2x engagement"
  },
  {
    name: "PulseFlow",
    svg: (
      <svg className="w-7 h-7 text-[#5B8DEF] transition-colors group-hover:text-[#8cb1f5]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16h6l3-9 4 18 3-12 2 3h6" />
      </svg>
    ),
    description: "High-Ticket Workflows",
    stats: "+180% demo rate"
  },
  {
    name: "Vertex AI",
    svg: (
      <svg className="w-7 h-7 text-cyan-400 transition-colors group-hover:text-cyan-300" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M16 4L28 26H4L16 4Z" />
        <path d="M16 12L22 23H10L16 12Z" fill="currentColor" fillOpacity="0.3" />
      </svg>
    ),
    description: "Agentic AI Tools",
    stats: "1.2M impressions"
  },
  {
    name: "NexusSaaS",
    svg: (
      <svg className="w-7 h-7 text-emerald-400 transition-colors group-hover:text-emerald-300" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" />
        <circle cx="16" cy="16" r="4" fill="currentColor" fillOpacity="0.4" />
      </svg>
    ),
    description: "Multi-tenant Platform",
    stats: "4.8★ rating"
  },
  {
    name: "Zenith Growth",
    svg: (
      <svg className="w-7 h-7 text-purple-400 transition-colors group-hover:text-purple-300" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M16 4L26 16L16 28L6 16L16 4Z" />
        <path d="M16 10L21 16L16 22L11 16L16 10Z" fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
    description: "B2B Scale Agency",
    stats: "$250k pipeline"
  },
  {
    name: "SwiftClick",
    svg: (
      <svg className="w-7 h-7 text-rose-400 transition-colors group-hover:text-rose-300" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 10l8 6-8 6M16 10l8 6-8 6" />
      </svg>
    ),
    description: "Performance Acquisition",
    stats: "2.4% CTR increase"
  },
];

const METRICS = [
  { value: "800+", label: "HL SaaS Businesses", desc: "served by the founding team" },
  { value: "Since 2019", label: "HighLevel Ecosystem", desc: "active and building GHL-native solutions" },
  { value: "100%", label: "HL-Native Team", desc: "writers & designers, no GHL onboarding needed" },
];

export default function ClientLogos() {
  return (
    <section id="gw-client-logos" className="py-28 md:py-36 relative overflow-hidden bg-[#F4F2EF] dark:bg-[#0c0c10] transition-colors duration-300">
      {/* Background Subtle Gradient & Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] is-circle pointer-events-none filter blur-[120px] opacity-15"
        style={{
          background: "radial-gradient(circle, #2B50DC 0%, transparent 70%)"
        }}
      />
      
      <div 
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
      />

      <div data-reveal className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="section-eyebrow text-[#2B50DC] dark:text-[#5B8DEF] transition-colors duration-300">[ Why trust a new name ]</div>
          <h2 className="section-title text-gray-900 dark:text-white font-grotesk text-3xl md:text-5xl font-bold tracking-tight transition-colors duration-300">
            New name. Not a new team.
          </h2>
          <p className="section-sub text-gray-600 dark:text-white/70 mt-4 max-w-2xl mx-auto font-body text-[16px] md:text-[18px] transition-colors duration-300">
            socialX is new. The team behind it is not. We have produced HL-native content for 800+ SaaS businesses through GHL Video, the number one video team built only for HighLevel. socialX brings that same ecosystem fluency to your social feed.
          </p>
        </div>

        {/* Logo Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-20">
          {LOGOS.map((logo, i) => (
            <div
              key={logo.name}
              className="group relative flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-white/2 border border-black/5 dark:border-white/5 shadow-xs dark:shadow-[0_4px_20px_rgba(0, 0, 0, 0.2)]"
            >
              {/* Active glow hover border overlay */}
              <div className="absolute inset-0 border border-transparent group-hover:border-blue-sky/30 transition-colors duration-300 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4">
                {logo.svg}
                <span className="text-[10px] font-grotesk font-semibold text-gray-500 group-hover:text-blue-sky transition-colors">
                  {logo.stats}
                </span>
              </div>
              
              <div>
                <h4 className="font-grotesk text-sm font-semibold text-gray-900 dark:text-white leading-tight mb-1 transition-colors duration-300">
                  {logo.name}
                </h4>
                <p className="text-[11px] text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-400 transition-colors font-body">
                  {logo.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Metrics Banner */}
        <div 
          className="p-8 md:p-12 relative flex flex-col md:flex-row items-center justify-between gap-10 md:gap-6 bg-white/40 dark:bg-white/1 border border-black/5 dark:border-white/4 transition-colors duration-300"
        >
          {METRICS.map((metric, i) => (
            <div key={metric.label} className="flex-1 text-center md:text-left relative">
              {/* Divider for desktop */}
              {i > 0 && (
                <div className="hidden md:block absolute left-[-20%] top-1/2 -translate-y-1/2 h-12 w-px bg-black/10 dark:bg-white/10" />
              )}
              
              <div className="font-grotesk text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
                <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-sky to-blue-neon">
                  {metric.value}
                </span>
              </div>
              <div className="font-grotesk text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-[1.2px] mb-1 transition-colors">
                {metric.label}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-body transition-colors">
                {metric.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
