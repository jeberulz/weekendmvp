/** Client-safe shapes for the public research-desk pages (WP56). */

export type PublicScores = {
  opportunity: number;
  pain: number;
  timing: number;
  builder_confidence: number;
};

/** One idea as every public list (cards or rows) draws it. */
export type PublicIdea = {
  slug: string;
  title: string;
  description: string;
  /** Normalized category slug, "" when unknown. */
  category: string;
  categoryName: string;
  /** Estimated build hours; 0 when unknown. */
  buildTime: number;
  revenueGoal: string;
  /** Display names, at most three. */
  tools: string[];
  scores: PublicScores | null;
  /** Mean of the four scores to one decimal, or null when unscored. */
  score: number | null;
  /** Position in publish order (N°…), when the idea is in the manifest. */
  libraryNo: number | null;
  /** OG art path when the card PNG exists. */
  art: string | null;
};

export type IdeaView = "cards" | "rows";
