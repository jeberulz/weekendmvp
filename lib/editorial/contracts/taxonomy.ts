/**
 * Tag and highlight allowlists for editorial metadata.
 *
 * These mirror `scripts/validate-idea-tags.mjs` (the publishing gate) and the
 * category list in `ideas/manifest.json`. They are copied rather than imported
 * because that script reads the manifest from disk at import time and cannot
 * ship to the browser. `tests/editorial/contracts/taxonomy-drift.test.ts`
 * fails if the two ever disagree.
 */
export const CATEGORY_SLUGS = [
  "saas",
  "productivity",
  "health",
  "marketplace",
  "ai-tools",
  "automation",
  "education",
  "b2b",
  "developer-tools",
  "ecommerce",
  "creator-tools",
  "fintech",
] as const;

export const TOOL_SLUGS = [
  "cursor",
  "claude",
  "bolt",
  "v0",
  "lovable",
  "replit",
  "windsurf",
  "no-code",
] as const;

export const AUDIENCE_SLUGS = [
  "developers",
  "designers",
  "non-technical",
  "solo-founders",
  "weekend-builders",
  "side-hustlers",
  "marketers",
  "freelancers",
  "creators",
  "small-business-owners",
] as const;

export const REVENUE_GOAL_SLUGS = [
  "1k-month",
  "5k-month",
  "10k-month",
  "passive-income",
  "quick-wins",
] as const;

/** Canonical hour strings matching the build-time hub collections. */
export const BUILD_TIME_VALUES = ["8", "10", "12", "20", "24", "30", "40"] as const;

export const MIN_TOOLS = 2;
export const MIN_AUDIENCES = 2;

/** Same limits as `HIGHLIGHT_LIMITS` in the tag validator. */
export const HIGHLIGHT_LIMITS = {
  problemQuote: 190,
  statValue: 12,
  statLabel: 90,
  statSource: 48,
  maxStats: 3,
  competitorName: 32,
  competitorPrice: 16,
  minCompetitors: 3,
  maxCompetitors: 5,
} as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
export type ToolSlug = (typeof TOOL_SLUGS)[number];
export type AudienceSlug = (typeof AUDIENCE_SLUGS)[number];
export type RevenueGoalSlug = (typeof REVENUE_GOAL_SLUGS)[number];
export type BuildTimeValue = (typeof BUILD_TIME_VALUES)[number];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  saas: "SaaS",
  productivity: "Productivity",
  health: "Health",
  marketplace: "Marketplace",
  "ai-tools": "AI tools",
  automation: "Automation",
  education: "Education",
  b2b: "B2B",
  "developer-tools": "Developer tools",
  ecommerce: "E-commerce",
  "creator-tools": "Creator tools",
  fintech: "Fintech",
};
