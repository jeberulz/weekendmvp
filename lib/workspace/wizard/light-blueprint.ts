/**
 * WP74-S3 (interim, Option D). The own-idea light blueprint (D15).
 *
 * An own idea gets a light blueprint labelled "Not yet validated", with no
 * market numbers, competitor prices or keyword data. This file enforces that
 * in code, whatever produced the outline:
 * - now: the deterministic fixture outline built from the founder's words;
 * - later (Option A, awaiting the owner's ruling): one drafting call through
 *   the gateway. Its output goes through `acceptLightBlueprint` unchanged.
 *
 * `acceptLightBlueprint` validates a candidate against the light subset of the
 * C-ART own-idea `Blueprint` (pitch, one user, one loop, features, scope cuts;
 * no `profile`, no `market`), strips every clause that carries a market claim,
 * and re-validates. A candidate that is invalid, or that has nothing left once
 * the claims are gone, is rejected, and `ownIdeaBlueprintPreview` shows the
 * honest fallback outline instead, so the founder can always continue.
 *
 * Pure: no Convex or React imports, relative imports only (the Convex bundler
 * loads this file).
 */
import { z } from "zod";

import { LIMITS, blueprintVariantSchemas } from "../contracts/artifacts";
import { truncateText } from "./labels";

/** The label every own-idea blueprint carries (D15). */
export const NOT_VALIDATED_LABEL = "Not yet validated";

/** What the label means in words, beside it wherever it shows. */
export const NOT_VALIDATED_MEANING =
  "This outline comes from your words only. Nobody has researched the market for it yet, so it has no market numbers, prices or keyword data.";

/**
 * The light subset of the C-ART own-idea `Blueprint`. Same field limits;
 * `profile` and `schemaVersion` are left out because the wizard preview does
 * not use them, and an own idea never has `market`.
 */
export const lightBlueprintSchema = blueprintVariantSchemas.own_idea
  .pick({ pitch: true, oneUser: true, oneLoop: true, features: true, scopeCuts: true })
  .strict();
export type LightBlueprint = z.infer<typeof lightBlueprintSchema>;

// ---------------------------------------------------------------------------
// Market claims
// ---------------------------------------------------------------------------

/** A number not glued to a word before it ("B2B", "Web3", "v2" are not numbers). */
const NUM = String.raw`(?<![\p{L}\p{N}.,])\d[\d,.]*`;
/** A count of 100 or more ("250", "10,000", "50000") that is not a bare year (2025 is a date). */
const BIG_NUM = String.raw`(?<![\p{L}\p{N}.,])(?!(?:19|20)\d{2}(?![\d,.]))(?:\d{1,3}(?:,\d{3})+|\d{3,})(?:\.\d+)?(?![\d,])`;
/** Units of time and measure: "100 days", "10,000 steps" describe the product, not a market. */
const UNITS = String.raw`(?:ms|seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|nights?|weeks?|months?|years?|yrs?|km|kms|kilometres?|kilometers?|miles?|metres?|meters?|kg|lbs?|calories|kcal|steps|reps|words|pages|pixels|px|mb|gb|tb|times)`;
/** Words that follow a race distance or a plan, not a counted noun ("Couch to 5k for beginners"). */
const FUNCTION_WORDS = String.raw`(?:for|to|in|on|at|of|with|and|or|a|an|the|run|runs|race|races|training|plan|plans|walk)`;
/** Currency codes. */
const CODES = String.raw`(?:usd|eur|gbp|cad|aud|nzd|inr|jpy|chf|sek|nok|dkk)`;
/** A following word that is a counted noun: any word except units and function words. */
const COUNTED_NOUN = String.raw`(?!(?:${UNITS}|${FUNCTION_WORDS})(?![\p{L}-]))[\p{L}][\p{L}-]*`;

/**
 * What counts as a market claim (D15: an own idea asserts no market numbers).
 *
 * Claims: money (symbols or codes, before or after the number), per-period
 * prices, percentages, market-size magnitudes (million/billion and a bare
 * M/B/bn after a number), revenue metrics with a number (MRR, ARR, GMV,
 * revenue, turnover), ratios ("1 in 5", "4 out of 5"), and traction counts: a
 * count of 100 or more, or a k-magnitude, followed by any noun ("500 waitlist
 * sign ups", "10k dentists"). Plus market and keyword metric words.
 *
 * Not claims: counts under 100 with a noun ("3 steps", "2 founders", "Top 10
 * tips"), numbers glued to letters ("B2B", "Web 3" stays, "v2"), "24/7",
 * years, counts of time or measure units ("100 days", "10,000 steps"), and a
 * k-distance followed by a function word ("Couch to 5k for beginners").
 * Known trade-off: "100 m sprint" reads as a magnitude and is stripped.
 */
