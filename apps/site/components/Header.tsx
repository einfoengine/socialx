"use client";

import { portalUrl } from "@socialx/core/urls";
import { useState, useEffect, useRef } from "react";
import SocialXLogo from "@socialx/ui/SocialXLogo";

function Logo() {
  return (
    <a href="/" className="nav-logo flex shrink-0 items-center no-underline">
      <SocialXLogo className="h-7 w-auto shrink-0" />
    </a>
  );
}

function ThemeToggle({ theme, toggleTheme }: { theme: "light" | "dark"; toggleTheme: () => void }) {
  return (
    <button
      onClick={toggleTheme}
      className="nav-icon btn-icon relative flex items-center justify-center w-9 h-9 border focus:outline-hidden"
      aria-label="Toggle theme"
    >
      {/* Sun icon */}
      <svg
        className={`w-[18px] h-[18px] transition-all duration-300 absolute ${
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
        className={`w-[18px] h-[18px] transition-all duration-300 absolute ${
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

/* Stroke weight and cap style match the calendar glyph in the actions area, so
   the menu reads as part of the same icon set. */
function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="w-[18px] h-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/* The bar used to carry all seven section anchors side by side, which left the
   three regions fighting for width and nothing readable at a glance. The four
   mid-funnel sections now sit behind one "How It Works" trigger; Demos, Pricing
   and FAQ stay one click away because they are what visitors actually hunt for.

   It was "Product" with a "[ The platform ]" eyebrow. Both were wrong for this
   brand: socialX is a productized service, and HighLevel is the platform, which
   the site must never appear to claim. The children are named after the section
   eyebrows they open, so "Features" no longer lands a visitor on the pain cards.

   Each row carries a one-line summary drawn from the section it points at, so
   the menu previews the page rather than just naming anchors. */
type NavLink = { label: string; href: string };
type MenuLink = NavLink & { description: string; icon: React.ReactNode };
type NavItem = NavLink | { label: string; eyebrow: string; children: MenuLink[] };

/* The portal is not live yet, so the public site does not advertise a sign-in.
   Flip this to true to bring the Login button back in both the bar and the
   drawer; the markup below is kept intact rather than deleted for that reason. */
const SHOW_LOGIN = false;

const navItems: NavItem[] = [
  { label: "Demos", href: "/demos" },
  {
    label: "How It Works",
    eyebrow: "[ The service ]",
    children: [
      {
        label: "The Trust Gap",
        href: "/#gw-problem",
        description: "Why a dead feed costs you deals.",
        icon: (
          <MenuIcon>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </MenuIcon>
        ),
      },
      {
        label: "The Process",
        href: "/#gw-how",
        description: "Three steps. Then it runs monthly.",
        icon: (
          <MenuIcon>
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="12" r="2.5" />
            <circle cx="6" cy="18" r="2.5" />
            <path d="M8.2 7.2 15.8 11M8.2 16.8 15.8 13" />
          </MenuIcon>
        ),
      },
      {
        label: "Why socialX",
        href: "/#gw-why-socialx",
        description: "HighLevel-only, by resellers since 2019.",
        icon: (
          <MenuIcon>
            <path d="m12 3 2.3 6.2 6.2 2.3-6.2 2.3L12 20l-2.3-6.2L3.5 11.5l6.2-2.3Z" />
          </MenuIcon>
        ),
      },
      {
        label: "Comparison",
        href: "/#gw-comparison",
        description: "The honest trade-off on each option.",
        icon: (
          <MenuIcon>
            <path d="M3 21h18" />
            <rect x="5" y="11" width="4.5" height="7" />
            <rect x="14.5" y="5" width="4.5" height="13" />
          </MenuIcon>
        ),
      },
    ],
  },
  { label: "Pricing", href: "/#gw-pricing" },
  { label: "FAQ", href: "/#gw-faq" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Light is the default; reflect whatever the init script set (dark only if saved).
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  /* A dropdown opened by hover still has to close for pointer-less input, so
     back it with an outside click and Escape rather than hover alone. */
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  /* The drawer animates on max-height, so it needs a real number. Measuring the
     content beats a hard-coded ceiling that silently clips when links change. */
  useEffect(() => {
    setDrawerHeight(open ? (drawerRef.current?.scrollHeight ?? 0) : 0);
  }, [open]);

  /* Take the background of whatever section is currently behind the bar.
     Reading the computed colour rather than a hard-coded map means this keeps
     working through the dark-mode toggle, the one section that sets its colour
     inline, and any section added later. */
  useEffect(() => {
    const header = document.getElementById("gw-header");
    if (!header) return;

    const toRgb = (c: string): [number, number, number] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(",").map((n) => parseFloat(n));
      // A see-through section can't tint the bar; fall through to the page.
      if (parts.length > 3 && parts[3] < 0.5) return null;
      return [parts[0], parts[1], parts[2]];
    };

    let raf = 0;
    const update = () => {
      raf = 0;
      // Probe just inside the bar's bottom edge.
      const probe = header.getBoundingClientRect().bottom - 1;
      const candidates = document.querySelectorAll<HTMLElement>("main section, #gw-footer");

      let rgb: [number, number, number] | null = null;
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) {
          rgb = toRgb(getComputedStyle(el).backgroundColor);
          if (rgb) break;
        }
      }
      if (!rgb) rgb = toRgb(getComputedStyle(document.body).backgroundColor);
      if (!rgb) return;

      const surface = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      header.style.backgroundColor = surface;
      // The dropdown paints below the bar, outside this element's own box, so it
      // reads the colour from a token instead of inheriting it.
      header.style.setProperty("--nav-surface", surface);
      // Perceived brightness decides which foreground tone stays legible.
      const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
      header.dataset.tone = lum > 0.55 ? "light" : "dark";
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
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

  const closeDrawer = () => setOpen(false);

  return (
    <header id="gw-header" className="sticky top-0 z-50 w-full bg-[#050508]">
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
          <nav className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-6 xl:gap-8">
            {navItems.map((item) =>
              "children" in item ? (
                <div
                  key={item.label}
                  ref={menuRef}
                  /* Full bar height, so the panel's `top-full` lands on the
                     bar's bottom edge instead of the trigger's, and the whole
                     column is a hover target. */
                  className="relative flex h-[76px] items-center"
                  onMouseEnter={() => setMenuOpen(item.label)}
                  onMouseLeave={() => setMenuOpen(null)}
                >
                  <button
                    type="button"
                    onClick={() => setMenuOpen((m) => (m === item.label ? null : item.label))}
                    aria-expanded={menuOpen === item.label}
                    aria-haspopup="true"
                    className="nav-link font-grotesk text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer focus:outline-hidden"
                  >
                    {item.label}
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${
                        menuOpen === item.label ? "rotate-180" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* The wrapper's top padding bridges the gap to the bar, so the
                      pointer never crosses dead space and closes the menu. */}
                  <div
                    className={`absolute left-1/2 top-full -translate-x-1/2 pt-2 transition-all duration-200 ${
                      menuOpen === item.label
                        ? "visible opacity-100 translate-y-0"
                        : "invisible opacity-0 -translate-y-1"
                    }`}
                  >
                    <div className="nav-menu w-[400px] border shadow-[0_28px_64px_-24px_rgba(4,4,74,0.5)]">
                      {/* Same gradient as the primary CTA, so the panel is
                          unmistakably part of the brand and not a browser chrome. */}
                      <div className="gradient-bg h-[3px] w-full" />

                      <div className="nav-menu-eyebrow px-5 pt-4 pb-1 font-grotesk text-[11px] font-medium uppercase tracking-[1.5px]">
                        {item.eyebrow}
                      </div>

                      <div className="py-2">
                        {item.children.map((c) => (
                          <a
                            key={c.label}
                            href={c.href}
                            onClick={() => setMenuOpen(null)}
                            className="nav-menu-row flex items-center gap-3.5 px-5 py-3 transition-colors duration-200"
                          >
                            <span className="nav-menu-tile flex h-9 w-9 shrink-0 items-center justify-center">
                              {c.icon}
                            </span>
                            <span className="min-w-0">
                              <span className="nav-menu-label block font-grotesk text-sm font-semibold leading-tight">
                                {c.label}
                              </span>
                              <span className="nav-menu-desc mt-1 block text-xs leading-snug">
                                {c.description}
                              </span>
                            </span>
                            <span className="nav-menu-arrow ml-auto shrink-0 pl-2 font-grotesk text-sm">
                              →
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="nav-link font-grotesk text-sm font-medium whitespace-nowrap"
                >
                  {item.label}
                </a>
              )
            )}
          </nav>

          {/* 3 — Actions */}
          <div className="flex flex-1 items-center justify-end gap-3">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <a
              href="/#gw-book"
              aria-label="Book a meeting"
              title="Book a meeting"
              className="nav-icon btn-icon hidden lg:flex items-center justify-center w-9 h-9 shrink-0 border"
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
            {/* Existing clients, not prospects: outlined so it stays clearly
                secondary to the one primary call to action beside it. */}
            {SHOW_LOGIN && (
              <a
                href={portalUrl("/login")}
                className="nav-btn btn-icon hidden lg:inline-flex h-9 shrink-0 items-center border px-4 font-grotesk text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
              >
                Login
              </a>
            )}
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
                className="nav-bar block w-6 h-[2px] transition-all duration-300 origin-center"
                style={open ? { transform: "rotate(45deg) translateY(5px)" } : {}}
              />
              <span
                className="nav-bar block w-6 h-[2px] transition-opacity duration-300"
                style={open ? { opacity: 0 } : {}}
              />
              <span
                className="nav-bar block w-6 h-[2px] transition-all duration-300 origin-center"
                style={open ? { transform: "rotate(-45deg) translateY(-5px)" } : {}}
              />
            </button>
          </div>
        </div>

        {/* Mobile menu. No dropdowns here — vertical space is cheap, so the
            grouping shows as a labelled block instead of another tap target. */}
        <div
          className="nav-drawer lg:hidden overflow-hidden transition-all duration-300"
          style={{ maxHeight: drawerHeight }}
        >
          <nav ref={drawerRef} className="nav-drawer flex flex-col gap-1 pb-6 border-t">
            <div className="pt-3" />
            {navItems.map((item) =>
              "children" in item ? (
                <div key={item.label} className="border-b border-[var(--nav-line)] py-3">
                  <div className="font-grotesk text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--nav-muted)] opacity-70">
                    {item.label}
                  </div>
                  <div className="mt-1 flex flex-col">
                    {item.children.map((c) => (
                      <a
                        key={c.label}
                        href={c.href}
                        onClick={closeDrawer}
                        className="nav-link font-grotesk text-sm font-medium py-2"
                      >
                        {c.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={closeDrawer}
                  className="nav-link font-grotesk text-sm font-medium py-3 border-b border-[var(--nav-line)]"
                >
                  {item.label}
                </a>
              )
            )}
            {SHOW_LOGIN && (
              <a
                href={portalUrl("/login")}
                onClick={closeDrawer}
                className="nav-btn btn-icon flex items-center justify-center border py-3 mt-4 font-grotesk text-xs font-semibold uppercase tracking-wider"
              >
                Login
              </a>
            )}
            <a
              href="/#gw-pricing"
              onClick={closeDrawer}
              className="btn btn-primary group gradient-bg text-white font-grotesk font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 py-3.5 mt-2 shadow-[0_8px_20px_rgba(61,74,255,0.25)]"
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
