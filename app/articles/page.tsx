import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { JsonLd } from "@/components/primitives/JsonLd";
import { listMdxSlugs, readMdxFile } from "@/lib/mdx";
import { breadcrumbSchema, buildGraph } from "@/lib/seo";
import { ArticlesIndex, type ArticleCard } from "./ArticlesIndex";

const SITE = "https://weekendmvp.app";
const CONTENT_DIR = "content/articles";
const TITLE = "Articles | Weekend MVP";
const DESCRIPTION =
  "Guides, frameworks, and ideas for shipping your weekend MVP. Learn to build and launch products in 48 hours.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/articles" },
  openGraph: {
    type: "website",
    url: `${SITE}/articles`,
    title: TITLE,
    description: DESCRIPTION,
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
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE}/image/og-image.png`],
  },
};

type ArticleListItem = ArticleCard & { publishedAt?: number };

/** "1738022400000 | 2026-01-27" → "Jan 27, 2026" (cached scope only). */
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

/** Frontmatter fields each card needs (category lives only on disk). */
async function listFromFilesystem(): Promise<ArticleListItem[]> {
  const slugs = await listMdxSlugs(CONTENT_DIR);
  const files = await Promise.all(
    slugs.map((slug) => readMdxFile(CONTENT_DIR, slug)),
  );
  const items: ArticleListItem[] = [];
  for (const file of files) {
    if (!file) continue;
    const fm = file.frontmatter as {
      slug: string;
      title: string;
      description: string;
      category?: string;
      publishedAt?: string;
      readMinutes?: number;
    };
    const ts = fm.publishedAt
      ? Date.parse(`${fm.publishedAt}T00:00:00Z`)
      : undefined;
    items.push({
      slug: fm.slug ?? file.slug,
      title: fm.title,
      description: fm.description,
      category: fm.category,
      readMinutes: fm.readMinutes,
      publishedAt: Number.isNaN(ts) ? undefined : ts,
      displayDate: formatDate(fm.publishedAt),
    });
  }
  items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  return items;
}

/**
 * Convex is the listing source (revalidated via the `articles` tag from
 * convex/articles.upsertBySlug); the MDX frontmatter on disk is the build-time
 * fallback when Convex is unreachable, and always supplies `category`,
 * which the articles table does not store.
 */
async function getArticles(): Promise<ArticleListItem[]> {
  "use cache";
  cacheTag("articles");
  cacheLife("hours");

  const fsItems = await listFromFilesystem();
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    const docs = await fetchQuery(api.articles.list, {}, { url });
    if (!docs.length) throw new Error("articles table is empty");
    const categoryBySlug = new Map(fsItems.map((i) => [i.slug, i.category]));
    return docs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      category: categoryBySlug.get(doc.slug),
      readMinutes: doc.readMinutes,
      publishedAt: doc.publishedAt,
      displayDate: formatDate(doc.publishedAt),
    }));
  } catch {
    // Convex unavailable (e.g. at build time) — serve frontmatter listing.
    return fsItems;
  }
}

export default async function ArticlesPage() {
  return <CachedArticlesPage />;
}

async function CachedArticlesPage() {
  "use cache";
  cacheTag("articles");
  cacheLife("hours");

  const articles = await getArticles();
  const latest = articles
    .map((a) => a.publishedAt)
    .filter((ts): ts is number => typeof ts === "number")
    .sort((a, b) => b - a)[0];
  const updatedLabel = latest
    ? new Date(latest).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : undefined;

  // CollectionPage + ItemList ported from the articles.html JSON-LD
  // (extensionless URLs, positions normalized).
  const schema = buildGraph(
    {
      "@type": "CollectionPage",
      name: "Weekend MVP Articles",
      description:
        "Guides, frameworks, and ideas for shipping your weekend MVP.",
      url: `${SITE}/articles`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: articles.length,
        itemListElement: articles.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Article",
            name: article.title,
            url: `${SITE}/articles/${article.slug}`,
          },
        })),
      },
    },
    breadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Articles", href: "/articles" },
    ]),
  );

  return (
    <main className="relative z-10">
      <JsonLd schema={schema} />
      <ArticlesIndex articles={articles} updatedLabel={updatedLabel} />
    </main>
  );
}
