"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/primitives/Logo";
import { MobileNav } from "@/components/layout/MobileNav";

const EXPLORE_LINKS = [
  { label: "Browse Ideas", href: "/startup-ideas" },
  { label: "Build With", href: "/build-with/cursor" },
  { label: "Ideas For", href: "/ideas-for/solo-founders" },
  { label: "Articles", href: "/articles" },
];

/**
 * Cream sticky nav for idea-detail-style pages, reconciling
 * partials/nav-idea.html and partials/nav-idea-simple.html.
 *
 * - `withSidebar` (nav-idea.html): shows the mobile hamburger next to the
 *   logo and hides "All Ideas" below `sm`.
 * - default (nav-idea-simple.html): no hamburger; "Starter Kit" hides
 *   below `sm` instead.
 */
export function IdeaNav({ withSidebar = false }: { withSidebar?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname === `${href}/`;

  const exploreLinkClass =
    "text-xs font-medium text-neutral-500 hover:text-black transition-colors focus:outline-none focus:ring-2 focus:ring-black/30 rounded px-1";

  return (
    <header
      id="idea-site-header"
      className="fixed top-0 left-0 right-0 z-40 bg-[#fcfaf7]/80 backdrop-blur-md border-b border-neutral-200"
    >
      <div className="flex items-center justify-between px-6 py-4">
        {withSidebar ? (
          <div className="flex items-center gap-4">
            <MobileNav triggerClassName="lg:hidden text-black p-1 -ml-1" />
            <Link href="/">
              <Logo className="h-4 w-32 text-black" />
            </Link>
          </div>
        ) : (
          <Link href="/">
            <Logo className="h-4 w-32 text-black" />
          </Link>
        )}
        <div className="flex items-center gap-6">
          <Link
            href="/startup-ideas"
            className={cn(
              "text-sm text-neutral-500 hover:text-black transition-colors",
              withSidebar && "hidden sm:block"
            )}
            aria-current={isActive("/startup-ideas") ? "page" : undefined}
          >
            All Ideas
          </Link>
          <Link
            href="/starter-kit"
            className={cn(
              "text-sm text-neutral-500 hover:text-black transition-colors",
              !withSidebar && "hidden sm:inline"
            )}
            aria-current={isActive("/starter-kit") ? "page" : undefined}
          >
            Starter Kit
          </Link>
        </div>
      </div>
      <nav
        className="flex items-center justify-center gap-3 px-4 py-2 border-t border-neutral-200/60 overflow-x-auto whitespace-nowrap"
        aria-label="Explore Weekend MVP"
      >
        {EXPLORE_LINKS.map((link, index) => (
          <React.Fragment key={link.href}>
            {index > 0 && (
              <span className="text-neutral-300 select-none" aria-hidden="true">
                ·
              </span>
            )}
            <Link
              href={link.href}
              className={exploreLinkClass}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          </React.Fragment>
        ))}
      </nav>
    </header>
  );
}
