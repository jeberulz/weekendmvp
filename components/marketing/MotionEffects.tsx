"use client";

import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/track";

export type MotionEffect =
  | "reveal"
  | "flashlight"
  | "smooth-anchor"
  | "section-view"
  | "scroll-depth";

type MotionEffectsProps = {
  /**
   * Which observers / listeners to mount on this page. Pages pay only for
   * the effects they opt into. Default mirrors the typical marketing page
   * (entrance reveals + same-page anchor smoothing).
   */
  effects?: MotionEffect[];
  /**
   * IDs of `<section>` nodes to fire `section_viewed` analytics for.
   * Ignored unless the `"section-view"` effect is enabled.
   */
  trackedSections?: string[];
};

/**
 * Collapsed motion-effects mount that replaces `PageInteractions` +
 * `ScrollRevealInit`. Each effect is opt-in:
 *
 * - `reveal`        animates `.animate-enter` AND `.reveal` / `.reveal-fade`
 *                   targets into view once they intersect the viewport.
 *                   Respects `prefers-reduced-motion` by revealing
 *                   immediately instead of animating.
 * - `flashlight`    tracks the cursor over `.flashlight-container` nodes,
 *                   setting `--x` / `--y` custom properties used by the
 *                   `.flashlight-bg` utility.
 * - `smooth-anchor` upgrades same-page `a[href^="#"]` clicks to a smooth
 *                   `scrollIntoView`.
 * - `section-view`  fires a single `section_viewed` analytics event the
 *                   first time each `trackedSections` id crosses 50%
 *                   visible.
 * - `scroll-depth`  fires `scroll_depth` analytics at the 50/75/100%
 *                   document scroll milestones.
 *
 * Returns `null`; it only registers listeners.
 */
export function MotionEffects({
  effects = ["reveal", "smooth-anchor"],
  trackedSections = [],
}: MotionEffectsProps) {
  const firedSections = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enabled = new Set<MotionEffect>(effects);
    const cleanups: Array<() => void> = [];

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- reveal ---------------------------------------------------------
    if (enabled.has("reveal")) {
      const animateEnter =
        document.querySelectorAll<HTMLElement>(".animate-enter");
      const revealNodes = document.querySelectorAll<HTMLElement>(
        ".reveal, .reveal-fade",
      );

      if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        for (const el of animateEnter) {
          el.style.animationPlayState = "running";
        }
        for (const el of revealNodes) {
          el.classList.add("is-in");
        }
      } else {
        const animObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                (entry.target as HTMLElement).style.animationPlayState =
                  "running";
                animObserver.unobserve(entry.target);
              }
            }
          },
          { threshold: 0.1 },
        );
        for (const el of animateEnter) {
          el.style.animationPlayState = "paused";
          animObserver.observe(el);
        }

        const revealObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-in");
                revealObserver.unobserve(entry.target);
              }
            }
          },
          { threshold: 0.12 },
        );
        for (const el of revealNodes) revealObserver.observe(el);

        cleanups.push(() => {
          animObserver.disconnect();
          revealObserver.disconnect();
        });
      }
    }

    // --- flashlight -----------------------------------------------------
    if (enabled.has("flashlight") && !prefersReducedMotion) {
      const containers = document.querySelectorAll<HTMLElement>(
        ".flashlight-container",
      );
      if (containers.length > 0) {
        const onMove = (e: MouseEvent) => {
          for (const container of containers) {
            const rect = container.getBoundingClientRect();
            container.style.setProperty("--x", `${e.clientX - rect.left}px`);
            container.style.setProperty("--y", `${e.clientY - rect.top}px`);
          }
        };
        document.addEventListener("mousemove", onMove);
        cleanups.push(() => {
          document.removeEventListener("mousemove", onMove);
        });
      }
    }

    // --- smooth-anchor --------------------------------------------------
    if (enabled.has("smooth-anchor")) {
      const onClick = (e: Event) => {
        const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>(
          'a[href^="#"]',
        );
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || href === "#") return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const behavior: ScrollBehavior = prefersReducedMotion
            ? "auto"
            : "smooth";
          (target as HTMLElement).scrollIntoView({ behavior });
        }
      };
      document.addEventListener("click", onClick);
      cleanups.push(() => {
        document.removeEventListener("click", onClick);
      });
    }

    // --- section-view ---------------------------------------------------
    if (
      enabled.has("section-view") &&
      trackedSections.length > 0 &&
      "IntersectionObserver" in window
    ) {
      const sections = trackedSections
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (
              entry.isIntersecting &&
              !firedSections.current.has(entry.target.id)
            ) {
              firedSections.current.add(entry.target.id);
              trackEvent("section_viewed", { section_name: entry.target.id });
            }
          }
        },
        { threshold: 0.5 },
      );
      for (const s of sections) sectionObserver.observe(s);
      cleanups.push(() => sectionObserver.disconnect());
    }

    // --- scroll-depth ---------------------------------------------------
    if (enabled.has("scroll-depth")) {
      const depths = [50, 75, 100];
      const seen = new Set<number>();
      const onScroll = () => {
        const scrolled =
          ((window.scrollY + window.innerHeight) /
            document.documentElement.scrollHeight) *
          100;
        for (const d of depths) {
          if (scrolled >= d && !seen.has(d)) {
            seen.add(d);
            trackEvent("scroll_depth", { depth_percent: d });
          }
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [effects, trackedSections]);

  return null;
}
