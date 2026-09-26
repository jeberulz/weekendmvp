"use client";

import { useEffect } from "react";

/**
 * Loads the homepage scroll motion (`./scenes`, GSAP) once the page is idle
 * and its fonts are in, so it never competes with the first paint. Nothing
 * loads when the visitor prefers reduced motion, and every section stays as
 * the server rendered it until the script arms it.
 */
export function HomeMotion() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const load = () => {
      Promise.all([import("./scenes"), document.fonts.ready])
        .then(([{ startHomeMotion }]) => {
          if (!cancelled) stop = startHomeMotion();
        })
        // Motion is decoration: if the chunk fails to load, the page stays as rendered.
        .catch(() => {});
    };
    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle ? window.requestIdleCallback(load, { timeout: 2000 }) : window.setTimeout(load, 300);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      stop?.();
    };
  }, []);
  return null;
}
