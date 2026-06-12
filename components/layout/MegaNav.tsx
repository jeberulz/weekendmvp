"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/primitives/Logo";
import { MobileNav } from "@/components/layout/MobileNav";

type NavLink = { label: string; href: string };
type DropdownColumn = { heading: string; links: NavLink[] };
type DropdownDef = {
  id: string;
  label: string;
  columns: DropdownColumn[];
  footerLink: NavLink;
  panelClassName: string;
  gridClassName: string;
};

/** Ported verbatim from partials/nav-mega.html (hrefs made extensionless). */
const DROPDOWNS: DropdownDef[] = [
  {
    id: "browse-ideas",
    label: "Browse Ideas",
    panelClassName: "min-w-[480px]",
    gridClassName: "grid-cols-3",
    columns: [
      {
        heading: "By Category",
        links: [
          { label: "SaaS", href: "/ideas/saas" },
          { label: "AI Tools", href: "/ideas/ai-tools" },
          { label: "Productivity", href: "/ideas/productivity" },
          { label: "Automation", href: "/ideas/automation" },
          { label: "Developer Tools", href: "/ideas/developer-tools" },
        ],
      },
      {
        heading: "By Revenue",
        links: [
          { label: "$1K/month", href: "/ideas/1k-month" },
          { label: "$5K/month", href: "/ideas/5k-month" },
          { label: "Passive Income", href: "/ideas/passive-income" },
        ],
      },
      {
        heading: "By Time",
        links: [
          { label: "8 Hours", href: "/ideas/build-in-8-hours" },
          { label: "Weekend", href: "/ideas/build-in-weekend" },
          { label: "1 Week", href: "/ideas/build-in-1-week" },
        ],
      },
    ],
    footerLink: { label: "View All Ideas", href: "/startup-ideas" },
  },
  {
    id: "build-with",
    label: "Build With",
    panelClassName: "min-w-[400px]",
    gridClassName: "grid-cols-3",
    columns: [
      {
        heading: "AI Code Editors",
        links: [
          { label: "Cursor", href: "/build-with/cursor" },
          { label: "Windsurf", href: "/build-with/windsurf" },
          { label: "Claude", href: "/build-with/claude" },
        ],
      },
      {
        heading: "No-Code",
        links: [
          { label: "Bolt.new", href: "/build-with/bolt" },
          { label: "Lovable", href: "/build-with/lovable" },
        ],
      },
      {
        heading: "Other",
        links: [
          { label: "Replit", href: "/build-with/replit" },
          { label: "v0", href: "/build-with/v0" },
        ],
      },
    ],
    footerLink: { label: "All Tools", href: "/build-with/no-code" },
  },
  {
    id: "ideas-for",
    label: "Ideas For",
    panelClassName: "min-w-[320px]",
    gridClassName: "grid-cols-2",
    columns: [
      {
        heading: "By Skill Level",
        links: [
          { label: "Developers", href: "/ideas-for/developers" },
          { label: "Designers", href: "/ideas-for/designers" },
          { label: "Non-Technical", href: "/ideas-for/non-technical" },
        ],
      },
      {
        heading: "By Situation",
        links: [
          { label: "Solo Founders", href: "/ideas-for/solo-founders" },
          { label: "Side Hustlers", href: "/ideas-for/side-hustlers" },
          { label: "Weekend Builders", href: "/ideas-for/weekend-builders" },
        ],
      },
    ],
    footerLink: { label: "View All Ideas", href: "/startup-ideas" },
  },
];

const TOP_LEVEL_LINKS: NavLink[] = [
  { label: "Articles", href: "/articles" },
  { label: "Newsletter", href: "/newsletter" },
];

type MegaNavVariant = "dark" | "cream";

const TOKENS: Record<
  MegaNavVariant,
  {
    shell: string;
    logo: string;
    desktopLinks: string;
    link: string;
    linkActive: string;
    panel: string;
    heading: string;
    panelLink: string;
    panelLinkActive: string;
    divider: string;
    footerLink: string;
    ctaRing: string;
    menuBtn: string;
  }
> = {
  dark: {
    shell: "bg-neutral-950/80 border-white/10",
    logo: "text-white",
    desktopLinks: "text-neutral-400",
    link: "hover:text-white focus:text-white",
    linkActive: "text-white",
    panel: "bg-neutral-950/95 border-white/10",
    heading: "text-neutral-500",
    panelLink: "text-neutral-400 hover:text-white",
    panelLinkActive: "text-white",
    divider: "border-white/5",
    footerLink: "text-neutral-400 hover:text-white",
    ctaRing: "focus:ring-white/40 focus:ring-offset-black",
    menuBtn: "text-white hover:text-neutral-300",
  },
  cream: {
    shell: "bg-[#fcfaf7]/80 border-neutral-200",
    logo: "text-black",
    desktopLinks: "text-neutral-500",
    link: "hover:text-black focus:text-black",
    linkActive: "text-black",
    panel: "bg-white/95 border-neutral-200",
    heading: "text-neutral-400",
    panelLink: "text-neutral-500 hover:text-black",
    panelLinkActive: "text-black",
    divider: "border-neutral-200/60",
    footerLink: "text-neutral-500 hover:text-black",
    ctaRing: "focus:ring-black/30 focus:ring-offset-[#fcfaf7]",
    menuBtn: "text-black hover:text-neutral-600",
  },
};

