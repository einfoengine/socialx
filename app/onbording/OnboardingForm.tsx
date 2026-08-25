"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import SocialXLogo from "@/components/SocialXLogo";

export default function OnboardingForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      const el = spotlightRef.current;
      if (el) {
        el.style.transform = `translate(${e.clientX - 400}px, ${e.clientY - 400}px)`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen bg-[#F4F2EF] dark:bg-[#050508] text-[#04044A] dark:text-[#F4F2EF] transition-colors duration-300 flex flex-col overflow-hidden">
      {/* Interactive Spotlight */}
      {isMounted && (
        <div
          ref={spotlightRef}
          className="absolute top-0 left-0 w-[800px] h-[800px] is-circle pointer-events-none opacity-30 blur-[120px] transition-transform duration-75 ease-linear z-0"
          style={{
            background: "radial-gradient(circle, rgba(61,74,255,0.25) 0%, rgba(0,163,255,0.08) 50%, transparent 70%)",
          }}
        />
      )}

      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none z-0 subtle-grid"
        style={{
          maskImage: 'radial-gradient(ellipse at top center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top center, black 30%, transparent 80%)'
        }}
      />

      {/* Header */}
      <header className="relative z-10 w-full bg-[#050508] border-b border-white/10 py-5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center no-underline hover:opacity-90 transition-opacity">
            <SocialXLogo className="h-7 w-auto" />
          </Link>
          <Link
            href="/"
            className="font-grotesk text-sm font-medium text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-1.5"
          >
            <span>←</span> Back to Home
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start py-12 px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Eyebrow / Progress */}
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 font-grotesk text-[11px] font-medium tracking-[0.5px] uppercase bg-white/80 dark:bg-[#04044A]/80 backdrop-blur-sm border border-[#3D4AFF]/18 text-[#3D4AFF] dark:text-[#00A3FF] animate-fade-up">
          <span className="w-1.5 h-1.5 bg-blue-500 animate-pulse shrink-0 shadow-[0_0_6px_rgba(61,74,255,0.8)]" />
          Onboarding Process
        </div>

        {/* Title */}
        <h1 className="font-grotesk font-semibold text-4xl sm:text-5xl text-center tracking-tight mb-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
          Complete Your{" "}
          <span className="gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky">
            Onboarding
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-[16px] sm:text-[18px] text-gray-600 dark:text-gray-400 text-center max-w-2xl mb-12 leading-relaxed animate-fade-up" style={{ animationDelay: "200ms" }}>
          Welcome to socialX. Let's get you set up to start publishing automated, feature-targeted posts directly to your HighLevel Social Planner. Please fill out the onboarding form below.
        </p>

        {/* Form Card Container */}
        <div 
          className="w-full bg-white dark:bg-[#0b0b12]/80 border border-black/10 dark:border-white/[0.08] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_30px_80px_-24px_rgba(61,74,255,0.25)] p-4 sm:p-6 lg:p-8 relative min-h-[700px] flex flex-col justify-center overflow-hidden animate-fade-up"
          style={{ animationDelay: "300ms" }}
        >
          {/* Glowing subtle border highlight */}
          <div className="absolute inset-0 border border-white/5 pointer-events-none" />

          {/* Loader Skeleton */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-[#0b0b12] p-8 z-20 space-y-6">
              <div className="w-12 h-12 border-4 border-[#3D4AFF]/20 border-t-[#3D4AFF] is-circle animate-spin" />
              <div className="text-center space-y-2">
                <h3 className="font-grotesk text-lg font-medium text-gray-800 dark:text-gray-200">Loading Form...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Connecting to secure onboarding system</p>
              </div>
              <div className="w-full max-w-md space-y-4 pt-6">
                <div className="h-10 bg-gray-100 dark:bg-white/5 animate-pulse" />
                <div className="h-28 bg-gray-100 dark:bg-white/5 animate-pulse" />
                <div className="h-10 bg-gray-100 dark:bg-white/5 animate-pulse" />
              </div>
            </div>
          )}

          {/* Iframe */}
          <div className="w-full flex-1 min-h-[800px] relative">
            <iframe
              src="https://api.leadconnectorhq.com/widget/form/CYjMR7cKau8LAjY4HUdU"
              id="inline-CYjMR7cKau8LAjY4HUdU"
              data-layout="{'id':'INLINE'}"
              data-trigger-type="alwaysShow"
              data-trigger-value=""
              data-activation-type="alwaysActivated"
              data-activation-value=""
              data-deactivation-type="neverDeactivate"
              data-deactivation-value=""
              data-form-name="socialX Onboarding Form"
              data-height="3602"
              data-layout-iframe-id="inline-CYjMR7cKau8LAjY4HUdU"
              data-form-id="CYjMR7cKau8LAjY4HUdU"
              title="socialX Onboarding Form"
              onLoad={handleIframeLoad}
              className="transition-opacity duration-500"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                borderRadius: "8px",
                opacity: isLoading ? 0 : 1,
                minHeight: "800px",
              }}
            />
          </div>
        </div>

        {/* Support helper */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 animate-fade-up" style={{ animationDelay: "400ms" }}>
          Having trouble with the form? Reach out to us at{" "}
          <a href="mailto:hi@socialx.studio" className="text-[#3D4AFF] dark:text-blue-sky hover:underline">
            hi@socialx.studio
          </a>{" "}
          or use the support widget on the bottom right.
        </div>
      </main>

      {/* Simplified Footer */}
      <footer className="relative z-10 border-t border-black/5 dark:border-white/5 py-8 mt-12 bg-white/20 dark:bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-500 font-grotesk">
          <div>
            © 2026 socialX. A growX company. All rights reserved.
          </div>
          <div className="text-center md:text-right">
            Not affiliated with, endorsed by, or sponsored by HighLevel, Inc.
          </div>
        </div>
      </footer>

      {/* LeadConnector Form Embed Script */}
      <Script
        src="https://link.msgsndr.com/js/form_embed.js"
        strategy="afterInteractive"
      />
    </div>
  );
}
