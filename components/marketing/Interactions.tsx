"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/track";

/**
 * Page-level interaction effects ported from legacy scripts.js:
 * - .animate-enter elements play on intersection
 * - .flashlight-container mouse tracking (--x/--y custom props)
 * - smooth scroll for same-page anchors
 * - section-view + scroll-depth analytics
 * Render once per page that needs these behaviors.
 */
export function PageInteractions({
  trackedSections = [],
}: {
  trackedSections?: string[];
}) {
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Scroll-triggered entrance animations
    const animated = document.querySelectorAll<HTMLElement>(".animate-enter");
    const animObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.animationPlayState = "running";
            animObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    for (const el of animated) {
      el.style.animationPlayState = "paused";
      animObserver.observe(el);
    }

    // Flashlight mouse tracking
    const containers = document.querySelectorAll<HTMLElement>(
      ".flashlight-container",
    );
    const onMove = (e: MouseEvent) => {
      for (const container of containers) {
        const rect = container.getBoundingClientRect();
        container.style.setProperty("--x", `${e.clientX - rect.left}px`);
        container.style.setProperty("--y", `${e.clientY - rect.top}px`);
      }
    };
    if (containers.length > 0) {
      document.addEventListener("mousemove", onMove);
    }

    // Smooth scroll for anchors
    const onClick = (e: Event) => {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href^="#"]',
      );
      if (!anchor) return;
      const target = document.querySelector(anchor.getAttribute("href")!);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    };
    document.addEventListener("click", onClick);

    // Section view tracking
    const sections = trackedSections
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current.has(entry.target.id)) {
            fired.current.add(entry.target.id);
            trackEvent("section_viewed", { section_name: entry.target.id });
          }
        }
      },
      { threshold: 0.5 },
    );
    for (const s of sections) sectionObserver.observe(s);

    // Scroll depth tracking
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

    return () => {
      animObserver.disconnect();
      sectionObserver.disconnect();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, [trackedSections]);

  return null;
}
