"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { IconButton } from "@/components/primitives/IconButton";
import { cn } from "@/lib/utils";

type TocLink = { href: string; label: string };
type TocGroup = { heading: string; headingClassName?: string; links: TocLink[] };

const TOC: TocGroup[] = [
  {
    heading: "The Framework",
    headingClassName:
      "text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-1",
    links: [
      { href: "#intro", label: "Introduction" },
      { href: "#rules", label: "The Rules" },
    ],
  },
  {
    heading: "The Steps",
    headingClassName:
      "text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-8 mb-4 ml-1",
    links: [
      { href: "#step-1", label: "1. Pick an Idea" },
      { href: "#step-2", label: "2. Write a Spec" },
      { href: "#step-3", label: "3. 48-Hour Plan" },
    ],
  },
  {
    heading: "Resources",
    headingClassName:
      "text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-8 mb-4 ml-1",
    links: [
      { href: "#step-4", label: "4. 10 MVP Ideas" },
      { href: "#step-5", label: "5. 10 Build Prompts" },
      { href: "#templates", label: "Templates & Scripts" },
    ],
  },
];

const SECTION_IDS = [
  "intro",
  "rules",
  "step-1",
  "step-2",
  "step-3",
  "step-4",
  "step-5",
  "templates",
];

/** Explore row ported from partials/nav-starter-kit.html (hrefs extensionless). */
const EXPLORE_LINKS: TocLink[] = [
  { href: "/startup-ideas", label: "Browse Ideas" },
  { href: "/build-with/cursor", label: "Build With" },
  { href: "/ideas-for/solo-founders", label: "Ideas For" },
  { href: "/articles", label: "Articles" },
  { href: "/newsletter", label: "Newsletter" },
];

/** Anchor offset below the fixed subnav (global floating nav + explore row). */
const SCROLL_OFFSET = 140;

/**
 * Page chrome for the starter kit guide, ported from starter-kit.html:
 * - sticky explore subnav (from partials/nav-starter-kit.html), positioned
 *   below the global MegaNav rendered by the marketing layout
 * - mobile slide-in sidebar with backdrop
 * - table-of-contents scroll-spy (IntersectionObserver, -20%/-70% margins)
 * - smooth-scroll with fixed-header offset on sidebar link clicks
 */
export function StarterKitShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Scroll-spy for the active sidebar link.
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { root: null, rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Lock body scroll while the mobile sidebar is open.
  React.useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function handleTocClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    e.preventDefault();
    const target = document.querySelector(href);
    if (!target) return;

    const targetPosition =
      target.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
    window.scrollTo({ top: targetPosition, behavior: "smooth" });
    setActiveId(href.slice(1));

    if (window.innerWidth < 1024) {
      setMenuOpen(false);
    }
  }

  return (
    <>
      {/* Starter-kit subnav (page-specific, from partials/nav-starter-kit.html).
          Sits below the global floating MegaNav rendered by the layout. */}
      <header
        id="starter-kit-subnav"
        className="fixed top-0 left-0 right-0 z-40 bg-[#fcfaf7]/80 backdrop-blur-md border-b border-neutral-200"
      >
        {/* Clearance for the global floating nav (top-6 + h-14). */}
        <div className="h-[5.5rem]" aria-hidden="true"></div>
        <div className="relative border-t border-neutral-200/60">
          <IconButton
            aria-label="Open menu"
            className="lg:hidden absolute left-4 top-1/2 -translate-y-1/2 z-10 text-black p-1"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </IconButton>
          <nav
            className="flex items-center justify-center gap-3 px-4 py-2 overflow-x-auto whitespace-nowrap max-w-7xl mx-auto pl-12 lg:pl-4 no-scrollbar"
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
                  className="text-xs font-medium text-neutral-500 hover:text-black transition-colors focus:outline-none focus:ring-2 focus:ring-black/30 rounded px-1"
                >
                  {link.label}
                </Link>
              </React.Fragment>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile Sidebar Backdrop */}
      <div
        id="mobile-menu-backdrop"
        className={cn(
          "fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          menuOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMenuOpen(false)}
      ></div>

      <div className="flex flex-col lg:flex-row gap-12 pt-[10rem] lg:pt-[9.5rem] pb-32">
        {/* Sidebar */}
        <aside
          id="sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-[60] w-72 bg-[#fcfaf7] px-8 py-12 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:w-64 lg:p-0 lg:z-auto lg:h-fit lg:sticky lg:top-[9.5rem] lg:flex-shrink-0",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-end mb-8 lg:hidden">
            <IconButton
              aria-label="Close menu"
              className="text-neutral-400 hover:text-black transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <X size={24} />
            </IconButton>
          </div>

          <nav className="space-y-1">
            {TOC.map((group) => (
              <React.Fragment key={group.heading}>
                <p className={group.headingClassName}>{group.heading}</p>
                {group.links.map((link) => {
                  const active = activeId === link.href.slice(1);
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "true" : undefined}
                      onClick={(e) => handleTocClick(e, link.href)}
                      className={cn(
                        "sidebar-link block px-3 py-2 text-sm transition-colors",
                        active
                          ? "text-black font-semibold"
                          : "text-neutral-500 hover:text-black",
                      )}
                    >
                      {link.label}
                    </a>
                  );
                })}
              </React.Fragment>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-2xl mx-auto lg:mx-0">{children}</main>
      </div>
    </>
  );
}
