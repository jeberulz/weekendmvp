"use client";

import * as React from "react";
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

/** Anchor scroll offset: floating MegaNav (top-6 + h-14) + breathing room */
const SCROLL_OFFSET = 100;

/**
 * Page chrome for the starter kit guide:
 * - mobile slide-in sidebar with backdrop (site nav is global MegaNav)
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
      <IconButton
        aria-label="Open table of contents"
        aria-expanded={menuOpen}
        aria-controls="sidebar"
        className="lg:hidden fixed top-[5.5rem] right-4 z-40 text-black p-2 bg-[#fcfaf7]/90 backdrop-blur-xl border border-black/5 rounded-lg shadow-sm"
        onClick={() => setMenuOpen(true)}
      >
        <Menu size={20} aria-hidden="true" />
      </IconButton>

      {/* Mobile Sidebar Backdrop */}
      <div
        id="mobile-menu-backdrop"
        className={cn(
          "fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          menuOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMenuOpen(false)}
      ></div>

      <div className="flex flex-col lg:flex-row gap-12 pt-28 pb-32">
        {/* Sidebar */}
        <aside
          id="sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-[60] w-72 bg-[#fcfaf7] px-8 py-12 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:w-64 lg:p-0 lg:z-auto lg:h-fit lg:sticky lg:top-28 lg:flex-shrink-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto",
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
