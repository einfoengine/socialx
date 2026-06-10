"use client";
 
import React from "react";
 
type CellType = "yes" | "neutral" | "no" | "cost";
 
interface CellInfo {
  type: CellType;
  label: string;
}
 
interface ComparisonRow {
  metric: string;
  socialX: CellInfo;
  diy: CellInfo;
  agency: CellInfo;
  freelancer: CellInfo;
  ai: CellInfo;
  isCost?: boolean;
}
 
const comparisonData: ComparisonRow[] = [
  {
    metric: "Built only for HighLevel",
    socialX: { type: "yes", label: "Yes" },
    diy: { type: "neutral", label: "You know it" },
    agency: { type: "no", label: "No" },
    freelancer: { type: "no", label: "No" },
    ai: { type: "no", label: "No" }
  },
  {
    metric: "Feature-targeted to sell your software",
    socialX: { type: "yes", label: "Engineered for it" },
    diy: { type: "neutral", label: "If you have time" },
    agency: { type: "no", label: "Generic" },
    freelancer: { type: "neutral", label: "Rarely" },
    ai: { type: "no", label: "Generic" }
  },
  {
    metric: "Matched to your brand and voice",
    socialX: { type: "yes", label: "Scaled by plan" },
    diy: { type: "yes", label: "Yes, it is you" },
    agency: { type: "neutral", label: "Sometimes" },
    freelancer: { type: "neutral", label: "Sometimes" },
    ai: { type: "no", label: "No" }
  },
  {
    metric: "Auto-scheduled to your HL Social Planner",
    socialX: { type: "yes", label: "Direct" },
    diy: { type: "no", label: "Manual" },
    agency: { type: "no", label: "Exports" },
    freelancer: { type: "no", label: "Manual" },
    ai: { type: "no", label: "No" }
  },
  {
    metric: "Motion video included",
    socialX: { type: "yes", label: "Growth and up" },
    diy: { type: "no", label: "No" },
    agency: { type: "neutral", label: "Extra cost" },
    freelancer: { type: "neutral", label: "Extra cost" },
    ai: { type: "no", label: "No" }
  },
  {
    metric: "Refreshed when HighLevel ships features",
    socialX: { type: "yes", label: "Always current" },
    diy: { type: "no", label: "No" },
    agency: { type: "no", label: "No" },
    freelancer: { type: "no", label: "No" },
    ai: { type: "no", label: "No" }
  },
  {
    metric: "No hiring, managing, or chasing",
    socialX: { type: "yes", label: "Hands off" },
    diy: { type: "no", label: "All you" },
    agency: { type: "neutral", label: "Some" },
    freelancer: { type: "no", label: "You manage" },
    ai: { type: "no", label: "All you" }
  },
  {
    metric: "Monthly cost",
    isCost: true,
    socialX: { type: "cost", label: "From $197" },
    diy: { type: "cost", label: "Your time" },
    agency: { type: "cost", label: "High retainer" },
    freelancer: { type: "cost", label: "Variable" },
    ai: { type: "cost", label: "Cheap, low return" }
  }
];
 
