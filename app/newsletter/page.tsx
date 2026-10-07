import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { JsonLd } from "@/components/primitives/JsonLd";
import { ButtonLink, Container, Em, Eyebrow } from "@/components/home/ui";
import { Icon } from "@/components/home/icons";
import { NewsletterSignupForm } from "@/components/newsletter/NewsletterSignupForm";
import { listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { MetaLine, PageHeader } from "@/components/public/PageHeader";
import { InkBand, Section, SectionHeading } from "@/components/public/Sections";
import { SITE, buildGraph } from "@/lib/seo";
import { cn } from "@/lib/utils";

const CONTENT_DIR = "content/newsletter-pages";
const TITLE = "The Weekend MVP Newsletter | Daily Ideas for Weekend Builders";
const DESCRIPTION =
  "Twice-daily newsletter for weekend builders. Fresh startup ideas every morning, deeper build guides every afternoon. Free. Unsubscribe anytime.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/newsletter" },
  openGraph: {
    type: "website",
    url: `${SITE}/newsletter`,
    title: TITLE,
    description:
      "Twice-daily newsletter for weekend builders. Fresh startup ideas every morning, deeper build guides every afternoon.",
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: "Weekend MVP — ship your product in 48 hours",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Weekend MVP Newsletter",
    description: "Twice-daily newsletter for weekend builders. Free.",
    images: [`${SITE}/image/og-image.png`],
  },
};

type IssueCard = {
  slug: string;
  title: string;
  description?: string;
  edition: "am" | "pm";
  publishedAt?: number;
  /** Preformatted "May 22, 2026" (server-side, deterministic). */
  displayDate?: string;
  /** YYYY-MM-DD for <time datetime> */
  isoDate?: string;
};

/** ms-epoch or "2026-05-22" → "May 22, 2026" (cached scope only). */
function formatDate(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const date =
    typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const toIso = (ts: number | undefined) =>
  ts === undefined ? undefined : new Date(ts).toISOString().slice(0, 10);

/** Frontmatter listing from the committed issue MDX files. */
async function listFromFilesystem(): Promise<IssueCard[]> {
  const slugs = await listMdxSlugs(CONTENT_DIR);
  const files = await Promise.all(
    slugs.map((slug) => readMdxFile(CONTENT_DIR, slug)),
  );
  const items: IssueCard[] = [];
  for (const file of files) {
    if (!file) continue;
    const fm = file.frontmatter as {
      slug: string;
      title: string;
      description?: string;
      publishedAt?: string;
      edition?: "am" | "pm";
    };
    const ts = fm.publishedAt
      ? Date.parse(`${fm.publishedAt}T00:00:00Z`)
      : undefined;
    items.push({
      slug: fm.slug ?? file.slug,
      title: fm.title,
      description: fm.description,
      edition: fm.edition === "am" ? "am" : "pm",
      publishedAt: Number.isNaN(ts) ? undefined : ts,
      displayDate: formatDate(fm.publishedAt),
      isoDate: fm.publishedAt,
    });
  }
  // Newest first; AM/PM of the same day ordered PM before AM (legacy order).
  items.sort(
    (a, b) =>
      (b.publishedAt ?? 0) - (a.publishedAt ?? 0) ||
      b.slug.localeCompare(a.slug),
  );
  return items;
}

/**
 * Convex is the listing source (revalidated via the `newsletter` tag from
 * convex/newsletter.upsertBySlug); the MDX frontmatter on disk is the
 * build-time fallback when Convex is unreachable.
 */
async function getIssues(): Promise<IssueCard[]> {
  "use cache";
  cacheTag("newsletter");
  cacheLife("hours");

  const fsItems = await listFromFilesystem();
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    const docs = await fetchQuery(api.newsletter.list, {}, { url });
    if (!docs.length) throw new Error("newsletter_issues table is empty");
    const items = docs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      edition: doc.edition,
      publishedAt: doc.publishedAt,
      displayDate: formatDate(doc.publishedAt),
      isoDate: toIso(doc.publishedAt),
    }));
    items.sort(
      (a, b) =>
        (b.publishedAt ?? 0) - (a.publishedAt ?? 0) ||
        b.slug.localeCompare(a.slug),
    );
    return items;
  } catch {
    // Convex unavailable (e.g. at build time) — serve frontmatter listing.
    return fsItems;
  }
}

const EDITION_TAG = {
  am: {
    short: "AM",
    label: "AM · Idea of the Day",
    className: "bg-home-ochre text-home-ochre-ink",
  },
  pm: {
    short: "PM",
    label: "PM · Builder Brief",
    className: "bg-home-ink text-home-d1",
  },
} as const;

