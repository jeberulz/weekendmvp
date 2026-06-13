import type { MetadataRoute } from "next";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { AUDIENCE_SLUGS } from "@/app/ideas-for/[audience]/page";
import { COLLECTION_SLUGS } from "@/app/ideas/[slug]/collection";
import { PROBLEM_SLUGS } from "@/app/solve/[problem]/page";

const SITE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.weekendmvp.app";

const BUILD_WITH_SLUGS = [
  "bolt",
  "claude",
  "cursor",
  "lovable",
  "no-code",
  "replit",
  "v0",
  "windsurf",
];

type Entry = MetadataRoute.Sitemap[number];

async function listMdxFrontmatter(
  dir: string,
): Promise<{ slug: string; publishedAt?: number }[]> {
  try {
    const files = await fs.readdir(dir);
    const mdx = files.filter(
      (f) => f.endsWith(".mdx") && !f.startsWith("_"),
    );
    const rows = await Promise.all(
      mdx.map(async (filename) => {
        const slug = filename.replace(/\.mdx$/, "");
        try {
          const raw = await fs.readFile(path.join(dir, filename), "utf8");
          const { data } = matter(raw);
          const value = data?.publishedAt;
          const publishedAt =
            typeof value === "number"
              ? value
              : typeof value === "string"
                ? Date.parse(value)
                : undefined;
          return {
            slug,
            publishedAt: Number.isFinite(publishedAt)
              ? (publishedAt as number)
              : undefined,
          };
        } catch {
          return { slug };
        }
      }),
    );
    return rows;
  } catch {
    return [];
  }
}

function entry(
  pathname: string,
  opts: {
    lastModified?: number | Date;
    changeFrequency?: Entry["changeFrequency"];
    priority?: number;
  } = {},
): Entry {
  return {
    url: `${SITE}${pathname}`,
    lastModified:
      opts.lastModified instanceof Date
        ? opts.lastModified
        : typeof opts.lastModified === "number"
          ? new Date(opts.lastModified)
          : new Date(),
    changeFrequency: opts.changeFrequency ?? "weekly",
    priority: opts.priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ideas, articles, newsletters] = await Promise.all([
    listMdxFrontmatter("content/ideas"),
    listMdxFrontmatter("content/articles"),
    listMdxFrontmatter("content/newsletter-pages"),
  ]);

  const rootPages: Entry[] = [
    entry("/", { priority: 1.0, changeFrequency: "weekly" }),
    entry("/startup-ideas", { priority: 0.95, changeFrequency: "daily" }),
    entry("/articles", { priority: 0.9, changeFrequency: "weekly" }),
    entry("/newsletter", { priority: 0.9, changeFrequency: "daily" }),
    entry("/starter-kit", { priority: 0.85, changeFrequency: "monthly" }),
    entry("/shipable", { priority: 0.85, changeFrequency: "weekly" }),
    entry("/privacy-policy", {
      priority: 0.3,
      changeFrequency: "yearly",
    }),
  ];

  const ideaPages: Entry[] = ideas.map((i) =>
    entry(`/ideas/${i.slug}`, {
      lastModified: i.publishedAt,
      changeFrequency: "monthly",
      priority: 0.8,
    }),
  );

  const articlePages: Entry[] = articles.map((a) =>
    entry(`/articles/${a.slug}`, {
      lastModified: a.publishedAt,
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  );

  const newsletterPages: Entry[] = newsletters.map((n) =>
    entry(`/newsletter/${n.slug}`, {
      lastModified: n.publishedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  const audienceHubs: Entry[] = AUDIENCE_SLUGS.map((slug) =>
    entry(`/ideas-for/${slug}`, {
      changeFrequency: "weekly",
      priority: 0.75,
    }),
  );

  const buildWithHubs: Entry[] = BUILD_WITH_SLUGS.map((slug) =>
    entry(`/build-with/${slug}`, {
      changeFrequency: "weekly",
      priority: 0.75,
    }),
  );

  const solveHubs: Entry[] = PROBLEM_SLUGS.map((slug) =>
    entry(`/solve/${slug}`, {
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  const collectionHubs: Entry[] = COLLECTION_SLUGS.map((slug) =>
    entry(`/ideas/${slug}`, {
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return [
    ...rootPages,
    ...ideaPages,
    ...articlePages,
    ...newsletterPages,
    ...audienceHubs,
    ...buildWithHubs,
    ...solveHubs,
    ...collectionHubs,
  ];
}
