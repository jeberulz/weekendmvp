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
import { hasMarketClaim, stripMarketClaims } from "../contracts/marketClaims";
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
// Market claims (WP90-S2: the check lives in `contracts/marketClaims.ts`)
// ---------------------------------------------------------------------------

export { hasMarketClaim, stripMarketClaims, type StrippedText } from "../contracts/marketClaims";
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
