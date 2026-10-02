import type { SourceType } from "../contracts/evidence";
import type { EvidenceFreshness } from "../contracts/views";

/**
 * Display-side freshness windows by source type, in days since retrieval.
 * WP45 owns the authoritative evidence policy; until its adapter lands
 * (WP46-E5) these windows only colour the review queue and inspector.
 * Retrieval age alone never proves a price is still current.
 */
export const FRESHNESS_WINDOW_DAYS: Record<SourceType, number> = {
  first_party_pricing: 90,
  vendor_page: 180,
  community_discussion: 365,
  news: 365,
  research_report: 540,
  government_data: 730,
  review_site: 180,
  search_summary: 90,
  other: 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function sourceFreshness(
  sourceType: SourceType,
  retrievedAt: string | null,
  nowMs: number,
): { freshness: EvidenceFreshness; windowDays: number } {
  const windowDays = FRESHNESS_WINDOW_DAYS[sourceType];
  if (retrievedAt === null) return { freshness: "unknown", windowDays };
  const retrieved = Date.parse(retrievedAt);
  if (!Number.isFinite(retrieved)) return { freshness: "unknown", windowDays };
  const ageDays = (nowMs - retrieved) / DAY_MS;
  if (ageDays > windowDays) return { freshness: "stale", windowDays };
  if (ageDays > windowDays * 0.75) return { freshness: "aging", windowDays };
  return { freshness: "fresh", windowDays };
}

const ORDER: Record<EvidenceFreshness, number> = { fresh: 0, unknown: 1, aging: 2, stale: 3 };

/** The worst freshness across sources; an idea with no sources is unknown. */
export function worstFreshness(values: readonly EvidenceFreshness[]): EvidenceFreshness {
  if (values.length === 0) return "unknown";
  return values.reduce((worst, value) => (ORDER[value] > ORDER[worst] ? value : worst), "fresh");
}
