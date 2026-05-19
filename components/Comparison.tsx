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
      <span className={isHighlighted ? "text-[#2B50DC] font-bold text-[15px] font-grotesk" : "text-gray-700 font-chillax text-[14.5px]"}>
        {value}
      </span>
    );
  }
  
  if (value === true) {
    return (
      <div className="flex items-center justify-center">
        <span className="text-[#2B50DC] font-black text-xl leading-none" title="Yes / Included">✓</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center">
      <span className="text-gray-300 font-bold text-base leading-none" title="No / Missing">✗</span>
    </div>
  );
}

export default function Comparison() {
  return (
    <section id="gw-comparison" className="py-32 md:py-40 relative overflow-hidden" style={{ background: "#F4F2EF" }}>
      {/* Background Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
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
        <div className="overflow-x-auto rounded-none border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
          <table className="w-full border-collapse text-[14.5px] text-left" style={{ minWidth: "920px" }}>
            <thead>
              <tr className="border-b border-black/10">
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-400 bg-gray-50/50 w-[240px]">
                  Feature / Dimension
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-bold text-white bg-[#2B50DC] text-center w-[220px]">
                  ✨ socialX (Done-for-you)
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 text-center">
                  Generic SMM Agency
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 text-center">
                  In-House VA (Upwork)
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 text-center">
                  Fiverr Freelancers
                </th>
                <th className="p-6 font-grotesk text-xs uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/50 text-center">
                  DIY (Canva + AI)
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className="border-b border-black/5 hover:bg-gray-50/30 transition-colors">
                  {/* Dimension Name */}
                  <td className="p-6 font-grotesk font-semibold text-gray-900 border-r border-black/5">
                    {row.metric}
                  </td>
                  
                  {/* socialX Column (Highlighted Column) */}
                  <td className="p-6 text-center bg-blue-50/40 border-x border-[#2B50DC]/20">
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
        <div className="mt-14 p-8 border border-blue-neon/20 bg-blue-neon/[0.02] flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h4 className="font-grotesk text-lg font-bold text-gray-900 leading-snug">
              Stop acting like a content manager. Start acting like a software CEO.
            </h4>
            <p className="text-gray-600 text-sm mt-1">
              Delegating your socials to socialX costs less than a single client subscription.
            </p>
          </div>
          <a 
            href="#gw-pricing" 
            className="px-6 py-3 bg-[#2B50DC] hover:bg-[#1f3bb3] text-white font-grotesk font-semibold text-sm transition-all shadow-[0_4px_12px_rgba(43,80,220,0.2)] hover:shadow-[0_6px_20px_rgba(43,80,220,0.3)] shrink-0"
          >
            See Our Reseller Plans →
          </a>
        </div>
      </div>
    </section>
  );
}