/** Archive row: mono date, AM/PM tag, serif title (ported from the legacy card grid). */
function IssueRow({ issue }: { issue: IssueCard }) {
  const tag = EDITION_TAG[issue.edition];
  return (
    <li className="border-b border-home-rule">
      <Link
        href={`/newsletter/${issue.slug}`}
        data-nl-card
        data-nl-slot={issue.edition}
        data-nl-date={issue.isoDate}
        className="group grid grid-cols-1 gap-2 rounded-[10px] py-5 transition-colors duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-home-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none lg:grid-cols-[140px_72px_minmax(0,1fr)_28px] lg:items-center lg:gap-6 lg:px-4 lg:py-[22px]"
      >
        <span className="flex items-center gap-3 lg:contents">
          <time
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3 md:text-xs"
            dateTime={issue.isoDate}
          >
            {issue.displayDate}
          </time>
          <span
            className={cn(
              "inline-flex h-[22px] w-fit items-center rounded-full px-[9px] font-mono text-[11px] font-medium uppercase tracking-[0.06em]",
              tag.className,
            )}
          >
            <span aria-hidden="true">{tag.short}</span>
            <span className="sr-only">{tag.label}</span>
          </span>
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="font-editorial text-[24px] leading-[1.15] text-home-ink text-balance md:text-[26px]">
            {issue.title}
          </span>
          {issue.description ? (
            <span className="line-clamp-2 max-w-[680px] text-[15px] leading-[1.55] text-home-ink-2">
              {issue.description}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" className="hidden text-home-ink lg:block">
          <Icon
            name="arrow"
            size={20}
            strokeWidth={1.75}
            className="transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </Link>
    </li>
  );
}

export default async function NewsletterPage() {
  return <CachedNewsletterPage />;
}

async function CachedNewsletterPage() {
  "use cache";
  cacheTag("newsletter");
  cacheLife("hours");

  const issues = await getIssues();

  // CollectionPage + ItemList ported from the newsletter.html JSON-LD
  // (extensionless URLs).
  const schema = buildGraph({
    "@type": "CollectionPage",
    name: "The Weekend MVP Newsletter",
    description:
      "Twice-daily newsletter for weekend builders. Fresh startup ideas every morning, deeper build guides every afternoon.",
    url: `${SITE}/newsletter`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: issues.length,
      itemListElement: issues.map((issue, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Article",
          name: issue.title,
          url: `${SITE}/newsletter/${issue.slug}`,
          ...(issue.isoDate ? { datePublished: issue.isoDate } : {}),
        },
      })),
    },
  });

  return (
    <>
      <JsonLd schema={schema} />

      <PageHeader
        align="center"
        title={
          <>
            The Weekend&nbsp;MVP <Em>Newsletter</Em>
          </>
        }
        description="Twice-daily ideas for weekend builders. Morning: a fresh idea to ship this weekend. Afternoon: how to actually build it."
        className="pb-14 lg:pb-[72px]"
      >
        <NewsletterSignupForm
          utmCampaign="newsletter"
          className="mt-2 w-full max-w-[520px]"
        />
        <MetaLine
          className="mt-2 justify-center"
          items={[
            <>
              <span className="text-home-ink">{issues.length}</span> sends
            </>,
            "AM + PM daily",
            "Free forever",
          ]}
        />
      </PageHeader>

      {/* Archive / Feed */}
      <Section labelledBy="past-sends" className="pt-4 lg:pt-6">
        <SectionHeading
          id="past-sends"
          intro="Every newsletter we've ever sent, archived for reading and sharing."
          className="mb-6"
        >
          Past sends
        </SectionHeading>
        <ol id="newsletter-grid" className="border-t border-home-ink">
          {issues.map((issue) => (
            <IssueRow key={issue.slug} issue={issue} />
          ))}
        </ol>
      </Section>

      {/* Mid CTA */}
      <section aria-label="Browse startup ideas" className="pb-16 lg:pb-20">
        <Container className="flex flex-col items-center gap-4 text-center">
          <p className="text-[15px] text-home-ink-2">
            Want to build one of the ideas we feature?
          </p>
          <ButtonLink href="/startup-ideas" tone="secondary" arrow>
            Browse 45+ startup ideas
          </ButtonLink>
        </Container>
      </section>

      {/* Bottom CTA */}
      <InkBand labelledBy="newsletter-cta">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-[640px] flex-col gap-3">
            <Eyebrow dark>Ready to ship?</Eyebrow>
            <h2
              id="newsletter-cta"
              className="font-editorial text-[34px] font-normal leading-[1.04] tracking-[-0.02em] text-balance lg:text-[48px]"
            >
              Stop reading. <Em dark>Start building.</Em>
            </h2>
            <p className="max-w-[560px] text-base leading-[1.55] text-home-d2 md:text-[17px]">
              Get the Weekend MVP Starter Kit and turn your idea into something
              real this weekend.
            </p>
          </div>
          <ButtonLink
            href="/starter-kit"
            tone="dark"
            className="w-full focus-visible:outline-home-orange-light lg:w-auto"
          >
            Get the Starter Kit
          </ButtonLink>
        </div>
      </InkBand>
    </>
  );
}