const MARKET_CLAIM_PATTERNS: readonly RegExp[] = Object.freeze([
  // Money, symbol first: "$5", "€ 10", "£2.99", "¥300", "₹99".
  new RegExp(String.raw`[$€£¥₹]\s?\d`, "u"),
  // Money, symbol after: "49€", "49 €/month".
  new RegExp(String.raw`${NUM}\s?[$€£¥₹]`, "u"),
  // Money, code first: "USD 49", "eur10".
  new RegExp(String.raw`(?<![\p{L}])${CODES}\s?\d`, "iu"),
  // Money, code or word after: "5 USD", "20 dollars".
  new RegExp(String.raw`${NUM}\s?(?:${CODES}|dollars?|euros?|pounds?|bucks)(?![\p{L}])`, "iu"),
  // Percentages: "30%", "12 percent".
  new RegExp(String.raw`${NUM}\s?(?:%|percent\b|per\s?cent\b)`, "iu"),
  // Market-size words in any form: "millions of", "a billion-dollar".
  /(?<![\p{L}])(?:millions?|billions?|trillions?)(?![\p{L}])/iu,
  // A bare M/B magnitude after a number: "2.3B market", "reach 1M", "4bn", "2m".
  new RegExp(String.raw`${NUM}\s?(?:mm|m|b|bn|tn)(?![\p{L}\p{N}])`, "iu"),
  // Revenue metrics with a number: "5k MRR", "ARR of 2m", "revenue of $3".
  new RegExp(String.raw`${NUM}\s?(?:k|m|b|bn)?\s+(?:mrr|arr|gmv|revenue|turnover)(?![\p{L}])`, "iu"),
  new RegExp(String.raw`(?<![\p{L}])(?:mrr|arr|gmv|revenue|turnover)\s+(?:(?:of|at|is|hit|hits|reached|reaches|over|near)\s+)?[$€£¥₹]?\s?\d`, "iu"),
  // Ratios: "1 in 5 people", "4 out of 5" (not "step 2 in 3 minutes").
  new RegExp(String.raw`${NUM}\s+(?:in|out\s+of)\s+\d[\d,.]*(?!\s*${UNITS}(?![\p{L}]))`, "iu"),
  // Traction counts: 100+ or a k-magnitude, then any counted noun.
  new RegExp(
    String.raw`(?:${BIG_NUM}|${NUM}\s?(?:k|thousand))\+?\s+${COUNTED_NOUN}`,
    "iu",
  ),
  // Per-period or per-seat prices: "9/month", "12 per seat", "5 a year".
  new RegExp(String.raw`${NUM}\s?(?:\/\s?|per\s+|a\s+)(?:month|mo|year|yr|seat|user)\b`, "iu"),
  // Market and keyword metrics, in words.
  /\b(?:market\s+size|market\s+share|search\s+volume|keyword\s+volume|monthly\s+searches|cost\s+per\s+click)\b/iu,
  // Market-sizing acronyms. Case-sensitive, so "Sam" and "som" stay words.
  /\b(?:TAM|SAM|SOM|CAGR|CPC)\b/u,
]);

