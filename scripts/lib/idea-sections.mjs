/**
 * Shared idea-section contract for MDX under content/ideas/.
 *
 * Used by scripts/audit-idea-mdx.mjs (exact H2 titles) and
 * scripts/extract-idea-bodies.mjs (HTML h2 fuzzy match). Keep both in sync.
 */

/** Canonical MDX H2 titles in required order (seven body sections). */
export const CANONICAL_SECTION_TITLES = [
  "The Problem",
  "The Solution",
  "Market Research",
  "Competitive Landscape",
  "Business Model",
  "Recommended Tech Stack",
  "AI Prompts to Build This",
];

/** Required eighth heading after the seven body sections. */
export const SOURCES_TITLE = "Sources";

/**
 * Fuzzy matchers for HTML extraction (legacy ideas/*.html → MDX).
 * Keys align with CANONICAL_SECTION_TITLES order.
 */
export const REQUIRED_SECTIONS = [
  { key: "problem", match: /\bproblem\b/i },
  { key: "solution", match: /\bsolution\b/i },
  {
    key: "market",
    match: /market\s*(research|insight|size|opportunity)/i,
  },
  { key: "competitive", match: /competit(or|ive|ors)/i },
  {
    key: "business",
    match: /(business\s*model|monetization|pricing|revenue)/i,
  },
  {
    key: "stack",
    match: /(tech\s*stack|recommended\s*stack|technology\s*stack)/i,
  },
  { key: "prompts", match: /(ai\s*prompts|prompts\s*to\s*build)/i },
];

export const OPTIONAL_SECTIONS = [
  { key: "sources", match: /^\s*sources\s*$/i },
];

/** How-it-works label required under ## The Solution (feeds HowTo JSON-LD). */
export const HOW_IT_WORKS_LABEL = "**How it works:**";

export const MIN_BODY_WORDS = 800;
export const MIN_SOURCE_LINKS = 2;
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
