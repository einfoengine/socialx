"use client";

import React, { useState } from "react";

const productLinks = [
  { label: "How It Works", href: "#gw-how" },
  { label: "Pricing Tiers", href: "#gw-pricing" },
  { label: "Comparison", href: "#gw-comparison" },
  { label: "Guarantees", href: "#gw-guarantees" },
];

const companyLinks = [
  { label: "growX parent", href: "https://growx.studio" },
  { label: "GHL Explainer", href: "#" },
  { label: "GHL Video", href: "https://ghlvideo.com" },
  { label: "Contact Us", href: "mailto:hi@socialx.studio" },
];

const legalLinks = [
  { label: "Terms of Service", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "Cookie Settings", href: "#" },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer id="gw-footer" className="pt-20 pb-12 bg-[#0a0a0f] relative z-10 overflow-hidden border-t border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] mb-[180px] md:mb-[260px]">
      {/* Subtle Grid Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Ambient Radial Neon Glow */}
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[500px] pointer-events-none rounded-full filter blur-[150px] opacity-[0.06]"
        style={{
          background: "radial-gradient(circle, #2B50DC 0%, transparent 70%)"
        }}
      />

      {/* Gigantic Desaturated Logo Backdrop */}
      <div className="absolute -bottom-10 left-10 font-grotesk font-black text-[120px] text-white/[0.01] select-none pointer-events-none leading-none tracking-tighter">
        socialX
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <a href="#" className="flex items-center no-underline">
              <img
                src="/socialX-logo-white.png"
                alt="socialX logo"
                className="h-8 w-auto object-contain"
              />
            </a>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed max-w-sm font-body">
              Productized social media built exclusively for HighLevel SaaS resellers. Showcase your software features on autopilot. 800+ HL agencies served since 2019.
            </p>
            <div className="mt-6 font-grotesk text-xs text-gray-500">
              socialx.studio · <a href="mailto:hi@socialx.studio" className="text-blue-sky hover:text-white transition-colors">hi@socialx.studio</a>
            </div>
          </div>

          {/* Links Columns */}
          {[
            { title: "Product", links: productLinks },
            { title: "Company", links: companyLinks },
            { title: "Legal", links: legalLinks },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-grotesk text-[12px] font-bold text-white uppercase tracking-[1.5px] mb-5">
                {col.title}
              </h4>
              <ul className="space-y-3 font-body">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-xs text-gray-500 hover:text-white transition-all duration-300 hover:pl-1 inline-block"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter & Sub-footer */}
        <div className="border-t border-white/5 pt-12 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Newsletter Intake */}
          <div className="w-full lg:max-w-md">
            <h4 className="font-grotesk text-[14px] font-bold text-white mb-2 uppercase tracking-[0.5px]">
              Get Free CRM SaaS Templates
            </h4>
            <p className="text-xs text-gray-500 font-body mb-4">
              High-converting social graphics and copies dropped straight to your inbox weekly.
            </p>
             {subscribed ? (
              <div className="p-3 border border-blue-neon/20 bg-blue-neon/[0.02] text-xs text-blue-sky font-grotesk font-semibold rounded-[3px]">
                ✓ Successful! We've sent your first template batch.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="Enter your agency email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/[0.02] border border-white/10 px-4 py-2 text-xs font-body text-white focus:outline-hidden focus:border-[#2B50DC]/50 flex-1 rounded-[3px] placeholder-gray-600"
                />
                <button
                  type="submit"
                  className="bg-[#2B50DC] hover:bg-[#1f3bb3] text-white px-5 py-2 font-grotesk text-xs font-semibold tracking-wider uppercase transition-colors rounded-[3px]"
                >
                  Join →
                </button>
              </form>
            )}
          </div>

          {/* Copyrights */}
          <div className="text-center lg:text-right font-grotesk text-xs text-gray-600 leading-relaxed shrink-0">
            <div>© 2026 socialX. A growX company. All rights reserved.</div>
            <div className="mt-1">Not affiliated with, endorsed by, or sponsored by HighLevel, Inc.</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
