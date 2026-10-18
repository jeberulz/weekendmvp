"use client";

import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/primitives/Logo";
import { cn } from "@/lib/utils";

const ANCHORS = [
  { href: "#what-youll-do", label: "What you'll do" },
  { href: "#ticket", label: "Price" },
  { href: "#faq", label: "FAQ" },
] as const;

/**
 * Minimal pill nav for the paid Build-Along page only.
 * Logo → home · section anchors · Get my ticket → #ticket.
 * Mobile: logo + CTA; anchors in a small menu.
 */
export function MinimalLiveNav({
  ctaLabel,
  ctaHref = "#ticket",
  ctaDisabled = false,
}: {
  ctaLabel: string;
  ctaHref?: string;
  ctaDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const ctaClass = cn(
    "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
    ctaDisabled
      ? "cursor-not-allowed border border-dashed border-home-rule bg-home-sunk text-[#6B6457]"
      : "bg-[#A84A00] text-white hover:bg-[#8F3F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84A00]",
  );

  return (
    <header className="sticky top-0 z-50 flex justify-center px-4 pt-4 sm:pt-6">
      <nav
        aria-label="Build-Along"
        className="relative flex h-14 w-full max-w-[896px] items-center justify-between rounded-full border border-home-rule bg-[#F7F3EC]/85 px-4 shadow-lg backdrop-blur-xl sm:pl-6 sm:pr-2"
      >
        <Link
          href="/"
          aria-label="Weekend MVP home"
          className="flex items-center rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-orange"
        >
          <Logo className="h-4 w-32 text-home-ink md:h-5 md:w-40" />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {ANCHORS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="text-xs font-medium text-[#4A453C] transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange"
            >
              {a.label}
            </a>
          ))}
          {ctaDisabled ? (
            <span className={ctaClass} aria-disabled="true">
              {ctaLabel}
            </span>
          ) : (
            <a href={ctaHref} className={ctaClass}>
              {ctaLabel}
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {ctaDisabled ? (
            <span className={ctaClass} aria-disabled="true">
              {ctaLabel}
            </span>
          ) : (
            <a href={ctaHref} className={ctaClass}>
              {ctaLabel}
            </a>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-home-rule bg-home-card text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange"
            aria-expanded={open}
            aria-controls="live-min-nav-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" className="font-mono text-base">
              {open ? "×" : "☰"}
            </span>
          </button>
        </div>

        {open ? (
          <div
            id="live-min-nav-menu"
            className="absolute top-[calc(100%+8px)] right-0 left-0 rounded-2xl border border-home-rule bg-home-card p-3 shadow-lg md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {ANCHORS.map((a) => (
                <li key={a.href}>
                  <a
                    href={a.href}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-home-ink hover:bg-home-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange"
                    onClick={() => setOpen(false)}
                  >
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
