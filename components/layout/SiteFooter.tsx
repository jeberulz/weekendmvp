import * as React from "react";
import Link from "next/link";
import { cacheLife } from "next/cache";

import { Logo } from "@/components/primitives/Logo";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { LEGAL_DOCS } from "@/lib/legal/content";
import { MEMBERSHIP_LEGAL_APPROVED } from "@/lib/legal/status";

// Strict prerender forbids new Date() in uncached server components; a daily
// cache window keeps the copyright year correct without going dynamic.
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/**
 * The Lucide "twitter" brand icon was removed from lucide-react 1.x, so the
 * original icon path (matching the legacy `lucide:twitter` iconify icon) is
 * inlined here to preserve the footer's visual output.
 */
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

const FOOTER_LINK =
  "text-home-d2 transition-colors hover:text-home-d1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light";

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
  { label: "Claude Code", href: "/build-with/claude-code" },
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
      <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-d3">{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={
                link.emphasis
                  ? "text-home-orange-light underline underline-offset-4 transition-colors hover:text-home-d1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light"
                  : FOOTER_LINK
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

/** Site footer in the research-desk warm ink (WP56); every link from the legacy footer is kept. */
export function SiteFooter() {
  return (
    <footer className="relative z-10 bg-home-ink text-home-d1">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-14 md:px-10 lg:py-16 xl:px-0">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/">
              <Logo className="mb-4 h-5 w-32 text-home-d1" />
            </Link>
            <p className="mb-4 text-sm leading-[1.55] text-home-d2">
              Ship your MVP in a weekend, even if you&apos;re non-technical.
            </p>
            <p className="text-xs text-home-d3">
              Created by{" "}
              <Link
                href="/john-iseghohi"
                className="underline-offset-4 transition-colors hover:text-home-d1 hover:underline"
              >
                John Iseghohi
              </Link>
            </p>
          </div>

          <FooterColumn title="Browse Ideas" links={BROWSE_IDEAS_LINKS} />
          <FooterColumn title="Build With" links={BUILD_WITH_LINKS} />
          <FooterColumn title="Ideas For" links={IDEAS_FOR_LINKS} />

          {/* Resources Column */}
          <div>
            <h2 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-d3">Resources</h2>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/about"
                  className={FOOTER_LINK}
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/john-iseghohi"
                  className={FOOTER_LINK}
                >
                  John Iseghohi
                </Link>
              </li>
              <li>
                <Link
                  href="/starter-kit"
                  className={FOOTER_LINK}
                >
                  Starter Kit
                </Link>
              </li>
              <li>
                <Link
                  href="/articles"
                  className={FOOTER_LINK}
                >
                  Articles
                </Link>
              </li>
              <li>
                <Link
                  href="/newsletter"
                  className={FOOTER_LINK}
                >
                  Newsletter
                </Link>
              </li>
              <li>
                <NavExternalLink
                  href="https://cal.com/switchtoux/mvp-sprint"
                  className={FOOTER_LINK}
                >
                  Book a Sprint
                </NavExternalLink>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className={FOOTER_LINK}
                >
                  Privacy Policy
                </Link>
              </li>
              {/* WP64-S9: the Terms and refund policy, once approved. */}
              {MEMBERSHIP_LEGAL_APPROVED
                ? LEGAL_DOCS.map((doc) => (
                    <li key={doc.path}>
                      <Link href={doc.path} className={FOOTER_LINK}>
                        {doc.footerLabel}
                      </Link>
                    </li>
                  ))
                : null}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-home-dr pt-8 md:flex-row">
          <p className="font-mono text-[11px] tracking-[0.06em] text-home-d3">
            © <CopyrightYear /> Weekend MVP. Built to ship.
          </p>
          <div className="flex items-center gap-6">
            <NavExternalLink
              href="https://twitter.com/weekendmvp"
              className="text-home-d3 transition-colors hover:text-home-d1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light"
              aria-label="Follow Weekend MVP on Twitter"
            >
              <TwitterIcon size={18} />
            </NavExternalLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
