"use client";

import { useEffect } from "react";

/**
 * Legacy scroll-reveal (shipable.html / dare.html inline script): adds
 * `.is-in` to `.reveal` / `.reveal-fade` elements when they intersect the
 * viewport. Falls back to revealing everything when IntersectionObserver
 * is unavailable. Render once per page that uses the reveal classes.
 */
export function ScrollRevealInit() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(
      ".reveal, .reveal-fade",
    );
    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