/**
 * Canonical site navigation, ported from partials/nav-mega.html.
 *
 * Desktop dropdowns replicate the legacy scripts.js behavior: open on hover
 * (100ms close grace), toggle on click, close on Escape (refocusing the
 * trigger) and on click outside, one dropdown open at a time.
 */
export function MegaNav({
  variant = "dark",
}: {
  variant?: MegaNavVariant;
}) {
  const t = TOKENS[variant];
  const pathname = usePathname();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const triggerRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const show = React.useCallback(
    (id: string) => {
      clearCloseTimer();
      setOpenId(id);
    },
    [clearCloseTimer]
  );

  const hideWithDelay = React.useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenId(null), 100);
  }, [clearCloseTimer]);

  // Click outside + global Escape close (mirrors scripts.js document listeners).
  React.useEffect(() => {
    if (openId === null) return;

    const onPointerDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };

    document.addEventListener("click", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openId]);

  React.useEffect(() => clearCloseTimer, [clearCloseTimer]);

  // Close any open dropdown after navigation.
  React.useEffect(() => {
    setOpenId(null);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname === `${href}/`;

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 animate-enter">
      <nav
        ref={navRef}
        className={cn(
          "flex items-center justify-between w-full max-w-4xl h-14 pl-6 pr-2 backdrop-blur-xl border rounded-full shadow-2xl",
          t.shell
        )}
      >
        <Link href="/" className="flex items-center gap-2">
          <Logo className={cn("h-4 w-32 md:h-5 md:w-40", t.logo)} />
        </Link>

        <div
          className={cn(
            "hidden md:flex items-center gap-6 text-xs font-medium",
            t.desktopLinks
          )}
        >
          {DROPDOWNS.map((dropdown) => {
            const open = openId === dropdown.id;
            const sectionActive = dropdown.columns.some((col) =>
              col.links.some((link) => isActive(link.href))
            );
            return (
              <div
                key={dropdown.id}
                className="relative"
                onMouseEnter={() => show(dropdown.id)}
                onMouseLeave={hideWithDelay}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setOpenId(null);
                    triggerRefs.current.get(dropdown.id)?.focus();
                  }
                }}
              >
                <button
                  type="button"
                  ref={(el) => {
                    if (el) triggerRefs.current.set(dropdown.id, el);
                    else triggerRefs.current.delete(dropdown.id);
                  }}
                  className={cn(
                    "flex items-center gap-1 transition-colors focus:outline-none",
                    t.link,
                    sectionActive && t.linkActive
                  )}
                  aria-expanded={open}
                  aria-haspopup="true"
                  onClick={() => (open ? setOpenId(null) : show(dropdown.id))}
                >
                  {dropdown.label}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={cn(
                      "transition-transform duration-200",
                      open && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-200",
                    open
                      ? "opacity-100 visible"
                      : "opacity-0 invisible pointer-events-none"
                  )}
                >
                  <div
                    className={cn(
                      "backdrop-blur-xl border rounded-2xl p-6 shadow-2xl",
                      t.panel,
                      dropdown.panelClassName
                    )}
                  >
                    <div className={cn("grid gap-6", dropdown.gridClassName)}>
                      {dropdown.columns.map((column) => (
                        <div key={column.heading}>
                          <h4
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-widest mb-3",
                              t.heading
                            )}
                          >
                            {column.heading}
                          </h4>
                          <ul className="space-y-2">
                            {column.links.map((link) => (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  className={cn(
                                    "transition-colors text-sm",
                                    t.panelLink,
                                    isActive(link.href) && t.panelLinkActive
                                  )}
                                  aria-current={
                                    isActive(link.href) ? "page" : undefined
                                  }
                                >
                                  {link.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className={cn("mt-4 pt-4 border-t", t.divider)}>
                      <Link
                        href={dropdown.footerLink.href}
                        className={cn(
                          "flex items-center gap-1 text-sm transition-colors",
                          t.footerLink
                        )}
                      >
                        {dropdown.footerLink.label}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {TOP_LEVEL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors",
                t.link,
                isActive(link.href) && t.linkActive
              )}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/starter-kit"
          className={cn(
            "group relative inline-flex overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-offset-2 transition-transform active:scale-95",
            t.ctaRing
          )}
        >
          <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,rgba(255,255,255,0.5)_50%,transparent_100%)]"></span>
          <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-neutral-950/80 px-5 py-2 text-xs font-semibold text-white backdrop-blur-3xl transition-all group-hover:bg-neutral-900/80">
            Get the Kit
          </span>
        </Link>

        <MobileNav
          triggerClassName={cn(
            "md:hidden ml-2 p-2 transition-colors",
            t.menuBtn
          )}
        />
      </nav>
    </div>
  );
}
