/** Pure helpers over the idea manifest for the homepage. */
import { categoryName, normalizeCategorySlug } from "../../components/ideas/idea-meta";
import { isEngineDraftSlug } from "../engine-drafts";
import type { CategoryCount, IdeaExtract, IndexRow, ManifestIdea } from "./types";

export const ogArtPath = (slug: string) => `/image/og/idea/${slug}.png`;

/** The OG generator flips `og.status` to "ready" once the card PNG is written. */
export const hasOgArt = (idea: ManifestIdea) => idea.og?.status === "ready";

/**
 * The ideas every homepage list, pick and count reads. Retired ideas drop
 * out, and so do engine drafts (WP54-S5) even if a row slips into the
 * manifest: their page answers 404.
 */
export function liveIdeas(ideas: readonly ManifestIdea[]): ManifestIdea[] {
  return ideas.filter((idea) => !idea._retiredAt && !isEngineDraftSlug(idea.slug));
}

/** Oldest first; ties break on slug so the order is stable. */
export function publishOrder(ideas: readonly ManifestIdea[]): ManifestIdea[] {
  return [...ideas].sort(
    (a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "") || a.slug.localeCompare(b.slug),
  );
}

export function categoryCounts(ideas: readonly ManifestIdea[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    const slug = normalizeCategorySlug(idea.category);
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, name: categoryName(slug), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function toolCounts(ideas: readonly ManifestIdea[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const idea of ideas) for (const tool of idea.tools ?? []) counts[tool] = (counts[tool] ?? 0) + 1;
  return counts;
}

export function averageHours(ideas: readonly ManifestIdea[]): number {
  const hours = ideas.map((i) => Number(i.buildTime)).filter((h) => Number.isFinite(h) && h > 0);
  return hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : 0;
}

/** The `count` newest ideas, each numbered by its place in publish order. */
export function newestRows(ideas: readonly ManifestIdea[], hasArt: (slug: string) => boolean, count = 8): IndexRow[] {
  const ordered = publishOrder(ideas);
  return ordered
    .map((idea, i) => ({ idea, libraryNo: i + 1 }))
    .reverse()
    .slice(0, count)
    .map(({ idea, libraryNo }) => {
      const category = normalizeCategorySlug(idea.category);
      return {
        slug: idea.slug,
        title: idea.title,
        category,
        categoryName: category ? categoryName(category) : "",
        buildTime: Number(idea.buildTime) || 0,
        revenueGoal: idea.revenueGoal ?? "",
        libraryNo,
        art: hasArt(idea.slug) ? ogArtPath(idea.slug) : null,
      };
    });
}

/** A manifest row the idea engine compiled (`source: "engine:<slug>"`). */
export function isEngineIdea(idea: ManifestIdea): boolean {
  return typeof idea.source === "string" && idea.source.startsWith("engine:");
}

/**
 * An idea can be featured weekly only when every tile it feeds has data:
 * art, How it works, 3+ prompts, pricing, a market number, and 3+ sources
 * (owner ruling 2026-09-24, WP42 live homepage data). The rule is the same
 * for every source. Known limit: an engine idea shows tiers only from its
 * generated highlights (R15), which carry none, so it is not feature-ready
 * until a tier source exists; it still appears in the Index.
 */
export function isFeatureReady(idea: ManifestIdea, extract: IdeaExtract, hasArt: boolean): boolean {
  return (
    hasArt &&
    extract.problem.length > 0 &&
    extract.how.length >= 3 &&
    extract.market.length >= 1 &&
    extract.competitors.length >= 3 &&
    extract.tiers.length >= 1 &&
    extract.stack.length >= 3 &&
    extract.prompts.length >= 3 &&
    (idea.provenance?.citations ?? 0) >= 3
  );
}