function CellValue({ cell, isSx }: { cell: CellInfo; isSx?: boolean }) {
  if (cell.type === "cost") {
    return (
      <span className={isSx
        ? "text-white font-bold text-[15.5px] font-grotesk transition-colors"
        : "text-gray-700 dark:text-gray-300 font-chillax text-[14.5px] transition-colors"
      }>
        {cell.label}
      </span>
    );
  }
 
  return (
    <div className="flex items-center justify-center gap-2">
      {cell.type === "yes" && (
        <svg 
          className={`w-4.5 h-4.5 ${isSx ? "text-[#01E7FF]" : "text-cyan-500 dark:text-[#01E7FF]"} shrink-0`} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.6" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
      {cell.type === "neutral" && (
        <svg 
          className="w-4.5 h-4.5 text-amber-500 shrink-0" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.6" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      )}
      {cell.type === "no" && (
        <svg 
          className="w-4.5 h-4.5 text-slate-400 dark:text-slate-600 shrink-0" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      )}
      <span className={`text-[13.5px] font-chillax transition-colors ${
        isSx 
          ? "text-[#01E7FF] font-semibold" 
          : cell.type === "yes" 
            ? "text-gray-800 dark:text-gray-200 font-medium"
            : "text-gray-500 dark:text-gray-500"
      }`}>
        {cell.label}
      </span>
    </div>
  );
}
 
export default function Comparison() {
  return (
    <section id="gw-comparison" className="py-32 md:py-40 relative overflow-hidden bg-white dark:bg-[#050508] transition-colors duration-300">
      {/* Background Subtle Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none z-0 subtle-grid" />
 
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="section-eyebrow text-[#2B50DC] dark:text-[#5B8DEF] transition-colors duration-300">[ Comparison ]</div>
          <h2 className="section-title text-gray-900 dark:text-white font-grotesk text-3xl md:text-5xl font-bold tracking-tight mb-6 transition-colors duration-300">
            Stop bleeding time. Start selling software.
          </h2>
          <p className="section-sub text-gray-600 dark:text-white/70 max-w-3xl mx-auto font-chillax text-[16px] md:text-[18px] leading-relaxed transition-colors duration-300">
            Every reseller tries one of these. Here is the honest trade-off on each, and where socialX is different.
          </p>
        </div>
 
        {/* Comparison Table Card */}
        <div className="overflow-x-auto rounded-none border border-black/10 dark:border-white/10 bg-gray-50/50 dark:bg-[#111118] shadow-[0_12px_40px_rgba(0,0,0,0.04)] dark:shadow-md transition-colors duration-300 mb-20">
          <table className="w-full border-collapse text-[14.5px] text-left" style={{ minWidth: "980px" }}>
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 w-[260px]">
                  &nbsp;
                </th>
                <th className="p-6 font-grotesk text-center w-[200px] bg-[#111118] dark:bg-black border-x border-b border-x-[#2B50DC]/40 dark:border-x-[#2B50DC]/50 border-b-white/20">
                  <span className="inline-block px-3 py-1 font-grotesk text-xs font-bold uppercase tracking-[1px] bg-gradient-to-r from-[#2B50DC] to-[#5B8DEF] text-white rounded-none">
                    socialX
                  </span>
                </th>
                <th className="p-6 font-grotesk text-center w-[160px]">
                  <div className="font-bold text-gray-900 dark:text-white text-sm">You</div>
                  <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">do it yourself</div>
                </th>
                <th className="p-6 font-grotesk text-center w-[160px]">
                  <div className="font-bold text-gray-900 dark:text-white text-sm">Generic agency</div>
                  <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">SMM shop</div>
                </th>
                <th className="p-6 font-grotesk text-center w-[160px]">
                  <div className="font-bold text-gray-900 dark:text-white text-sm">Freelancer</div>
                  <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">hired help</div>
                </th>
                <th className="p-6 font-grotesk text-center w-[160px]">
                  <div className="font-bold text-gray-900 dark:text-white text-sm">AI tools</div>
                  <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">auto-generate</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr 
                  key={index} 
                  className={`border-b border-black/15 dark:border-white/15 hover:bg-gray-50/30 dark:hover:bg-white/1 transition-colors ${
                    row.isCost ? "bg-black/[0.01] dark:bg-white/[0.01] font-semibold" : ""
                  }`}
                >
                  {/* Dimension Name */}
                  <td className="p-6 font-grotesk font-semibold text-gray-900 dark:text-white border-r border-black/5 dark:border-white/5">
                    {row.metric}
                  </td>
                  
                  {/* socialX Column (Highlighted Column) */}
                  <td className="p-6 text-center bg-[#111118] dark:bg-black border-x border-b border-x-[#2B50DC]/30 dark:border-x-[#2B50DC]/40 border-b-white/15">
                    <CellValue cell={row.socialX} isSx={true} />
                  </td>
 
                  {/* DIY */}
                  <td className="p-6 text-center">
                    <CellValue cell={row.diy} />
                  </td>
 
                  {/* Generic Agency */}
                  <td className="p-6 text-center">
                    <CellValue cell={row.agency} />
                  </td>
 
                  {/* Freelancer */}
                  <td className="p-6 text-center">
                    <CellValue cell={row.freelancer} />
                  </td>
 
                  {/* AI Tools */}
                  <td className="p-6 text-center">
                    <CellValue cell={row.ai} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
 
        {/* High-Converting Bottom Text Banner */}
        <div className="max-w-4xl mx-auto border border-black/10 dark:border-white/10 bg-gray-50/30 dark:bg-[#111118]/30 p-10 text-center relative z-10 transition-colors duration-300">
          <h3 className="font-grotesk text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            Stop acting like a content manager. Start acting like a software CEO.
          </h3>
          <p className="font-chillax text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Delegating your social to socialX costs less than a single client subscription, and frees you to do the one thing only you can: grow the business.
          </p>
          <a 
            href="#gw-pricing" 
            className="inline-block bg-[#111118] text-white hover:bg-black dark:bg-white dark:text-[#111118] dark:hover:bg-gray-100 font-grotesk font-semibold text-sm px-8 py-4 tracking-[0.5px] transition-all duration-200"
          >
            See our reseller plans
          </a>
        </div>
      </div>
    </section>
  );
}
