import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";

import { Container } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { FooterCta } from "@/components/public/FooterCta";
import { Breadcrumbs, MetaLine } from "@/components/public/PageHeader";
import { Mdx, listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { SITE, articleSchema } from "@/lib/seo";
import { articleMdxComponents } from "../article-prose";

const CONTENT_DIR = "content/articles";

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
    authors: [{ name: "John Iseghohi", url: "/john-iseghohi" }],
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
    ...articleSchema({
      title: fm.title,
      description: fm.description,
      slug,
      datePublished: fm.publishedAt,
      image: ogImage,
    }),
  };

  return (
    <>
      <article className="pb-20 pt-28 md:pt-36">
        <JsonLd schema={schema} />
        <Container className="max-w-[760px] xl:px-0">
          <Breadcrumbs
            className="mb-8"
            items={[
              { label: "Home", href: "/" },
              { label: "Articles", href: "/articles" },
              { label: fm.title },
            ]}
          />

          {/* Header */}
          <header className="mb-12 flex flex-col gap-5 md:mb-14">
            <MetaLine
              items={[
                fm.category ? (
                  <span className="text-home-orange-ink">{fm.category}</span>
                ) : null,
                <>
                  By{" "}
                  <Link
                    href="/john-iseghohi"
                    className="underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
                  >
                    John Iseghohi
                  </Link>
                </>,
                displayDate,
                fm.readMinutes ? `${fm.readMinutes} min read` : null,
              ]}
            />
            <h1 className="font-editorial text-[38px] font-normal leading-[1.06] tracking-[-0.025em] text-balance text-home-ink md:text-[52px]">
              {fm.title}
            </h1>
            <p className="text-pretty text-xl leading-[1.5] text-home-ink-2 md:text-[22px]">
              {fm.description}
            </p>
          </header>

          {/* Hero (same asset as og:image; served from the legacy /image path
              until the U13 OG move) */}
          <figure className="mb-12 md:mb-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/image/og/article/${slug}.png`}
              alt={fm.heroAlt ?? ""}
              width={1200}
              height={630}
              loading="eager"
              decoding="async"
              className="aspect-[1200/630] w-full rounded-2xl border border-home-rule object-cover"
            />
          </figure>

          {/* Body */}
          <div className="max-w-[68ch]">
            <Mdx source={article.content} components={articleMdxComponents} />
          </div>
        </Container>
      </article>
      <FooterCta />
    </>
  );
}
