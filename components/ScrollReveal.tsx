"use client";

import { useEffect } from "react";

/**
 * Mounts once and reveals any element tagged with `data-reveal` as it scrolls
 * into view (fade + rise). Each element animates a single time, then is
 * unobserved. Optional `data-reveal-delay` (ms) staggers grouped items.
 *
 * No animation library — just IntersectionObserver + the CSS in globals.css.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    if (els.length === 0) return;

    // Respect reduced-motion: show everything immediately, no animation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.setAttribute("data-visible", "true"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const delay = el.getAttribute("data-reveal-delay");
          if (delay) el.style.transitionDelay = `${delay}ms`;
          el.setAttribute("data-visible", "true");
          obs.unobserve(el);
        });
      },
      // Trigger as the element approaches the viewport (slightly before it
      // enters) so the fade plays right as it appears — no perceived delay.
      { threshold: 0, rootMargin: "0px 0px 8% 0px" }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
