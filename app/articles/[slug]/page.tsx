import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";

import { JsonLd } from "@/components/primitives/JsonLd";
import { NavExternalLink } from "@/components/primitives/NavExternalLink";
import { Mdx, listMdxSlugs, readMdxFile } from "@/lib/mdx";

const CONTENT_DIR = "content/articles";
const SITE = "https://weekendmvp.app";

type ArticleFrontmatter = {
  slug: string;
  title: string;
  description: string;
  category?: string;
  publishedAt?: string; // YYYY-MM-DD
  wordCount?: number;
  readMinutes?: number;
  heroAlt?: string;
};

type Article = { frontmatter: ArticleFrontmatter; content: string };

/* ------------------------------------------------------------------ */
/* Data (filesystem is the static-params + render source; Convex owns  */
/* freshness via the article:<slug> cache tag → revalidate hook)       */
/* ------------------------------------------------------------------ */

async function getArticleSlugs(): Promise<string[]> {
  "use cache";
  cacheTag("articles");
  cacheLife("hours");
  return listMdxSlugs(CONTENT_DIR);
}

async function getArticle(slug: string): Promise<Article | null> {
  "use cache";
  cacheTag(`article:${slug}`, "articles");
  cacheLife("hours");
  const file = await readMdxFile(CONTENT_DIR, slug);
  if (!file) return null;
  return {
    frontmatter: file.frontmatter as ArticleFrontmatter,
    content: file.content,
  };
}

/** "2026-01-27" → "Jan 27, 2026" (deterministic, cached scope only). */
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
  const article = await getArticle(slug);
  if (!article) return {};
  const { title, description } = article.frontmatter;
  const url = `${SITE}/articles/${slug}`;
  const ogImage = `${SITE}/image/og/article/${slug}.png`;
  return {
    title: { absolute: `${title} | Weekend MVP` },
    description,
    authors: [{ name: "John Iseghohi" }],
    alternates: { canonical: `/articles/${slug}` },
    openGraph: {
      type: "article",
      url,
      title: `${title} | Weekend MVP`,
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
      title: `${title} | Weekend MVP`,
      description,
      images: [ogImage],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugs = await getArticleSlugs();
  if (!slugs.includes(slug)) notFound();
  return <CachedArticle slug={slug} />;
}

/** Data + render cached together; revalidated via `article:<slug>`. */
async function CachedArticle({ slug }: { slug: string }) {
  "use cache";
  cacheTag(`article:${slug}`, "articles");
  cacheLife("hours");

  const article = await getArticle(slug);
  if (!article) notFound();
  const fm = article.frontmatter;
  const displayDate = formatDate(fm.publishedAt);
  const ogImage = `${SITE}/image/og/article/${slug}.png`;

  // Mirrors the legacy per-article JSON-LD Article block (same author shape).
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fm.title,
    description: fm.description,
    author: {
      "@type": "Person",
      name: "John Iseghohi",
      url: "https://cal.com/switchtoux",
    },
    publisher: {
      "@type": "Organization",
      name: "Weekend MVP",
      url: SITE,
    },
    ...(fm.publishedAt
      ? { datePublished: fm.publishedAt, dateModified: fm.publishedAt }
      : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE}/articles/${slug}`,
    },
    image: ogImage,
  };

  return (
    <article className="relative z-10 pt-32 pb-24">
      <JsonLd schema={schema} />
      <div className="max-w-2xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="mb-8 text-xs text-neutral-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/articles" className="hover:text-white transition-colors">
            Articles
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-400">{fm.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-16">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {fm.category ? (
              <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                {fm.category}
              </span>
            ) : null}
            <span className="text-neutral-600 text-xs">•</span>
            <span className="text-neutral-600 text-xs">
              By{" "}
              <NavExternalLink
                href="https://cal.com/switchtoux"
                className="hover:text-neutral-400 transition-colors"
              >
                John Iseghohi
              </NavExternalLink>
            </span>
            {displayDate ? (
              <>
                <span className="text-neutral-600 text-xs">•</span>
                <span className="text-neutral-600 text-xs">{displayDate}</span>
              </>
            ) : null}
            {fm.readMinutes ? (
              <>
                <span className="text-neutral-600 text-xs">•</span>
                <span className="text-neutral-600 text-xs">
                  {fm.readMinutes} min read
                </span>
              </>
            ) : null}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white tracking-tight leading-[1.1] mb-6">
            {fm.title}
          </h1>
          <p className="text-xl md:text-2xl text-neutral-400 font-light leading-relaxed">
            {fm.description}
          </p>
        </header>

        {/* Hero (same asset as og:image; served from the legacy /image path
            until the U13 OG move) */}
        <figure className="mb-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/image/og/article/${slug}.png`}
            alt={fm.heroAlt ?? ""}
            width={1200}
            height={630}
            loading="eager"
            decoding="async"
            className="w-full rounded-2xl border border-white/10 aspect-[1200/630] object-cover"
          />
        </figure>

        {/* Body */}
        <Mdx source={article.content} />
      </div>
    </article>
  );
}
