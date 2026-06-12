"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/primitives/Logo";

const READING_LINKS = [
  { label: "Browse Ideas", href: "/startup-ideas" },
  { label: "Articles", href: "/articles" },
  { label: "Newsletter", href: "/newsletter" },
  { label: "Starter Kit", href: "/starter-kit" },
];

/**
 * Minimal dark reading nav for newsletter pages, ported from
 * partials/nav-reading.html.
 */
export function ReadingNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname === `${href}/`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="shrink-0">
          <Logo className="h-4 w-28 sm:w-32 text-white" />
        </Link>
        <nav
          className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-medium text-neutral-400 overflow-x-auto no-scrollbar"
          aria-label="Explore Weekend MVP"
        >
          {READING_LINKS.map((link, index) => (
            <React.Fragment key={link.href}>
              {index > 0 && (
                <span
                  className="text-neutral-700 select-none shrink-0"
                  aria-hidden="true"
                >
                  ·
                </span>
              )}
              <Link
                href={link.href}
                className="hover:text-white transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-white/40 rounded px-1"
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>
      </div>
    </header>
  );
}
