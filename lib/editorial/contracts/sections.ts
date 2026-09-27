/**
 * The eight public idea-page headings, in required order. Titles mirror
 * `scripts/lib/idea-sections.mjs` (seven body sections plus `Sources`);
 * `tests/editorial/contracts/taxonomy-drift.test.ts` pins the match.
 */
export const SECTION_DEFINITIONS = [
  { key: "problem", title: "The Problem" },
  { key: "solution", title: "The Solution" },
  { key: "market", title: "Market Research" },
  { key: "competition", title: "Competitive Landscape" },
  { key: "business-model", title: "Business Model" },
  { key: "tech-stack", title: "Recommended Tech Stack" },
  { key: "prompts", title: "AI Prompts to Build This" },
  { key: "sources", title: "Sources" },
] as const;

export type SectionKey = (typeof SECTION_DEFINITIONS)[number]["key"];

export const SECTION_KEYS = SECTION_DEFINITIONS.map(
  (section) => section.key,
) as readonly SectionKey[];

export function sectionTitle(key: SectionKey): string {
  const found = SECTION_DEFINITIONS.find((section) => section.key === key);
  return found ? found.title : key;
}

export function sectionKeyForTitle(title: string): SectionKey | null {
  const trimmed = title.trim();
  const found = SECTION_DEFINITIONS.find((section) => section.title === trimmed);
  return found ? found.key : null;
}

/** `**How it works:**` feeds the public HowTo JSON-LD and must stay intact. */
export const HOW_IT_WORKS_LABEL = "**How it works:**";
