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

/** A number not glued to a word before it ("B2B", "Web3" are not numbers). */
const NUM = String.raw`(?<![\p{L}\p{N}])\d[\d,.]*`;
/** A count big enough to be a market or traction figure: 100+, 1,000, 5k, 2.5m. */
const BIG_COUNT = String.raw`(?<![\p{L}\p{N}])(?:\d{1,3}(?:,\d{3})+|\d{3,}|\d+(?:\.\d+)?\s?(?:k|m|b|thousand))`;
const AUDIENCE = String.raw`(?:users?|customers?|people|downloads?|installs?|subscribers?|visitors?|searches|buyers?|shoppers?|consumers?|businesses|companies|households?|sign-?ups?|members?)`;

/**
 * What counts as a market claim: prices and money, percentages, market-size
 * magnitudes, audience or traction counts, per-period prices, and market or
 * keyword metrics. Small counts ("3 features", "in 5 minutes") are not claims.
 */
const MARKET_CLAIM_PATTERNS: readonly RegExp[] = Object.freeze([
  // Money: "$5", "€ 10", "£2.99", "¥300", "₹99".
  new RegExp(String.raw`[$€£¥₹]\s?\d`, "u"),
  // Money in words or codes: "5 USD", "20 dollars".
  new RegExp(String.raw`${NUM}\s?(?:usd|eur|gbp|dollars?|euros?|pounds?|bucks)\b`, "iu"),
  // Percentages: "30%", "12 percent".
  new RegExp(String.raw`${NUM}\s?(?:%|percent\b|per\s?cent\b)`, "iu"),
  // Market-size magnitudes in any form: "millions of", "a billion-dollar", "5bn".
  /(?<![\p{L}])(?:millions?|billions?|trillions?|bn)(?![\p{L}])/iu,
  // Audience and traction counts: "10,000 users", "5k active customers".
  new RegExp(String.raw`${BIG_COUNT}\+?\s+(?:[\p{L}-]+\s+)?${AUDIENCE}\b`, "iu"),
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

/** The interim candidate: the founder's words as the pitch, plus a generic weekend outline. */
export function fixtureOwnIdeaOutline(ideaText: string): LightBlueprint {
  return {
    pitch: truncateText(ideaText.trim(), LIMITS.blueprint.pitch),
    oneUser: OUTLINE_USER,
    oneLoop: OUTLINE_LOOP,
    features: [...OUTLINE_FEATURES],
    scopeCuts: [...OUTLINE_SCOPE_CUTS],
  };
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
  const result = acceptLightBlueprint(drafted ? draft : fixtureOwnIdeaOutline(ideaText));
  if (!result.ok) return { blueprint: fallbackOwnIdeaOutline(), origin: "own_fallback", removedClaims: 0 };
  return {
    blueprint: result.blueprint,
    origin: drafted ? "own_drafted" : "own_fixture",
    removedClaims: result.removedClaims,
  };
}
