/**
 * WP75-S3a — the UI/UX Pro Max lookup for the brand kit (`07` §2B): a
 * deterministic TypeScript query over the vendored data (`proMaxData.ts`, MIT,
 * attribution kept), run before the call and put into the prompt as quoted
 * data. No tool loop (D23).
 *
 * For a blueprint it finds the closest Pro Max product type (keyword overlap
 * with the blueprint's own words; the idea kind's default otherwise), then
 * returns candidates filtered through our bans (`07` §4):
 * - palettes mapped to our five roles, dropped when a `BRAND_TEXT_PAIRS` pair
 *   is below AA 4.5:1 (`failingTextPairs`);
 * - type pairs: only our curated ids (the grammar allows nothing else), ranked
 *   by the moods of Pro Max pairings that share a family with them (ties
 *   broken by a stable hash of the product type, not list order); Pro Max
 *   pairings whose display face is in `BANNED_DISPLAY_FAMILIES` are dropped
 *   before ranking;
 * - one landing pattern, never one built on proof a new business cannot have
 *   (testimonials, ratings, counts, logos), competitor or price tables, metric
 *   or same-size card grids, or effects the renderer does not draw.
 * The model still picks the type pair from `typePairBrief()` and its own
 * palette; candidates are a starting point, and S4a's checks grade the result.
 *
 * Pure and deterministic; relative imports only (the Convex bundler loads
 * this file).
 */

import {
  BANNED_DISPLAY_FAMILIES,
  TYPE_PAIR_IDS,
  TYPE_PAIRS,
  failingTextPairs,
  relativeLuminance,
  type ArtDirection,
  type Blueprint,
  type PaletteRole,
  type TypePairId,
} from "../../contracts/artifacts";
import type { IdeaKind } from "../../contracts/roster";
import {
  PRO_MAX_LANDING_PATTERNS,
  PRO_MAX_PRODUCTS,
  PRO_MAX_TYPE_PAIRINGS,
  type ProMaxLandingPattern,
  type ProMaxProduct,
  type ProMaxTypePairing,
} from "./proMaxData";

export { PRO_MAX_SOURCE } from "./proMaxData";

/** Why a landing pattern is never offered. */
export type LandingBanReason = "fake_proof" | "competitor_or_price_claims" | "metric_or_card_grid" | "renderer_cannot_draw";

/** Every banned Pro Max landing pattern id, with its reason. Only `ALLOWED_LANDING_PATTERNS` are ever offered. */
export const BANNED_LANDING_PATTERNS: Readonly<Record<string, LandingBanReason>> = Object.freeze({
  "hero-testimonials-cta": "fake_proof",
  "product-review-ratings-focused": "fake_proof",
  "trust-authority-conversion": "fake_proof",
  "app-store-style-landing": "fake_proof",
  "enterprise-gateway": "fake_proof",
  "newsletter-content-first": "fake_proof",
  "community-forum-landing": "fake_proof",
  "waitlist-coming-soon": "fake_proof",
  "comparison-table-cta": "competitor_or_price_claims",
  "comparison-table-focus": "competitor_or_price_claims",
  "pricing-page-cta": "competitor_or_price_claims",
  "pricing-focused-landing": "competitor_or_price_claims",
  "real-time-operations-landing": "metric_or_card_grid",
  "feature-rich-showcase": "metric_or_card_grid",
  "bento-grid-showcase": "metric_or_card_grid",
  "portfolio-grid": "metric_or_card_grid",
  "marketplace-directory": "metric_or_card_grid",
  "video-first-hero": "renderer_cannot_draw",
  "scroll-triggered-storytelling": "renderer_cannot_draw",
  "immersive-interactive-experience": "renderer_cannot_draw",
  "interactive-3d-configurator": "renderer_cannot_draw",
  "horizontal-scroll-journey": "renderer_cannot_draw",
  "ai-personalization-landing": "renderer_cannot_draw",
  "ai-driven-dynamic-landing": "renderer_cannot_draw",
  "event-conference-landing": "renderer_cannot_draw",
  "webinar-registration": "renderer_cannot_draw",
  "faq-documentation-landing": "renderer_cannot_draw",
  "before-after-transformation": "renderer_cannot_draw",
});

/** The Pro Max patterns a brand kit may be offered: one hero, a short benefit list or steps, one call to action. */
export const ALLOWED_LANDING_PATTERNS = Object.freeze([
  "hero-features-cta",
  "minimal-single-column",
  "funnel-3-step-conversion",
  "product-demo-features",
  "hero-centric-design",
  "lead-magnet-form",
] as const);

/** The pattern used when nothing allowed matches: hero, short description, a few benefits, the waitlist. */
export const FALLBACK_LANDING_PATTERN_ID = "minimal-single-column";

