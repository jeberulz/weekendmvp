/**
 * WP99. The example ideas under the own-idea field on `/start/own` ("Try one of
 * these"). Recommendation: `docs/design/wizard-step1-own-idea-suggestions.md`.
 *
 * The chips are real, published library ideas, drawn three per visit from the
 * live library, so they cost nothing and change on every visit. A tap fills
 * the field, and a chip that carries a slug lets the founder switch to the
 * researched version (`/start/{slug}`) instead.
 *
 * Pure: no Convex, React or Next imports. The cached library read lives in
 * `own-idea-examples.server.ts`.
 */
import type { ManifestIdea } from "../../home/types";
import { isBuildCtaSlug } from "../build-cta";
import { hasMarketClaim } from "../contracts/marketClaims";

/** One chip: the line it shows, and the library idea it came from (null for a fallback line). */
export type OwnIdeaExample = {
  readonly text: string;
  readonly ideaSlug: string | null;
};

/** Longest chip, so a pill never wraps badly at phone width. */
export const OWN_IDEA_EXAMPLE_MAX = 60;

/** Chips shown per visit. */
export const OWN_IDEA_EXAMPLE_COUNT = 3;

/**
 * Last resort only: used when the library cannot fill the chips (an empty or
 * unreadable pool). They carry no slug, so they never offer a researched version.
 */
export const OWN_IDEA_FALLBACK_EXAMPLES: readonly OwnIdeaExample[] = [
  { text: "A packing list that builds itself from your trip", ideaSlug: null },
  { text: "Invoice reminders for freelancers", ideaSlug: null },
  { text: "A meal-prep planner for lifters", ideaSlug: null },
];

/** The headline part of a title, cut at the first ": " or dash, as the homepage's `shortTitle` does. */
function headline(title: string): string {
  return title.split(/\s*[:—–]\s+/)[0].replace(/\s+/g, " ").trim();
}

function textKey(text: string): string {
  return text.toLowerCase();
}

/**
 * Every library idea that can be a chip: live (not retired, not an engine
 * draft), startable in the wizard (`isBuildCtaSlug`), with a headline of 1–60
 * characters, a single line, and no market claim. Deduplicated by slug and by
 * text. `ideas` must already be the public library (manifest merged with
 * editorial releases), so a withdrawn idea never appears.
 */
export function ownIdeaExamplePool(ideas: readonly ManifestIdea[]): OwnIdeaExample[] {
  const pool: OwnIdeaExample[] = [];
  const slugs = new Set<string>();
  const texts = new Set<string>();
  for (const idea of ideas) {
    // `isBuildCtaSlug` also refuses engine drafts.
    if (idea._retiredAt || !isBuildCtaSlug(idea.slug)) continue;
    if (typeof idea.title !== "string") continue;
    const text = headline(idea.title);
    if (text.length === 0 || text.length > OWN_IDEA_EXAMPLE_MAX) continue;
    if (/[\p{Cc}\u2028\u2029]/u.test(text) || hasMarketClaim(text)) continue;
    if (slugs.has(idea.slug) || texts.has(textKey(text))) continue;
    slugs.add(idea.slug);
    texts.add(textKey(text));
    pool.push({ text, ideaSlug: idea.slug });
  }
  return pool;
}

/**
 * Draws `count` distinct chips from `pool` (a partial Fisher–Yates shuffle on
 * a copy), then pads from the fallback list if the pool is short, never
 * repeating a line. `random` returns [0, 1), like `Math.random`.
 */
export function drawOwnIdeaExamples(
  pool: readonly OwnIdeaExample[],
  random: () => number = Math.random,
  count: number = OWN_IDEA_EXAMPLE_COUNT,
): OwnIdeaExample[] {
  const deck = [...pool];
  const picked: OwnIdeaExample[] = [];
  const texts = new Set<string>();
  while (picked.length < count && deck.length > 0) {
    const index = Math.min(deck.length - 1, Math.floor(random() * deck.length));
    const [card] = deck.splice(index, 1);
    if (!card || texts.has(textKey(card.text))) continue;
    texts.add(textKey(card.text));
    picked.push(card);
  }
  for (const fallback of OWN_IDEA_FALLBACK_EXAMPLES) {
    if (picked.length >= count) break;
    if (texts.has(textKey(fallback.text))) continue;
    texts.add(textKey(fallback.text));
    picked.push(fallback);
  }
  return picked;
}
