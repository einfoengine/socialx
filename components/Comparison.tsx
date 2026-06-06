"use client";

import React from "react";

const comparisonData = [
  {
    metric: "HL Native Expertise",
    socialX: true,
    agency: false,
    va: false,
    fiverr: false,
    diy: false
  },
  {
    metric: "Social Planner Sync",
    socialX: true,
    agency: false,
    va: false,
    fiverr: false,
    diy: false
  },
  {
    metric: "Zero Mgmt Overhead",
    socialX: true,
    agency: false,
    va: false,
    fiverr: false,
    diy: false
  },
  {
    metric: "Motion Videos & Graphics",
    socialX: true,
    agency: false,
    va: false,
    fiverr: false,
    diy: false
  },
  {
    metric: "Monthly Cost",
    isPrice: true,
    socialX: "$197/mo",
    agency: "$1,500+/mo",
    va: "$600+/mo",
    fiverr: "$200+/mo",
    diy: "Free (Costs Time)"
  }
];

function CellValue({ 
  value, 
  isPrice, 
  isHighlighted 
}: { 
  value: any; 
  isPrice?: boolean; 
  isHighlighted?: boolean; 
}) {
  if (isPrice) {
    return (
      <span className={isHighlighted ? "text-[#2B50DC] dark:text-[#5B8DEF] font-bold text-[15px] font-grotesk transition-colors" : "text-gray-700 dark:text-gray-300 font-chillax text-[14.5px] transition-colors"}>
        {value}
      </span>
    );
  }
  
  if (value === true) {
    return (
      <div className="flex items-center justify-center">
        <span className="text-[#2B50DC] dark:text-[#5B8DEF] font-black text-xl leading-none transition-colors" title="Yes / Included">✓</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center">
      <span className="text-gray-300 dark:text-gray-700 font-bold text-base leading-none transition-colors" title="No / Missing">✗</span>
    </div>
  );
}

export default function Comparison() {
  return (
    <section id="gw-comparison" className="py-32 md:py-40 relative overflow-hidden bg-white dark:bg-[#050508] transition-colors duration-300">
      {/* Background Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="section-eyebrow">[ Comparison Matrix ]</div>
        <h2 className="section-title">
          Stop bleeding time.<br />
          Start selling software.
        </h2>
        <p className="section-sub mb-20 text-gray-600">
          How socialX stacks up against the typical options. Look at the trade-offs honestly.
        </p>

        {/* Comparison Table Card */}
        <div className="overflow-x-auto rounded-none border border-black/10 dark:border-white/10 bg-gray-50/50 dark:bg-[#111118] shadow-[0_12px_40px_rgba(0,0,0,0.04)] dark:shadow-md transition-colors duration-300">
          <table className="w-full border-collapse text-[14.5px] text-left" style={{ minWidth: "920px" }}>
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-400 bg-gray-50/50 dark:bg-white/2 w-[240px]">
                  Feature / Dimension
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-bold text-white bg-[#2B50DC] text-center w-[220px]">
                  ✨ socialX (Done-for-you)
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 dark:bg-white/2 dark:text-gray-400 text-center">
                  Generic SMM Agency
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 dark:bg-white/2 dark:text-gray-400 text-center">
                  In-House VA (Upwork)
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 dark:bg-white/2 dark:text-gray-400 text-center">
                  Fiverr Freelancers
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 dark:bg-white/2 dark:text-gray-400 text-center">
                  DIY (Canva + AI)
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className="border-b border-black/5 dark:border-white/5 hover:bg-gray-50/30 dark:hover:bg-white/1 transition-colors">
                  {/* Dimension Name */}
                  <td className="p-6 font-grotesk font-semibold text-gray-900 dark:text-white border-r border-black/5 dark:border-white/5">
                    {row.metric}
                  </td>
                  
                  {/* socialX Column (Highlighted Column) */}
                  <td className="p-6 text-center bg-blue-50/40 dark:bg-[#2B50DC]/5 border-x border-[#2B50DC]/20 dark:border-[#2B50DC]/30">
                    <CellValue value={row.socialX} isPrice={row.isPrice} isHighlighted={true} />
                  </td>

                  {/* Generic Agency */}
                  <td className="p-6 text-center">
                    <CellValue value={row.agency} isPrice={row.isPrice} />
                  </td>

                  {/* In-House VA */}
                  <td className="p-6 text-center">
                    <CellValue value={row.va} isPrice={row.isPrice} />
                  </td>

                  {/* Fiverr */}
                  <td className="p-6 text-center">
                    <CellValue value={row.fiverr} isPrice={row.isPrice} />
                  </td>

                  {/* DIY */}
                  <td className="p-6 text-center">
                    <CellValue value={row.diy} isPrice={row.isPrice} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* High-Converting Bottom Text Banner */}
        <div className="mt-14 p-8 border border-blue-neon/20 dark:border-blue-neon/30 bg-blue-neon/[0.02] dark:bg-blue-neon/[0.04] flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
          <div>
            <h4 className="font-grotesk text-lg font-bold text-gray-900 dark:text-white leading-snug">
              Stop acting like a content manager. Start acting like a software CEO.
            </h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Delegating your socials to socialX costs less than a single client subscription.
            </p>
          </div>
          <a 
            href="#gw-pricing" 
            className="px-6 py-3 bg-[#2B50DC] hover:bg-[#1f3bb3] text-white font-grotesk font-semibold text-sm transition-all shadow-[0_4px_12px_rgba(43,80,220,0.2)] hover:shadow-[0_6px_20px_rgba(43,80,220,0.3)] shrink-0 rounded-[3px]"
          >
            See Our Reseller Plans →
          </a>
        </div>
      </div>
    </section>
  );
}