/** The product type each idea kind falls back to when the blueprint's words match nothing well. */
const IDEA_KIND_PRODUCTS: Readonly<Record<IdeaKind, { consumer: string; business: string }>> = Object.freeze({
  app: { consumer: "Micro SaaS", business: "SaaS (General)" },
  course: { consumer: "Online Course/E-learning", business: "Online Course/E-learning" },
  physical_product: { consumer: "E-commerce", business: "E-commerce" },
  service: { consumer: "Hyperlocal Services", business: "B2B Service" },
  marketplace: { consumer: "Marketplace (P2P)", business: "Marketplace (P2P)" },
  b2b_software: { consumer: "SaaS (General)", business: "SaaS (General)" },
});

/** A keyword match needs this many matched keyword phrases to beat the idea kind's default. */
const MIN_KEYWORD_SCORE = 2;
export const PALETTE_CANDIDATES_MAX = 3;
export const TYPE_PAIR_CANDIDATES_MAX = 4;

export type PaletteCandidate = {
  readonly from: string;
  readonly theme: "light" | "dark";
} & Readonly<Record<PaletteRole, string>>;

export type TypePairCandidate = {
  readonly id: TypePairId;
  readonly directions: readonly ArtDirection[];
  /** Mood words from Pro Max pairings that share a family with this pair. */
  readonly moods: readonly string[];
};

export type LandingPatternCandidate = Pick<ProMaxLandingPattern, "id" | "name" | "sectionOrder" | "ctaPlacement">;

export type DesignExclusion = {
  readonly kind: "palette" | "landing_pattern";
  readonly name: string;
  readonly reason: string;
};

export type DesignCandidates = {
  readonly productType: string;
  readonly matchedBy: "keywords" | "idea_kind";
  readonly palettes: readonly PaletteCandidate[];
  readonly typePairs: readonly TypePairCandidate[];
  readonly landingPattern: LandingPatternCandidate;
  readonly excluded: readonly DesignExclusion[];
};

const STOP_WORDS = new Set(["the", "and", "for", "with", "you", "your", "that", "this", "from", "into", "one", "get", "who", "how", "what", "are", "not", "but", "all", "any", "can", "app"]);

/** Lowercase word stems: letters and digits, at least three characters, a trailing plural `s` dropped. */
export function wordStems(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of text.toLowerCase().match(/[a-z0-9]+/gu) ?? []) {
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    out.add(word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
  }
  return out;
}

/** Keyword phrases of a product whose every stem is in `stems`. */
function keywordScore(product: ProMaxProduct, stems: ReadonlySet<string>): number {
  let score = 0;
  for (const phrase of product.keywords) {
    const words = [...wordStems(phrase)];
    if (words.length > 0 && words.every((word) => stems.has(word))) score += 1;
  }
  return score;
}

const productByType = new Map(PRO_MAX_PRODUCTS.map((product) => [product.type, product]));

function defaultProduct(profile: Blueprint["profile"]): ProMaxProduct {
  const type = IDEA_KIND_PRODUCTS[profile.ideaKind][profile.buyer];
  const product = productByType.get(type);
  if (product === undefined) throw new Error(`Pro Max data has no product type "${type}"`);
  return product;
}

/** The blueprint's own words: pitch, user, loop, features and audience. */
function blueprintStems(blueprint: DesignInput): Set<string> {
  return wordStems([blueprint.pitch, blueprint.oneUser, blueprint.oneLoop, ...blueprint.features, blueprint.profile.audiencePlural].join(" "));
}

export type DesignInput = Pick<Blueprint, "pitch" | "oneUser" | "oneLoop" | "features" | "profile">;

