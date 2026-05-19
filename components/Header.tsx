"use client";

import { useState } from "react";

function Logo() {
  return (
    <a href="#" className="flex items-baseline gap-[2px] no-underline">
      <span className="font-grotesk text-[28px] font-medium text-white">social</span>
      <span className="font-grotesk text-[32px] font-bold gradient-text bg-clip-text text-transparent bg-linear-to-r from-blue-neon to-blue-sky leading-none">X</span>
    </a>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  const navLinks = [
    { label: "Features", href: "#gw-problem" },
    { label: "How It Works", href: "#gw-how" },
    { label: "Comparison", href: "#gw-comparison" },
    { label: "Why socialX", href: "#gw-why-socialx" },
    { label: "FAQ", href: "#gw-faq" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#050508] border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-[76px]">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="font-grotesk text-sm font-medium text-gray-400 hover:text-white transition-colors duration-300"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#gw-pricing"
              className="bg-[#2B50DC] hover:bg-[#1f3bb3] text-white font-grotesk font-semibold text-xs tracking-wider uppercase px-6 py-3 rounded-[3px] transition-colors duration-300"
            >
              Get started
            </a>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col justify-center gap-[5px] p-2 -mr-2 cursor-pointer"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            <span
              className="block w-6 h-[2px] bg-white transition-all duration-300 origin-center"
              style={open ? { transform: "rotate(45deg) translateY(5px)" } : {}}
            />
            <span
              className="block w-6 h-[2px] bg-white transition-opacity duration-300"
              style={open ? { opacity: 0 } : {}}
            />
            <span
              className="block w-6 h-[2px] bg-white transition-all duration-300 origin-center"
              style={open ? { transform: "rotate(-45deg) translateY(-5px)" } : {}}
            />
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className="md:hidden overflow-hidden transition-all duration-300 bg-[#050508]"
          style={{ maxHeight: open ? "360px" : "0" }}
        >
          <nav
            className="flex flex-col gap-1 pb-6 border-t border-white/10"
          >
            <div className="pt-3" />
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-grotesk text-sm font-medium text-gray-400 hover:text-white py-3 transition-colors duration-300 border-b border-white/[0.03]"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#gw-pricing"
              onClick={() => setOpen(false)}
              className="bg-[#2B50DC] hover:bg-[#1f3bb3] text-white font-grotesk font-semibold text-xs tracking-wider uppercase text-center py-3.5 rounded-[3px] mt-4 transition-colors duration-300"
            >
              Get started
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
