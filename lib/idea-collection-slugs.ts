/** Public collection routes that share the /ideas/[slug] page. */
export const IDEA_COLLECTION_SLUGS = [
  "saas", "ai-tools", "automation", "developer-tools", "productivity",
  "marketplace", "education", "health", "b2b", "creator-tools",
  "fintech", "ecommerce", "1k-month", "5k-month", "10k-month",
  "passive-income", "quick-wins", "build-in-weekend", "build-in-8-hours",
  "build-in-1-week",
] as const;

export type IdeaCollectionSlug = (typeof IDEA_COLLECTION_SLUGS)[number];

const IDEA_COLLECTION_SET: ReadonlySet<string> = new Set(IDEA_COLLECTION_SLUGS);

export function isIdeaCollectionSlug(slug: string): slug is IdeaCollectionSlug {
  return IDEA_COLLECTION_SET.has(slug);
}
