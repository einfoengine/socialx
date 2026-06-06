"use client";

import { useState, useEffect } from "react";

function Logo() {
  return (
    <a href="#" className="flex items-center no-underline">
      <img
        src="/socialX-logo-white.png"
        alt="socialX logo"
        className="h-8 w-auto object-contain"
      />
    </a>
  );
}

function ThemeToggle({ theme, toggleTheme }: { theme: "light" | "dark"; toggleTheme: () => void }) {
  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 cursor-pointer focus:outline-hidden"
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
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    // Listen for changes to prefers-color-scheme in system settings
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        if (e.matches) {
          document.documentElement.classList.add("dark");
          setTheme("dark");
        } else {
          document.documentElement.classList.remove("dark");
          setTheme("light");
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
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
    { label: "Features", href: "#gw-problem" },
    { label: "How It Works", href: "#gw-how" },
    { label: "Comparison", href: "#gw-comparison" },
    { label: "Why socialX", href: "#gw-why-socialx" },
    { label: "FAQ", href: "#gw-faq" },
  ];

  return (
    <header id="gw-header" className="sticky top-0 z-50 w-full bg-[#050508]/85 backdrop-blur-md border-b border-white/10">
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
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <a
              href="#gw-pricing"
              className="bg-[#2B50DC] hover:bg-[#1f3bb3] text-white font-grotesk font-semibold text-xs tracking-wider uppercase px-6 py-3 rounded-[3px] transition-colors duration-300"
            >
              Get started
            </a>
          </nav>

          {/* Mobile menu trigger */}
          <div className="md:hidden flex items-center gap-4">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <button
              className="flex flex-col justify-center gap-[5px] p-2 -mr-2 cursor-pointer"
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
