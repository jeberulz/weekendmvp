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

type MobileLink = { label: string; href: string; emphasis?: boolean };
type MobileGroup = { heading?: string; links: MobileLink[] };
type MobileSection = { id: string; label: string; groups: MobileGroup[] };

/** Ported verbatim from the mobile menu in partials/nav-mega.html. */
const SECTIONS: MobileSection[] = [
  {
    id: "browse-ideas",
    label: "Browse Ideas",
    groups: [
      {
        heading: "By Category",
        links: [
          { label: "SaaS", href: "/ideas/saas" },
          { label: "AI Tools", href: "/ideas/ai-tools" },
          { label: "Productivity", href: "/ideas/productivity" },
          { label: "Automation", href: "/ideas/automation" },
        ],
      },
      {
        heading: "By Revenue",
        links: [
          { label: "$1K/month", href: "/ideas/1k-month" },
          { label: "Passive Income", href: "/ideas/passive-income" },
          {
            label: "View All Ideas →",
            href: "/startup-ideas",
            emphasis: true,
          },
        ],
      },
    ],
  },
  {
    id: "build-with",
    label: "Build With",
    groups: [
      {
        heading: "AI Code Editors",
        links: [
          { label: "Cursor", href: "/build-with/cursor" },
          { label: "Claude", href: "/build-with/claude" },
          { label: "Windsurf", href: "/build-with/windsurf" },
        ],
      },
      {
        heading: "No-Code",
        links: [
          { label: "Bolt.new", href: "/build-with/bolt" },
          { label: "Lovable", href: "/build-with/lovable" },
        ],
      },
    ],
  },
  {
    id: "ideas-for",
    label: "Ideas For",
    groups: [
      {
        links: [
          { label: "Developers", href: "/ideas-for/developers" },
          { label: "Designers", href: "/ideas-for/designers" },
          { label: "Non-Technical", href: "/ideas-for/non-technical" },
          { label: "Solo Founders", href: "/ideas-for/solo-founders" },
          { label: "Side Hustlers", href: "/ideas-for/side-hustlers" },
        ],
      },
    ],
  },
];

const BOTTOM_LINKS: MobileLink[] = [
  { label: "Articles", href: "/articles" },
  { label: "Newsletter", href: "/newsletter" },
  { label: "Starter Kit", href: "/starter-kit" },
];

/**
 * Mobile slide-in menu (shadcn Sheet), porting the legacy mobile menu from
 * partials/nav-mega.html and the mobile-nav-toggle behavior from scripts.js:
 * collapsible submenus where opening one closes the others, Escape/backdrop
 * close, and links close the menu on navigation.
 *
 * The menu surface is intentionally dark on every page (matching legacy),
 * so colors are hardcoded rather than theme tokens.
 */
export function MobileNav({
  triggerClassName,
}: {
  triggerClassName?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [openSection, setOpenSection] = React.useState<string | null>(null);

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
        className="w-80 max-w-none gap-0 p-0 bg-neutral-950 border-l border-white/10 text-white overflow-y-auto"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <Logo className="h-4 w-24 text-white" />
          <SheetClose asChild>
            <IconButton
              aria-label="Close menu"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </IconButton>
          </SheetClose>
        </div>
        <nav className="p-6 space-y-1">
          <Link
            href="/"
            onClick={closeMenu}
            aria-current={isActive("/") ? "page" : undefined}
            className={cn(
              "block px-4 py-3 rounded-lg transition-colors",
              isActive("/")
                ? "text-white bg-white/5"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            )}
          >
            Home
          </Link>

          {SECTIONS.map((section) => {
            const expanded = openSection === section.id;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpenSection(expanded ? null : section.id)
                  }
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={cn(
                      "transition-transform duration-200",
                      expanded && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "pl-4 mt-1 space-y-1",
                    expanded ? "block" : "hidden"
                  )}
                >
                  {section.groups.map((group, groupIndex) => (
                    <React.Fragment key={group.heading ?? groupIndex}>
                      {group.heading && (
                        <p
                          className={cn(
                            "px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600",
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
                            "block px-4 py-2 text-sm transition-colors",
                            link.emphasis
                              ? "text-neutral-400 hover:text-white"
                              : cn(
                                  "rounded-lg hover:bg-white/5",
                                  isActive(link.href)
                                    ? "text-white bg-white/5"
                                    : "text-neutral-500 hover:text-white"
                                )
                          )}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </React.Fragment>
                  ))}
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
                "block px-4 py-3 rounded-lg transition-colors",
                isActive(link.href)
                  ? "text-white bg-white/5"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
