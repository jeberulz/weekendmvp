"use client";

/**
 * Sticky TOC sidebar for idea pages — ports the legacy `initSidebar()` from
 * ideas/gate.js (smooth scroll with header offset + IntersectionObserver
 * scroll-spy with the same rootMargin). On mobile the legacy off-canvas
 * drawer becomes an inline collapsible above the content.
 *
 * `children` is the server-rendered meta card (category/build-time/scores).
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TocSection } from "@/components/ideas/idea-meta";

export function IdeaSidebar({
  sections,
  children,
}: {
  sections: TocSection[];
  children?: React.ReactNode;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      // Same band as gate.js initSidebar.
      { root: null, rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  function scrollToSection(
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const header = document.getElementById("idea-site-header");
    const offset = header
      ? header.offsetHeight + 8
      : window.innerWidth < 1024
        ? 120
        : 32;
    const targetPosition =
      target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: targetPosition, behavior: "smooth" });
    setActiveId(id);
    setMobileOpen(false);
  }

  const overview = sections.filter((s) => s.group === "overview");
  const build = sections.filter((s) => s.group === "build");

  const renderGroup = (label: string, group: TocSection[], first: boolean) =>
    group.length > 0 ? (
      <React.Fragment key={label}>
        <p
          className={cn(
            "text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-3",
            !first && "mt-8",
          )}
        >
          {label}
        </p>
        {group.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => scrollToSection(event, section.id)}
            aria-current={activeId === section.id ? "true" : undefined}
            className={cn(
              "block px-3 py-2 text-sm transition-colors",
              activeId === section.id
                ? "text-black font-semibold"
                : "text-neutral-500 hover:text-black",
            )}
          >
            {section.label}
          </a>
        ))}
      </React.Fragment>
    ) : null;

  return (
    <aside className="lg:w-56 lg:flex-shrink-0">
      <div className="lg:sticky lg:top-[7.5rem]">
        <div className="mb-6">
          <Link
            href="/startup-ideas"
            className="inline-flex items-center gap-2 text-neutral-500 text-sm hover:text-black transition-colors"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            All Ideas
          </Link>
        </div>

        {/* Mobile: collapsible "On this page" */}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="idea-toc"
          className="lg:hidden w-full flex items-center justify-between px-4 py-3 mb-4 bg-neutral-100 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-black/30"
        >
          On this page
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn(
              "transition-transform",
              mobileOpen && "rotate-180",
            )}
          />
        </button>

        <nav
          id="idea-toc"
          aria-label="On this page"
          className={cn("space-y-1", mobileOpen ? "block" : "hidden lg:block")}
        >
          {renderGroup("Overview", overview, true)}
          {renderGroup("Build Details", build, overview.length === 0)}
        </nav>

        {children ? (
          <div className="hidden lg:block mt-8">{children}</div>
        ) : null}
      </div>
    </aside>
  );
}
