/**
 * Cream-theme footer for idea pages — ports the <footer> from
 * ideas/_template.html (same link sets as the dark SiteFooter, light
 * palette). Lives under components/ideas because it's specific to the
 * light idea-detail surfaces.
 */

import * as React from "react";
import Link from "next/link";
import { cacheLife } from "next/cache";

import { Logo } from "@/components/primitives/Logo";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";

// Strict prerender forbids new Date() in uncached server components; a daily
// cache window keeps the copyright year correct without going dynamic.
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

function TwitterIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

type FooterLink = { label: string; href: string; emphasis?: boolean };

const BROWSE_IDEAS_LINKS: FooterLink[] = [
  { label: "SaaS Ideas", href: "/ideas/saas" },
  { label: "AI Tool Ideas", href: "/ideas/ai-tools" },
  { label: "Productivity", href: "/ideas/productivity" },
  { label: "Automation", href: "/ideas/automation" },
  { label: "$1K/Month Ideas", href: "/ideas/1k-month" },
  { label: "View All →", href: "/startup-ideas", emphasis: true },
];

const BUILD_WITH_LINKS: FooterLink[] = [
  { label: "Cursor", href: "/build-with/cursor" },
  { label: "Claude", href: "/build-with/claude" },
  { label: "Bolt.new", href: "/build-with/bolt" },
  { label: "No-Code", href: "/build-with/no-code" },
];

const IDEAS_FOR_LINKS: FooterLink[] = [
  { label: "Developers", href: "/ideas-for/developers" },
  { label: "Non-Technical", href: "/ideas-for/non-technical" },
  { label: "Solo Founders", href: "/ideas-for/solo-founders" },
  { label: "Side Hustlers", href: "/ideas-for/side-hustlers" },
];

function FooterColumn({
  title,
  links,
  children,
}: {
  title: string;
  links: FooterLink[];
  children?: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-neutral-900 font-medium text-sm mb-4">{title}</h4>
      <ul className="space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={
                link.emphasis
                  ? "text-neutral-600 hover:text-neutral-900 transition-colors"
                  : "text-neutral-500 hover:text-neutral-900 transition-colors"
              }
            >
              {link.label}
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </div>
  );
}

export function IdeaFooter() {
  return (
    <footer className="relative z-10 mt-32 border-t border-neutral-200 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/">
              <Logo className="h-5 w-32 text-black mb-4" />
            </Link>
            <p className="text-neutral-500 text-sm mb-4">
              Ship your MVP in a weekend, even if you&apos;re non-technical.
            </p>
            <p className="text-neutral-400 text-xs">
              Created by{" "}
              <NavExternalLink
                href="https://cal.com/switchtoux"
                className="hover:text-neutral-600 transition-colors"
              >
                John Iseghohi
              </NavExternalLink>
            </p>
          </div>

          <FooterColumn title="Browse Ideas" links={BROWSE_IDEAS_LINKS} />
          <FooterColumn title="Build With" links={BUILD_WITH_LINKS} />
          <FooterColumn title="Ideas For" links={IDEAS_FOR_LINKS} />

          {/* Resources Column */}
          <div>
            <h4 className="text-neutral-900 font-medium text-sm mb-4">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/starter-kit"
                  className="text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Starter Kit
                </Link>
              </li>
              <li>
                <Link
                  href="/articles"
                  className="text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Articles
                </Link>
              </li>
              <li>
                <NavExternalLink
                  href="https://cal.com/switchtoux/mvp-sprint"
                  className="text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Book a Sprint
                </NavExternalLink>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-neutral-400 text-xs">
            © <CopyrightYear /> Weekend MVP. Built to ship.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://twitter.com/weekendmvp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-neutral-900 transition-colors"
              aria-label="Follow Weekend MVP on Twitter"
            >
              <TwitterIcon />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
