/**
 * WP100. Structured hints about a founder's own idea: who it is for, the one
 * thing they do with it, and what the founder offers. One shape, defined once,
 * shared by the Step 1 improve call (`wizard-idea-improve`) and the planned
 * own-idea blueprint enrichment (`docs/design/wizard-idea-ai-improve.md` §3),
 * so the idea is read once and the extraction is paid for once.
 *
 * Hints are descriptions of the founder's own words, never market facts
 * (D15): `cleanOwnIdeaHints` drops any hint with a market claim, and a hint
 * that fails is null rather than an error, so a bad hint never blocks a good
 * sentence.
 *
 * Pure. Imports carry `.ts` extensions so prompt modules can import this file
 * under `node --experimental-strip-types` (the prompt version check).
 */

import { z } from "zod";

import { hasMarketClaim } from "../contracts/marketClaims.ts";

export const OWN_IDEA_HINT_LIMITS = {
  audience: 60,
  coreAction: 80,
  offer: 80,
} as const;

/** The model-facing shape: each hint is a short phrase or null. */
export const ownIdeaHintsSchema = z
  .object({
    audience: z.string().max(OWN_IDEA_HINT_LIMITS.audience).nullable(),
    coreAction: z.string().max(OWN_IDEA_HINT_LIMITS.coreAction).nullable(),
    offer: z.string().max(OWN_IDEA_HINT_LIMITS.offer).nullable(),
  })
  .strict();

export type OwnIdeaHints = z.infer<typeof ownIdeaHintsSchema>;

export const EMPTY_OWN_IDEA_HINTS: OwnIdeaHints = Object.freeze({ audience: null, coreAction: null, offer: null });

const INVISIBLE = /[\p{Cc}\p{Cf}\u2028\u2029]/u;

function cleanHint(value: string | null, max: number): string | null {
  if (value === null) return null;
  const text = value.replace(/\s+/gu, " ").trim().replace(/[.!?]+$/u, "");
  if (text.length < 2 || text.length > max) return null;
  if (INVISIBLE.test(text) || /[<>]/u.test(text)) return null;
  if (hasMarketClaim(text)) return null;
  return text;
}

/** Each hint trimmed and checked; a hint that fails becomes null. */
export function cleanOwnIdeaHints(raw: OwnIdeaHints): OwnIdeaHints {
  return {
    audience: cleanHint(raw.audience, OWN_IDEA_HINT_LIMITS.audience),
    coreAction: cleanHint(raw.coreAction, OWN_IDEA_HINT_LIMITS.coreAction),
    offer: cleanHint(raw.offer, OWN_IDEA_HINT_LIMITS.offer),
  };
}

/** True when no hint survived (nothing worth storing). */
export function hintsAreEmpty(hints: OwnIdeaHints): boolean {
  return hints.audience === null && hints.coreAction === null && hints.offer === null;
}
