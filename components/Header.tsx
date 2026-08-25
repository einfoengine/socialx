"use client";

import { useState, useEffect } from "react";
import SocialXLogo from "./SocialXLogo";

function Logo() {
  return (
    <a href="/" className="flex shrink-0 items-center text-white no-underline">
      <SocialXLogo className="h-7 w-auto shrink-0" />
    </a>
  );
}

function ThemeToggle({ theme, toggleTheme }: { theme: "light" | "dark"; toggleTheme: () => void }) {
  return (
    <button
      onClick={toggleTheme}
      className="btn-icon relative flex items-center justify-center w-9 h-9 border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 focus:outline-hidden"
      aria-label="Toggle theme"
    >
      {/* Sun icon */}
      <svg
        className={`w-[18px] h-[18px] text-gray-200 transition-all duration-300 absolute ${
          theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14 12a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {/* Moon icon */}
      <svg
        className={`w-[18px] h-[18px] text-gray-200 transition-all duration-300 absolute ${
          theme === "light" ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Light is the default; reflect whatever the init script set (dark only if saved).
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
    }
  };

  const navLinks = [
    { label: "Demos", href: "/demos" },
    { label: "Features", href: "/#gw-problem" },
    { label: "How It Works", href: "/#gw-how" },
    { label: "Pricing", href: "/#gw-pricing" },
    { label: "Comparison", href: "/#gw-comparison" },
    { label: "Why socialX", href: "/#gw-why-socialx" },
    { label: "FAQ", href: "/#gw-faq" },
  ];

  return (
    <header id="gw-header" className="sticky top-0 z-50 w-full bg-[#050508]/85 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Three equal regions: branding, navigation, actions. Each takes flex-1
            from a zero basis, so the left and right regions always resolve to the
            same width and the nav sits optically centred in the bar regardless of
            how wide the logo or the buttons happen to be. */}
        <div className="flex items-center h-[76px] gap-4">
          {/* 1 — Branding */}
          <div className="flex flex-1 items-center justify-start">
            <Logo />
          </div>

          {/* 2 — Navigation */}
          <nav className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-4 xl:gap-8">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="font-grotesk text-sm font-medium whitespace-nowrap text-gray-400 hover:text-white transition-colors duration-300"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* 3 — Actions */}
          <div className="flex flex-1 items-center justify-end gap-4">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <a
              href="/#gw-book"
              aria-label="Book a meeting"
              title="Book a meeting"
              className="btn-icon hidden lg:flex items-center justify-center w-9 h-9 shrink-0 border border-white/10 hover:border-white/25 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white"
            >
              <svg
                className="w-[18px] h-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" />
                <path d="M8 2.5v5M16 2.5v5M3 10.5h18" />
                <path d="m9 15.5 2 2 4-4" />
              </svg>
            </a>
            <a
              href="/#gw-pricing"
              className="btn btn-primary group hidden lg:inline-flex shrink-0 items-center gap-2 whitespace-nowrap gradient-bg text-white font-grotesk font-semibold text-xs tracking-wider uppercase px-6 py-3 shadow-[0_8px_20px_rgba(61,74,255,0.25)]"
            >
              <span>Get started</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>

            {/* Mobile menu trigger */}
            <button
              className="lg:hidden flex flex-col justify-center gap-[5px] p-2 -mr-2 cursor-pointer"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle navigation"
              aria-expanded={open}
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
        </div>

        {/* Mobile menu */}
        <div
          className="lg:hidden overflow-hidden transition-all duration-300 bg-[#050508]"
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
              href="/#gw-pricing"
              onClick={() => setOpen(false)}
              className="btn btn-primary group gradient-bg text-white font-grotesk font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 py-3.5 mt-4 shadow-[0_8px_20px_rgba(61,74,255,0.25)]"
            >
              <span>Get started</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
