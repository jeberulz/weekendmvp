import Link from "next/link";

import { Icon } from "@/components/home/icons";
import { Container } from "@/components/home/ui";
import { SectionHeading } from "@/components/public/Sections";
import { cn } from "@/lib/utils";

export type CrawlLink = {
  href: string;
  label: string;
  blurb: string;
};

/**
 * Prominent, crawlable internal links for pages Google already indexes.
 * Used to pass link equity to /startup-ideas and newly shipped idea pages.
 * Drawn as ruled serif links on paper.
 */
export function HubCrawlLinks({
  heading = "Fresh ideas worth opening",
  intro = "Start with the full library, then dig into two newly published builds.",
  links,
  headingId = "crawl-links-heading",
  className,
}: {
  heading?: string;
  intro?: string;
  links: CrawlLink[];
  headingId?: string;
  className?: string;
}) {
  return (
    <section className={cn("py-12 lg:py-16", className)} aria-labelledby={headingId}>
      <Container className="flex flex-col gap-7">
        <SectionHeading id={headingId} intro={intro}>
          {heading}
        </SectionHeading>
        <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <li key={link.href} className="border-t border-home-rule">
              <Link
                href={link.href}
                className="group flex flex-col gap-1 py-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
              >
                <span className="flex items-center justify-between gap-4 font-editorial text-[22px] leading-[1.15] text-home-ink md:text-2xl">
                  {link.label}
                  <Icon
                    name="arrow"
                    size={20}
                    strokeWidth={1.75}
                    className="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
                <span className="text-[15px] leading-[1.5] text-home-ink-2">{link.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Shared targets for Demand GSC Sep 2026 crawl-priority push. */
export const SEO_PRIORITY_LINKS: CrawlLink[] = [
  {
    href: "/startup-ideas",
    label: "Browse all startup ideas",
    blurb: "The full library — filter by tool, build time, and revenue goal.",
  },
  {
    href: "/ideas/dmarc-monitor-agencies-small-business",
    label: "DMARC monitor for agencies",
    blurb: "Agency-ready DMARC monitoring for small-business email reputation.",
  },
  {
    href: "/ideas/prompt-regression-tests-indie-ai-builders",
    label: "Prompt regression tests for AI builders",
    blurb: "Catch prompt drift before it ships — for indie AI product builders.",
  },
];

/** Cursor-only: keep the Ep1 hydration idea crawlable from this hub. */
export const CURSOR_HYDRATION_LINK: CrawlLink = {
  href: "/ideas/hydration-app-for-hikers",
  label: "Hydration app for hikers",
  blurb: "Trail-first hydration coach with GPS altitude and sip targets.",
};
