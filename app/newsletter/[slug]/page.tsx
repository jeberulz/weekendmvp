import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import type { MDXComponents } from "next-mdx-remote-client/rsc";

import { articleMdxComponents } from "@/app/articles/article-prose";
import { Icon } from "@/components/home/icons";
import { ButtonLink, Container, buttonClass } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { NewsletterSignupForm } from "@/components/newsletter/NewsletterSignupForm";
import { Breadcrumbs, MetaLine } from "@/components/public/PageHeader";
import { Mdx, listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { SITE, articleSchema } from "@/lib/seo";

const CONTENT_DIR = "content/newsletter-pages";

type IssueFrontmatter = {
  slug: string;
  title: string;
  description: string;
  publishedAt?: string; // YYYY-MM-DD
  edition: "am" | "pm";
  ctaUrl?: string;
};

type Issue = { frontmatter: IssueFrontmatter; content: string };

/* ------------------------------------------------------------------ */
/* Data (filesystem renders the issue; Convex owns archive/sitemap     */
/* freshness via the newsletter:<slug> tag → revalidate hook)          */
/* ------------------------------------------------------------------ */

async function getIssueSlugs(): Promise<string[]> {
  "use cache";
  cacheTag("newsletter");
  cacheLife("hours");
  return listMdxSlugs(CONTENT_DIR);
}

async function getIssue(slug: string): Promise<Issue | null> {
  "use cache";
  cacheTag(`newsletter:${slug}`, "newsletter");
  cacheLife("hours");
  const file = await readMdxFile(CONTENT_DIR, slug);
  if (!file) return null;
  return {
    frontmatter: file.frontmatter as IssueFrontmatter,
    content: file.content,
  };
}

/** "2026-05-22" → "May 22, 2026" (deterministic, cached scope only). */
function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const EDITION_LABEL = { am: "Idea of the Day", pm: "Builder Brief" } as const;

/* ------------------------------------------------------------------ */
/* MDX component map (legacy newsletter prose classes from the old     */
/* scripts/publish-newsletter-pages.js renderer)                       */
/* ------------------------------------------------------------------ */

/**
 * Standalone CTA button inside an issue body — emitted as `<Cta href>` by
 * scripts/extract-newsletter-to-mdx.mjs + scripts/publish-newsletter.mjs,
 * mirroring the legacy `div.text-center > a` pill (now the orange-ink primary).
 */
function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  const className = buttonClass("primary", "h-12 text-[15px] no-underline");
  const external = /^https?:\/\//i.test(href);
  return (
    <div className="my-8">
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          <span>{children}</span>
          <Icon name="arrow" size={18} strokeWidth={1.75} />
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      ) : (
        <Link href={href} className={className}>
          <span>{children}</span>
          <Icon name="arrow" size={18} strokeWidth={1.75} />
        </Link>
      )}
    </div>
  );
}

/** The article reading map plus the issue-only `<Cta>`. */
const newsletterMdxComponents: MDXComponents = {
  ...articleMdxComponents,
  Cta,
};

/* ------------------------------------------------------------------ */
/* Static params + metadata                                            */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  const slugs = await listMdxSlugs(CONTENT_DIR);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getIssue(slug);
  if (!issue) return {};
  const { title, description } = issue.frontmatter;
  const url = `${SITE}/newsletter/${slug}`;
  const ogImage = `${SITE}/image/og/newsletter/${slug}.png`;
  return {
    title: { absolute: `${title} | Weekend MVP Newsletter` },
    description,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/newsletter/${slug}` },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      images: [
        {
          url: ogImage,
          alt: "Weekend MVP — ship your product in 48 hours",
          type: "image/png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function NewsletterIssuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugs = await getIssueSlugs();
  if (!slugs.includes(slug)) notFound();
  return <CachedIssue slug={slug} />;
}

/** Data + render cached together; revalidated via `newsletter:<slug>`. */
async function CachedIssue({ slug }: { slug: string }) {
  "use cache";
  cacheTag(`newsletter:${slug}`, "newsletter");
  cacheLife("hours");

  const issue = await getIssue(slug);
  if (!issue) notFound();
  const fm = issue.frontmatter;
  const displayDate = formatDate(fm.publishedAt);
  const edition = fm.edition === "am" ? "am" : "pm";
  const ctaUrl = fm.ctaUrl ?? "/startup-ideas";

  // Mirrors the legacy per-issue JSON-LD Article block (same author shape).
  const schema = {
    "@context": "https://schema.org",
    ...articleSchema({
      title: fm.title,
      description: fm.description,
      slug,
      pathPrefix: "/newsletter",
      datePublished: fm.publishedAt,
      image: `${SITE}/image/og/newsletter/${slug}.png`,
    }),
  };

  return (
    <article data-nl-slot={edition} className="pb-20 pt-28 md:pt-36">
      <JsonLd schema={schema} />
      <Container className="max-w-[760px] xl:px-0">
        <Breadcrumbs
          className="mb-8"
          items={[
            { label: "Home", href: "/" },
            { label: "Newsletter", href: "/newsletter" },
            { label: `${displayDate} — ${edition.toUpperCase()}` },
          ]}
        />

        {/* Header */}
        <header className="mb-12 flex flex-col gap-5 md:mb-14">
          <MetaLine
            items={[
              <span key="edition" className="text-home-orange-ink">
                {EDITION_LABEL[edition]}
              </span>,
              <time key="date" dateTime={fm.publishedAt}>
                {displayDate}
              </time>,
            ]}
          />
          <h1 className="font-editorial text-[38px] font-normal leading-[1.06] tracking-[-0.025em] text-balance text-home-ink md:text-[52px]">
            {fm.title}
          </h1>
          <p className="text-pretty text-xl leading-[1.5] text-home-ink-2 md:text-[22px]">
            {fm.description}
          </p>
        </header>

        {/* Body */}
        <div className="max-w-[68ch]">
          <Mdx source={issue.content} components={newsletterMdxComponents} />
        </div>

        {/* CTA */}
        <div className="my-14 flex flex-col items-start gap-4 border-y border-home-rule py-8">
          <p className="text-[15px] text-home-ink-2">Want more ideas like this?</p>
          <ButtonLink href={ctaUrl} tone="secondary" arrow>
            Browse 45+ startup ideas
          </ButtonLink>
        </div>

        {/* Subscribe */}
        <section
          aria-labelledby="issue-subscribe"
          className="rounded-2xl border border-home-rule bg-home-card p-6 md:p-8"
        >
          <h2
            id="issue-subscribe"
            className="mb-2 font-editorial text-[26px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink md:text-[32px]"
          >
            Get the next one in your inbox
          </h2>
          <p className="mb-6 text-[15px] text-home-ink-2">
            Free. 2 emails a day. Unsubscribe anytime.
          </p>
          <NewsletterSignupForm utmCampaign={`newsletter-web-${edition}`} />
        </section>

        {/* Footer row: back to the archive */}
        <div className="mt-10">
          <Link
            href="/newsletter"
            className="inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
          >
            <Icon name="arrow" size={16} strokeWidth={1.75} className="rotate-180" />
            <span>All newsletters</span>
          </Link>
        </div>
      </Container>
    </article>
  );
}