/** True when the text carries a market number, a price or keyword data. */
export function hasMarketClaim(text: string): boolean {
  return MARKET_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

export type StrippedText = {
  /** The text with every clause that carried a claim removed (may be empty). */
  readonly text: string;
  /** How many clauses were removed. */
  readonly removed: number;
};

/**
 * Removes every clause (comma, semicolon or dash separated, within a sentence)
 * that carries a market claim. Clauses without one keep the founder's words.
 */
export function stripMarketClaims(text: string): StrippedText {
  const sentences = text.trim().split(/(?<=[.!?])\s+/u);
  const kept: string[] = [];
  let removed = 0;
  for (const sentence of sentences) {
    if (!hasMarketClaim(sentence)) {
      if (sentence.length > 0) kept.push(sentence);
      continue;
    }
    const clauses = sentence.split(/,\s+|;\s+|\s+[–—-]\s+/u);
    const clean = clauses.filter((clause) => !hasMarketClaim(clause));
    removed += clauses.length - clean.length;
    let joined = clean.join(", ").trim().replace(/[,;:\s]+$/u, "");
    if (joined.length === 0) continue;
    const end = sentence.trimEnd().slice(-1);
    if (/[.!?]/u.test(end) && !/[.!?]$/u.test(joined)) joined += end;
    // A sentence that did not start lower-case still starts with a capital.
    if (!/^\p{Ll}/u.test(sentence)) joined = joined.charAt(0).toUpperCase() + joined.slice(1);
    kept.push(joined);
  }
  return { text: kept.join(" ").trim(), removed };
}

// ---------------------------------------------------------------------------
// Accepting a candidate (fixture now, gateway output later)
// ---------------------------------------------------------------------------

export type LightBlueprintResult =
  | { readonly ok: true; readonly blueprint: LightBlueprint; readonly removedClaims: number }
  | { readonly ok: false; readonly reason: "invalid" | "only_market_claims" };

/**
 * Validates a candidate light blueprint, strips market claims from every
 * field, and re-validates. List items that carry a claim are dropped whole.
 * Rejects (never repairs) a candidate that is not a light blueprint, or one
 * whose required fields are empty once the claims are gone.
 */
export function acceptLightBlueprint(candidate: unknown): LightBlueprintResult {
  const parsed = lightBlueprintSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const value = parsed.data;
  let removedClaims = 0;
  const text = (input: string): string => {
    const stripped = stripMarketClaims(input);
    removedClaims += stripped.removed;
    return stripped.text;
  };
  const items = (list: readonly string[]): string[] =>
    list.filter((item) => {
      if (!hasMarketClaim(item)) return true;
      removedClaims += 1;
      return false;
    });
  const cleaned = {
    pitch: text(value.pitch),
    oneUser: text(value.oneUser),
    oneLoop: text(value.oneLoop),
    features: items(value.features),
    scopeCuts: items(value.scopeCuts),
  };
  const checked = lightBlueprintSchema.safeParse(cleaned);
  if (!checked.success) return { ok: false, reason: removedClaims > 0 ? "only_market_claims" : "invalid" };
  return { ok: true, blueprint: checked.data, removedClaims };
}

// ---------------------------------------------------------------------------
// Outlines
// ---------------------------------------------------------------------------

const OUTLINE_USER = "The one person who feels this problem most.";
const OUTLINE_LOOP = "They arrive, do the one core thing, and come back next time they need it.";
const OUTLINE_FEATURES = [
  "Sign up and get started in one step",
  "The one core action, done in under a minute",
  "A simple record of what you did",
] as const;
const OUTLINE_SCOPE_CUTS = ["No payments this weekend", "No team accounts"] as const;

/**
 * The fixture candidate and how many claim clauses its pitch lost. Claims are
 * stripped from the whole idea before the pitch is cut to length: cutting
 * first could split "10,000 users" into "10,0…" and leave the claim unseen.
 */
function fixtureCandidate(ideaText: string): { candidate: LightBlueprint; removed: number } {
  const stripped = stripMarketClaims(ideaText);
  return {
    candidate: {
      pitch: truncateText(stripped.text, LIMITS.blueprint.pitch),
      oneUser: OUTLINE_USER,
      oneLoop: OUTLINE_LOOP,
      features: [...OUTLINE_FEATURES],
      scopeCuts: [...OUTLINE_SCOPE_CUTS],
    },
    removed: stripped.removed,
  };
}

/**
 * The interim candidate: the founder's words, with market claims stripped and
 * then cut to the pitch length, plus a generic weekend outline.
 */
export function fixtureOwnIdeaOutline(ideaText: string): LightBlueprint {
  return fixtureCandidate(ideaText).candidate;
}

/**
 * The honest fallback: a plain starting outline that claims nothing about the
 * idea. Shown when no usable draft exists, so the founder can still continue.
 */
export function fallbackOwnIdeaOutline(): LightBlueprint {
  return {
    pitch: "A plain starting outline for your idea.",
    oneUser: OUTLINE_USER,
    oneLoop: OUTLINE_LOOP,
    features: [...OUTLINE_FEATURES],
    scopeCuts: [...OUTLINE_SCOPE_CUTS],
  };
}

/** Where an own idea's preview came from. */
export type OwnIdeaOutlineOrigin = "own_fixture" | "own_drafted" | "own_fallback";

export type OwnIdeaPreview = {
  readonly blueprint: LightBlueprint;
  readonly origin: OwnIdeaOutlineOrigin;
  /** Market-claim clauses or items removed from what was shown. */
  readonly removedClaims: number;
};

/**
 * The own-idea preview. `draft` is the stored gateway output once Option A
 * lands; until then callers pass nothing and get the fixture outline. Either
 * way the candidate goes through `acceptLightBlueprint`, and a rejected one
 * becomes the fallback outline.
 */
export function ownIdeaBlueprintPreview(ideaText: string, draft?: unknown): OwnIdeaPreview {
  const drafted = draft !== undefined;
  const fixture = drafted ? undefined : fixtureCandidate(ideaText);
  const result = acceptLightBlueprint(fixture ? fixture.candidate : draft);
  if (!result.ok) return { blueprint: fallbackOwnIdeaOutline(), origin: "own_fallback", removedClaims: 0 };
  return {
    blueprint: result.blueprint,
    origin: drafted ? "own_drafted" : "own_fixture",
    removedClaims: result.removedClaims + (fixture?.removed ?? 0),
  };
}
