/**
 * RSS 2.0 feed generation for ideas, articles, and newsletter issues.
 *
 * Data comes from build-time sources only (manifest JSON imports + MDX
 * frontmatter on disk) so the feeds never depend on Convex being reachable —
 * the same content ships in the deploy that ships the feed. Consumed by the
 * app/feed.xml, app/articles/feed.xml, and app/newsletter/feed.xml route
 * handlers.
 */

import ideasManifest from "@/ideas/manifest.json";
import newsletterManifest from "@/newsletter/manifest.json";
import { listMdxSlugs, readMdxFile } from "@/lib/mdx";

const SITE =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
  "https://www.weekendmvp.app";

export type FeedItem = {
  title: string;
  /** Site-relative path, e.g. /ideas/foo. */
  path: string;
  description: string;
  /** YYYY-MM-DD (feeds sort + emit pubDate from this). */
  publishedAt?: string;
};

export type FeedChannel = {
  title: string;
  /** Site-relative path of the HTML page this feed mirrors. */
  path: string;
  /** Site-relative path of the feed itself (atom:link self). */
  feedPath: string;
  description: string;
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toPubDate(date: string | undefined): string | undefined {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T07:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toUTCString();
}

/** Render an RSS 2.0 document (newest first, capped at `limit`). */
export function renderRss(
  channel: FeedChannel,
  items: FeedItem[],
  limit = 50,
): string {
  const sorted = [...items].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
  const latestPubDate = toPubDate(sorted[0]?.publishedAt);

  const itemXml = sorted
    .slice(0, limit)
    .map((item) => {
      const url = `${SITE}${item.path}`;
      const pubDate = toPubDate(item.publishedAt);
      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        ...(pubDate ? [`      <pubDate>${pubDate}</pubDate>`] : []),
        `      <description>${escapeXml(item.description)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(`${SITE}${channel.path}`)}</link>`,
    `    <atom:link href="${escapeXml(`${SITE}${channel.feedPath}`)}" rel="self" type="application/rss+xml"/>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    "    <language>en</language>",
    ...(latestPubDate ? [`    <lastBuildDate>${latestPubDate}</lastBuildDate>`] : []),
    itemXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

/* ------------------------------------------------------------------ */
/* Per-surface item loaders                                            */
/* ------------------------------------------------------------------ */

export function ideaFeedItems(): FeedItem[] {
  return ideasManifest.ideas.map((idea) => ({
    title: idea.title,
    path: `/ideas/${idea.slug}`,
    description: idea.description ?? "",
    publishedAt: idea.publishedAt,
  }));
}

export function newsletterFeedItems(): FeedItem[] {
  return newsletterManifest.newsletters.map((issue) => ({
    title: issue.title,
    path: `/newsletter/${issue.slug}`,
    description: issue.description ?? "",
    publishedAt: issue.publishedAt,
  }));
}

/** Articles' publishedAt lives in MDX frontmatter, not the manifest. */
export async function articleFeedItems(): Promise<FeedItem[]> {
  const slugs = await listMdxSlugs("content/articles");
  const items: FeedItem[] = [];
  for (const slug of slugs) {
    const file = await readMdxFile("content/articles", slug);
    if (!file) continue;
    const fm = file.frontmatter as {
      title?: string;
      description?: string;
      publishedAt?: string;
    };
    if (!fm.title) continue;
    items.push({
      title: fm.title,
      path: `/articles/${slug}`,
      description: fm.description ?? "",
      publishedAt:
        typeof fm.publishedAt === "string" ? fm.publishedAt : undefined,
    });
  }
  return items;
}
