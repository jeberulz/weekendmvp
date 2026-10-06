import Link from "next/link";

export type CrawlLink = {
  href: string;
  label: string;
  blurb: string;
};

/**
 * Prominent, crawlable internal links for pages Google already indexes.
 * Used to pass link equity to /startup-ideas and newly shipped idea pages.
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
    <section className={className ?? "mt-16"} aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-2xl font-medium text-white mb-3 tracking-tight"
      >
        {heading}
      </h2>
      <p className="text-neutral-400 mb-6 max-w-2xl text-sm leading-relaxed">
        {intro}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block h-full rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
            >
              <span className="block text-sm font-medium text-white">
                {link.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-400">
                {link.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>
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
