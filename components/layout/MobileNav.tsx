"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { IconButton } from "@/components/primitives/IconButton";
import { Logo } from "@/components/primitives/Logo";
import { NavAuthLinks } from "@/components/layout/NavAuthLinks";
import { SITE_NAV_SECTIONS } from "@/components/layout/site-navigation";
import { newsreaderEditorial } from "@/lib/fonts";

type MobileLink = { label: string; href: string };
const BOTTOM_LINKS: MobileLink[] = [
  { label: "Articles", href: "/articles" },
  { label: "Newsletter", href: "/newsletter" },
  { label: "Starter Kit", href: "/starter-kit" },
];

/**
 * Mobile slide-in menu (shadcn Sheet), sharing MegaNav's discovery links:
 * collapsible submenus where opening one closes the others, Escape/backdrop
 * close, and links close the menu on navigation.
 *
 * The panel is the research-desk paper on every page (WP56): serif section
 * names, mono group labels, ink pills for the auth links.
 */
export function MobileNav({
  triggerClassName,
}: {
  triggerClassName?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  const navId = React.useId();

  // Close the sheet (and collapse submenus) after navigation.
  React.useEffect(() => {
    setOpen(false);
    setOpenSection(null);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname === `${href}/`;

  const closeMenu = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton aria-label="Open menu" className={triggerClassName}>
          <Menu size={24} />
        </IconButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          newsreaderEditorial.variable,
          "w-80 max-w-none gap-0 overflow-y-auto border-l border-home-rule bg-home-paper p-0 font-sans text-home-ink"
        )}
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <div className="flex items-center justify-between border-b border-home-rule p-6">
          <Logo className="h-4 w-24 text-home-ink" />
          <SheetClose asChild>
            <IconButton
              aria-label="Close menu"
              className="rounded-full text-home-ink-2 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              <X size={24} />
            </IconButton>
          </SheetClose>
        </div>
        <nav aria-label="Primary mobile" className="p-6 space-y-1">
          <Link
            href="/"
            onClick={closeMenu}
            aria-current={isActive("/") ? "page" : undefined}
            className={cn(
              "block rounded-lg px-4 py-3 font-editorial text-[22px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink",
              isActive("/")
                ? "text-home-ink bg-home-card"
                : "text-home-ink-2 hover:text-home-ink hover:bg-home-card"
            )}
          >
            Home
          </Link>

          {SITE_NAV_SECTIONS.map((section) => {
            const expanded = openSection === section.id;
            const panelId = `${navId}-${section.id}`;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-4 py-3 font-editorial text-[22px] leading-tight text-home-ink transition-colors hover:bg-home-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenSection(expanded ? null : section.id)
                  }
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={cn(
                      "text-home-ink-3 transition-transform duration-200 motion-reduce:transition-none",
                      expanded && "rotate-180"
                    )}
                  />
                </button>
                <div
                  id={panelId}
                  className={cn(
                    "pl-4 mt-1 space-y-1",
                    expanded ? "block" : "hidden"
                  )}
                >
                  {section.columns.map((group, groupIndex) => (
                    <React.Fragment key={group.heading ?? groupIndex}>
                      {group.heading && (
                        <p
                          className={cn(
                            "px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3",
                            groupIndex > 0 && "pt-3"
                          )}
                        >
                          {group.heading}
                        </p>
                      )}
                      {group.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={closeMenu}
                          aria-current={
                            isActive(link.href) ? "page" : undefined
                          }
                          className={cn(
                            "block rounded-lg px-4 py-2.5 text-[15px] transition-colors hover:bg-home-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink",
                            isActive(link.href)
                              ? "bg-home-card font-medium text-home-ink"
                              : "text-home-ink-2 hover:text-home-ink"
                          )}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </React.Fragment>
                  ))}
                  <Link
                    href={section.footerLink.href}
                    onClick={closeMenu}
                    aria-current={
                      isActive(section.footerLink.href) ? "page" : undefined
                    }
                    className="block px-4 py-2.5 text-[15px] font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                  >
                    {section.footerLink.label} →
                  </Link>
                </div>
              </div>
            );
          })}

          {BOTTOM_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "block rounded-lg px-4 py-3 font-editorial text-[22px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink",
                isActive(link.href)
                  ? "text-home-ink bg-home-card"
                  : "text-home-ink-2 hover:text-home-ink hover:bg-home-card"
              )}
            >
              {link.label}
            </Link>
          ))}

          <div className="mt-3 space-y-2 border-t border-home-rule pt-5">
            <NavAuthLinks variant="mobile" onNavigate={closeMenu} />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
