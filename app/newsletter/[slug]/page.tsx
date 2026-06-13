import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { MDXComponents } from "next-mdx-remote-client/rsc";

import { JsonLd } from "@/components/primitives/JsonLd";
import { NewsletterSignupForm } from "@/components/newsletter/NewsletterSignupForm";
import { Mdx, listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { articleSchema } from "@/lib/seo";

const CONTENT_DIR = "content/newsletter-pages";
const SITE = "https://weekendmvp.app";

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
 * mirroring the legacy `div.text-center > a` white pill.
 */
function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    "inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all";
  const external = /^https?:\/\//i.test(href);
  return (
    <div className="my-8 text-center">
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          <span>{children}</span>
          <ArrowRight size={16} aria-hidden="true" />
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      ) : (
        <Link href={href} className={className}>
          <span>{children}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

const newsletterMdxComponents: MDXComponents = {
  Cta,
  h2: (props: React.JSX.IntrinsicElements["h2"]) => (
    <h2
      className="text-2xl font-medium text-white mb-6 mt-10 tracking-tight"
      {...props}
    />
  ),
  h3: (props: React.JSX.IntrinsicElements["h3"]) => (
    <h3
      className="text-xl font-medium text-white mb-4 mt-10 tracking-tight"
      {...props}
    />
  ),
  h4: (props: React.JSX.IntrinsicElements["h4"]) => (
    <h4 className="text-lg font-medium text-white mb-3 mt-6" {...props} />
  ),
  a: (props: React.JSX.IntrinsicElements["a"]) => (
    <a
      className="text-white underline decoration-neutral-600 underline-offset-2 hover:decoration-white transition-colors"
      {...props}
    />
  ),
  hr: (props: React.JSX.IntrinsicElements["hr"]) => (
    <hr className="my-8 border-0 h-px bg-white/10" {...props} />
  ),
  ul: (props: React.JSX.IntrinsicElements["ul"]) => (
    <ul
      className="list-disc list-outside pl-6 space-y-2 text-neutral-300 leading-relaxed mb-6"
      {...props}
    />
  ),
  li: (props: React.JSX.IntrinsicElements["li"]) => (
    <li className="leading-relaxed" {...props} />
  ),
  // Hero/illustration images (`![alt](src)`) — legacy full-width figure.
  img: ({ alt, ...props }: React.JSX.IntrinsicElements["img"]) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      className="w-full rounded-2xl border border-white/10 my-8"
      {...props}
    />
  ),
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
    <article data-nl-slot={edition} className="relative z-10 pt-20 pb-24">
      <JsonLd schema={schema} />
      <div className="max-w-2xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="mb-8 text-xs text-neutral-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/newsletter"
            className="hover:text-white transition-colors"
          >
            Newsletter
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-400">
            {displayDate} — {edition.toUpperCase()}
          </span>
        </nav>

        {/* Header */}
        <header className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              {EDITION_LABEL[edition]}
            </span>
            <span className="text-neutral-600 text-xs">•</span>
            <time className="text-neutral-600 text-xs" dateTime={fm.publishedAt}>
              {displayDate}
            </time>
          </div>
          <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight leading-[1.1] mb-6">
            {fm.title}
          </h1>
          <p className="text-xl text-neutral-400 font-light leading-relaxed">
            {fm.description}
          </p>
        </header>

        {/* Body */}
        <div className="text-neutral-300 leading-relaxed">
          <Mdx source={issue.content} components={newsletterMdxComponents} />
        </div>

        {/* CTA card */}
        <div className="my-16 p-8 bg-white/[0.02] border border-white/10 rounded-2xl text-center">
          <p className="text-neutral-400 text-sm mb-4">
            Want more ideas like this?
          </p>
          <Link
            href={ctaUrl}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all"
          >
            <span>Browse 45+ startup ideas</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {/* Subscribe */}
        <section className="mt-16 p-8 bg-white/[0.02] border border-white/10 rounded-2xl">
          <h2 className="text-xl md:text-2xl font-medium text-white tracking-tight mb-2">
            Get the next one in your inbox
          </h2>
          <p className="text-sm text-neutral-400 mb-6">
            Free. 2 emails a day. Unsubscribe anytime.
          </p>
          <NewsletterSignupForm utmCampaign={`newsletter-web-${edition}`} />
        </section>

        {/* Footer row: back to the archive */}
        <div className="mt-12 text-center">
          <Link
            href="/newsletter"
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>All newsletters</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
