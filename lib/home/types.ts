/** Shapes shared by the WP42 homepage data layer and its sections. */

export type IdeaScores = {
  opportunity?: number;
  pain?: number;
  timing?: number;
  builder_confidence?: number;
};

/** The subset of an `ideas/manifest.json` entry the homepage reads. */
export type ManifestIdea = {
  slug: string;
  title: string;
  description?: string;
  category?: string;
  buildTime?: string;
  revenueGoal?: string;
  tools?: string[];
  audiences?: string[];
  scores?: IdeaScores;
  publishedAt?: string;
  provenance?: { citations?: number | null } | null;
  /** `status: "ready"` means `public/image/og/idea/{slug}.png` exists. */
  og?: { status?: string } | null;
  highlights?: unknown;
  _retiredAt?: string;
};

export type MarketStat = { value: string; text: string };
export type Competitor = { name: string; price: string };
export type Tier = { name: string; price: string };
export type Prompt = { title: string; lines: string[] };

/** What the homepage can pull out of one idea's MDX body. */
export type IdeaExtract = {
  problem: string;
  how: string[];
  market: MarketStat[];
  competitors: Competitor[];
  tiers: Tier[];
  stack: string[];
  prompts: Prompt[];
};

export type CategoryCount = { slug: string; name: string; count: number };

export type IndexRow = {
  slug: string;
  title: string;
  category: string;
  categoryName: string;
  buildTime: number;
  revenueGoal: string;
  libraryNo: number;
  art: string | null;
};

/** Section 03 (and the prompts in section 05). */
export type SpotlightIdea = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  category: string;
  categoryName: string;
  buildTime: number;
  revenueGoal: string;
  how: string[];
  scores: Required<IdeaScores>;
  sources: number;
  art: string;
  prompts: Prompt[];
};

/** Section 06. */
export type InsideIdea = {
  slug: string;
  title: string;
  shortTitle: string;
  revenueGoal: string;
  problem: string;
  how: string[];
  market: MarketStat[];
  competitors: Competitor[];
  tiers: Tier[];
  stack: string[];
  promptTitles: string[];
  sources: number;
};

/** The idea shown inside the hero's build window. */
export type HeroIdea = {
  slug: string;
  title: string;
  libraryNo: number;
  category: string;
  categoryName: string;
  buildTime: number;
  promptTitles: string[];
  firstPrompt: string[];
};

export type HomeData = {
  totals: {
    ideas: number;
    averageHours: number;
    categories: CategoryCount[];
    tools: Record<string, number>;
  };
  week: { label: string; start: string };
  newest: IndexRow[];
  hero: HeroIdea;
  spotlight: SpotlightIdea;
  inside: InsideIdea;
  strip: { slug: string; title: string; art: string }[];
};
