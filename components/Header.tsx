"use client";

import { useState, useEffect } from "react";

function Logo() {
  return (
    <a href="#" className="flex items-baseline gap-[2px] no-underline">
      <span className="font-grotesk text-[28px] font-medium text-gray-900">social</span>
      <span className="font-grotesk text-[32px] font-bold gradient-text leading-none">X</span>
    </a>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "How it works", href: "#gw-how" },
    { label: "Pricing", href: "#gw-pricing" },
    { label: "FAQ", href: "#gw-faq" },
  ];

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        backdropFilter: scrolled ? "blur(20px)" : "none",
        background: scrolled ? "rgba(244,242,239,0.92)" : "transparent",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-9">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="font-grotesk text-[15px] text-gray-500 hover:text-gray-900 transition-colors"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#gw-pricing"
              className="gradient-bg text-white font-grotesk font-semibold text-[15px] px-6 py-2.5 rounded-full transition-transform hover:-translate-y-px"
            >
              Get started
            </a>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col justify-center gap-[5px] p-2 -mr-2"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            <span
              className="block w-6 h-[2px] bg-gray-900 transition-all duration-300 origin-center"
              style={open ? { transform: "rotate(45deg) translateY(3.5px)" } : {}}
            />
            <span
              className="block w-6 h-[2px] bg-gray-900 transition-opacity duration-300"
              style={open ? { opacity: 0 } : {}}
            />
            <span
              className="block w-6 h-[2px] bg-gray-900 transition-all duration-300 origin-center"
              style={open ? { transform: "rotate(-45deg) translateY(-3.5px)" } : {}}
            />
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className="md:hidden overflow-hidden transition-all duration-300"
          style={{ maxHeight: open ? "320px" : "0" }}
        >
          <nav
            className="flex flex-col gap-1 pb-6"
            style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}
          >
            <div className="pt-3" />
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-grotesk text-base text-gray-600 hover:text-gray-900 py-2.5 transition-colors"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#gw-pricing"
              onClick={() => setOpen(false)}
              className="gradient-bg text-white font-grotesk font-semibold text-base text-center py-3.5 rounded-full mt-2"
            >
              Get started
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
