import type { MetadataRoute } from "next";

import { AUDIENCE_SLUGS } from "@/app/ideas-for/[audience]/page";
import { COLLECTION_SLUGS } from "@/app/ideas/[slug]/collection";
import { PLAYBOOK_SLUGS } from "@/app/playbooks/_playbooks";
import { PROBLEM_SLUGS } from "@/app/solve/[problem]/page";
import {
  listMdxFrontmatter,
  loadIdeaPublishedAtMap,
} from "@/lib/sitemap-data";
import { SITE } from "@/lib/seo";

const BUILD_WITH_SLUGS = [
  "bolt",
  "claude",
  "claude-code",
  "cursor",
  "lovable",
  "no-code",
  "replit",
  "v0",
  "windsurf",
];

type Entry = MetadataRoute.Sitemap[number];

function entry(
  pathname: string,
  opts: {
    lastModified?: number | Date;
    changeFrequency?: Entry["changeFrequency"];
    priority?: number;
  } = {},
): Entry {
  // Only emit lastmod when we have a real content date. Request-time "now"
  // for every hub/idea trains Google to ignore the field (WP17).
  const lastModified =
    opts.lastModified instanceof Date
      ? opts.lastModified
      : typeof opts.lastModified === "number"
        ? new Date(opts.lastModified)
        : undefined;

  return {
    url: `${SITE}${pathname}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: opts.changeFrequency ?? "weekly",
    priority: opts.priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ideas, articles, newsletters, ideaDates] = await Promise.all([
    listMdxFrontmatter("content/ideas"),
    listMdxFrontmatter("content/articles"),
    listMdxFrontmatter("content/newsletter-pages"),
    loadIdeaPublishedAtMap(),
  ]);

  const rootPages: Entry[] = [
    entry("/", { priority: 1.0, changeFrequency: "weekly" }),
    entry("/startup-ideas", { priority: 0.95, changeFrequency: "daily" }),
    entry("/articles", { priority: 0.9, changeFrequency: "weekly" }),
    entry("/newsletter", { priority: 0.9, changeFrequency: "daily" }),
    entry("/links", { priority: 0.9, changeFrequency: "daily" }),
    entry("/starter-kit", { priority: 0.85, changeFrequency: "monthly" }),
    entry("/shipable", { priority: 0.85, changeFrequency: "weekly" }),
    entry("/john-iseghohi", { priority: 0.8, changeFrequency: "monthly" }),
    entry("/about", { priority: 0.7, changeFrequency: "monthly" }),
    entry("/privacy-policy", {
      priority: 0.3,
      changeFrequency: "yearly",
    }),
  ];

  const ideaPages: Entry[] = ideas.map((i) =>
    entry(`/ideas/${i.slug}`, {
      // Idea MDX is body-only (slug/title); publish dates live in the manifest.
      lastModified: ideaDates.get(i.slug) ?? i.publishedAt,
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

  const playbooks: Entry[] = PLAYBOOK_SLUGS.map((slug) =>
    entry(`/playbooks/${slug}`, {
      changeFrequency: "monthly",
      priority: 0.85,
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
    ...playbooks,
  ];
}
