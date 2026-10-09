"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/primitives/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { NavAuthLinks } from "@/components/layout/NavAuthLinks";
import { SITE_NAV_SECTIONS } from "@/components/layout/site-navigation";

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
    desktopLinks: "text-neutral-600",
    link: "hover:text-black focus:text-black",
    linkActive: "text-black",
    panel: "bg-white/95 border-neutral-200",
    heading: "text-neutral-600",
    panelLink: "text-neutral-600 hover:text-black",
    panelLinkActive: "text-black",
    divider: "border-neutral-200/60",
    footerLink: "text-neutral-600 hover:text-black",
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
  variant = "cream",
  id,
}: {
  variant?: MegaNavVariant;
  /** Reader TOCs measure this fixed shell, including its top gap. */
  id?: string;
}) {
  const t = TOKENS[variant];
  const pathname = usePathname();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const triggerRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const navId = React.useId();

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
    <header id={id} className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 animate-enter">
      <nav
        aria-label="Primary"
        ref={navRef}
        className={cn(
          "flex items-center justify-between w-full max-w-4xl h-14 pl-6 pr-2 backdrop-blur-xl border rounded-full shadow-2xl",
          t.shell
        )}
      >
        <Link
          href="/"
          aria-label="Weekend MVP home"
          className="flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Logo className={cn("h-4 w-32 md:h-5 md:w-40", t.logo)} />
        </Link>

        <div
          className={cn(
            "hidden md:flex items-center gap-6 text-xs font-medium",
            t.desktopLinks
          )}
        >
          {SITE_NAV_SECTIONS.map((dropdown) => {
            const open = openId === dropdown.id;
            const panelId = `${navId}-${dropdown.id}`;
            const sectionActive =
              isActive(dropdown.footerLink.href) ||
              dropdown.columns.some((col) =>
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
                    "flex items-center gap-1 rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-4",
                    t.link,
                    sectionActive && t.linkActive
                  )}
                  aria-expanded={open}
                  aria-controls={panelId}
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
                  id={panelId}
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
                        aria-current={
                          isActive(dropdown.footerLink.href) ? "page" : undefined
                        }
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
        </div>

        <div className="flex items-center gap-2">
          <NavAuthLinks variant="desktop" theme={variant} ctaRing={t.ctaRing} />
          <MobileNav
            triggerClassName={cn(
              "md:hidden ml-2 p-2 transition-colors",
              t.menuBtn
            )}
          />
        </div>
      </nav>
    </header>
  );
}