/** Products ranked by keyword score (ties keep the data's order). */
function rankedProducts(stems: ReadonlySet<string>): { product: ProMaxProduct; score: number }[] {
  return PRO_MAX_PRODUCTS.map((product) => ({ product, score: keywordScore(product, stems) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

const isBannedFace = (family: string): boolean => (BANNED_DISPLAY_FAMILIES as readonly string[]).includes(family);

/** Pro Max pairings left after the display-face ban (`07` §4). */
export function allowedTypePairings(): readonly ProMaxTypePairing[] {
  return PRO_MAX_TYPE_PAIRINGS.filter((pairing) => !isBannedFace(pairing.heading));
}

/** Mood words per curated pair: from every allowed Pro Max pairing that shares a family with it. */
const PAIR_MOODS: ReadonlyMap<TypePairId, readonly string[]> = new Map(
  TYPE_PAIR_IDS.map((id) => {
    const families = new Set([TYPE_PAIRS[id].heading.family, TYPE_PAIRS[id].body.family]);
    const moods = new Set<string>();
    for (const pairing of allowedTypePairings()) {
      if (families.has(pairing.heading) || families.has(pairing.body)) for (const mood of pairing.mood) moods.add(mood);
    }
    return [id, [...moods]];
  }),
);

/** FNV-1a: a stable tie-break, so businesses of different product types do not all get the same first pairs. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function typePairCandidates(productType: string, stems: ReadonlySet<string>): TypePairCandidate[] {
  return TYPE_PAIR_IDS.map((id) => {
    const moods = PAIR_MOODS.get(id) ?? [];
    const score = moods.filter((mood) => [...wordStems(mood)].some((word) => stems.has(word))).length;
    return { id, tie: stableHash(`${productType}:${id}`), score, moods };
  })
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, TYPE_PAIR_CANDIDATES_MAX)
    .map(({ id, moods }) => ({ id, directions: [...TYPE_PAIRS[id].directions], moods: moods.slice(0, 8) }));
}

function paletteOf(product: ProMaxProduct): PaletteCandidate | null {
  const palette = product.palette;
  if (palette === null) return null;
  const roles = { primary: palette.primary, secondary: palette.secondary, accent: palette.accent, ground: palette.background, ink: palette.foreground };
  if (!Object.values(roles).every((hex) => /^#[0-9A-Fa-f]{6}$/u.test(hex))) return null;
  const theme = relativeLuminance(roles.ground) > relativeLuminance(roles.ink) ? "light" : "dark";
  return { from: product.type, theme, ...roles };
}

const patternById = new Map(PRO_MAX_LANDING_PATTERNS.map((pattern) => [pattern.id, pattern]));
const norm = (text: string): string => text.trim().toLowerCase();

/**
 * The Pro Max patterns a product's "Landing Page Pattern" text names: an
 * exact name or alias first, then each " + " part by name, alias or name
 * prefix. Unknown text names nothing.
 */
export function patternsNamedBy(text: string): ProMaxLandingPattern[] {
  const found: ProMaxLandingPattern[] = [];
  const add = (pattern: ProMaxLandingPattern | undefined) => {
    if (pattern !== undefined && !found.includes(pattern)) found.push(pattern);
  };
  const byName = (label: string) =>
    PRO_MAX_LANDING_PATTERNS.find((pattern) => norm(pattern.name) === norm(label) || pattern.aliases.some((alias) => norm(alias) === norm(label)));
  add(byName(text));
  for (const part of text.split(" + ")) {
    add(byName(part));
    add(PRO_MAX_LANDING_PATTERNS.find((pattern) => norm(pattern.name).startsWith(norm(part))));
  }
  return found;
}

function landingPatternFor(product: ProMaxProduct, excluded: DesignExclusion[]): LandingPatternCandidate {
  for (const pattern of patternsNamedBy(product.landing)) {
    if ((ALLOWED_LANDING_PATTERNS as readonly string[]).includes(pattern.id)) return pick(pattern);
    excluded.push({ kind: "landing_pattern", name: pattern.name, reason: BANNED_LANDING_PATTERNS[pattern.id] ?? "not_allowed" });
  }
  const fallback = patternById.get(FALLBACK_LANDING_PATTERN_ID);
  if (fallback === undefined) throw new Error(`Pro Max data has no landing pattern "${FALLBACK_LANDING_PATTERN_ID}"`);
  return pick(fallback);
}

const pick = (pattern: ProMaxLandingPattern): LandingPatternCandidate => ({
  id: pattern.id,
  name: pattern.name,
  sectionOrder: pattern.sectionOrder,
  ctaPlacement: pattern.ctaPlacement,
});

/** The brand kit's design candidates for a blueprint. */
export function designCandidatesFor(blueprint: DesignInput): DesignCandidates {
  const stems = blueprintStems(blueprint);
  const ranked = rankedProducts(stems);
  const best = ranked[0];
  const fallback = defaultProduct(blueprint.profile);
  const matched = best !== undefined && best.score >= MIN_KEYWORD_SCORE;
  const product = matched ? best.product : fallback;
  const excluded: DesignExclusion[] = [];

  const sources = [product, ...ranked.slice(0, 4).map((entry) => entry.product), fallback].filter(
    (candidate, index, all) => all.indexOf(candidate) === index,
  );
  const palettes: PaletteCandidate[] = [];
  for (const source of sources) {
    if (palettes.length >= PALETTE_CANDIDATES_MAX) break;
    const palette = paletteOf(source);
    if (palette === null) continue;
    const colour = (role: PaletteRole) => ({ name: role, hex: palette[role], use: role });
    const failing = failingTextPairs({
      palette: { primary: colour("primary"), secondary: colour("secondary"), accent: colour("accent"), ground: colour("ground"), ink: colour("ink") },
    });
    if (failing.length > 0) {
      const pairs = failing.map((pair) => `${pair.text} on ${pair.background} ${pair.ratio.toFixed(2)}:1`).join(", ");
      excluded.push({ kind: "palette", name: source.type, reason: `below AA 4.5:1 (${pairs})` });
      continue;
    }
    palettes.push(palette);
  }

  const productStems = new Set([...stems, ...product.keywords.flatMap((phrase) => [...wordStems(phrase)])]);
  return {
    productType: product.type,
    matchedBy: matched ? "keywords" : "idea_kind",
    palettes,
    typePairs: typePairCandidates(product.type, productStems),
    landingPattern: landingPatternFor(product, excluded),
    excluded,
  };
}
