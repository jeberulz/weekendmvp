/**
 * WP75-S3a — the quality gate a crew step's parsed artifact passes before it
 * is stored. Pure: no Convex, no I/O, no model call; relative imports only
 * (the Convex bundler loads this file).
 *
 * - Runs S4a's `checkArtifact` with the business's context: `ownIdea` from the
 *   project's source, and `brandName` from the founder's chosen business name
 *   (a server fact, never the model's output).
 * - Adds the facts only the server knows. A blueprint's `source` must match
 *   the business (a library business never stores an own-idea blueprint, and
 *   the reverse). Code-owned fields are set whatever the model wrote, then the
 *   artifact is parsed again with its C-ART schema:
 *   - a library blueprint's `ideaSlug` is the business's idea;
 *   - a library blueprint's `market` is the idea seed's (Weekend MVP
 *     research), or left out when the seed has none. S4a skips the market
 *     subtree as research, so model-written market text is never stored
 *     (S3a review M1);
 *   - a brand kit's `name` is the name the founder chose.
 * - Hard issues fail the step closed (S4b's one repair is not built: Owner
 *   Q6/Q7 are open). Soft issues never block.
 *
 * Gated kinds are the S3a steps (blueprint, brand kit) and WP76-S1a's email
 * sequence, which adds a HARD no-links check over every field a reader sees
 * (`checks/emailLinks.ts`; C-ART refuses URLs only in bodies). Later
 * generators add their kind here with the context their checks need (a
 * landing spec needs the brand kit).
 */

import type { z } from "zod";

import { blueprintMarketSchema, parseArtifact, type ArtifactByKind, type ArtifactKind } from "../contracts/artifacts";
import { checkArtifact, issue, mergeResults, toResult, type CheckResult } from "./checks";
import { checkEmailSequenceLinks } from "./checks/emailLinks";

export const QUALITY_GATED_KINDS = ["blueprint", "brand_kit", "email_sequence"] as const satisfies readonly ArtifactKind[];
export type QualityGatedKind = (typeof QUALITY_GATED_KINDS)[number];

export function isQualityGatedKind(kind: string): kind is QualityGatedKind {
  return (QUALITY_GATED_KINDS as readonly string[]).includes(kind);
}

/** What the server knows about the business, read from the project row. */
export type QualityContext = {
  /** The project's source is `own_idea` (D15). */
  readonly ownIdea: boolean;
  /** A library business's idea slug (`projects.workspace.ideaSlug`). */
  readonly ideaSlug?: string;
  /** The name the founder chose (`projects.workspace.name`). */
  readonly businessName?: string;
  /** A library business's market from its idea seed; absent when the seed has none (or there is no seed). */
  readonly seedMarket?: BlueprintMarket;
};

export type BlueprintMarket = z.infer<typeof blueprintMarketSchema>;

export type QualityGateResult<K extends ArtifactKind> = {
  /** The artifact to store: parsed again after any code-owned field was set. Null when it cannot be stored. */
  readonly artifact: ArtifactByKind[K] | null;
  readonly result: CheckResult;
};

const blocked = (code: string, path: (string | number)[], message: string): CheckResult => toResult([issue("hard", code, path, message)]);

/** The blueprint with the server's facts applied, or the hard issue that stops it. */
function normaliseBlueprint(
  blueprint: ArtifactByKind["blueprint"],
  context: QualityContext,
): { artifact: ArtifactByKind["blueprint"] } | { result: CheckResult } {
  const expected = context.ownIdea ? "own_idea" : "library";
  if (blueprint.source !== expected) {
    return { result: blocked("blueprint_source_mismatch", ["source"], `This business needs a ${expected} blueprint.`) };
  }
  if (blueprint.source === "own_idea") return { artifact: blueprint };
  if (context.ideaSlug === undefined) {
    return { result: blocked("blueprint_idea_missing", ["ideaSlug"], "The business has no library idea to attach the blueprint to.") };
  }
  const owned: Record<string, unknown> = { ...blueprint, ideaSlug: context.ideaSlug };
  delete owned.market;
  if (context.seedMarket !== undefined) owned.market = context.seedMarket;
  const reparsed = parseArtifact("blueprint", owned);
  if (!reparsed.success) {
    return { result: blocked("blueprint_idea_invalid", ["ideaSlug"], "The business's idea slug or seed market is not valid for a blueprint.") };
  }
  return { artifact: reparsed.data };
}

/** The brand kit with the founder's chosen name, or the hard issue that stops it. */
function normaliseBrandKit(
  kit: ArtifactByKind["brand_kit"],
  context: QualityContext,
): { artifact: ArtifactByKind["brand_kit"] } | { result: CheckResult } {
  if (context.businessName === undefined || kit.name === context.businessName) return { artifact: kit };
  const reparsed = parseArtifact("brand_kit", { ...kit, name: context.businessName });
  if (!reparsed.success) {
    return { result: blocked("brand_name_invalid", ["name"], "The business's name is not valid for a brand kit.") };
  }
  return { artifact: reparsed.data };
}

/**
 * Gates one parsed artifact. A kind outside `QUALITY_GATED_KINDS` passes
 * unchanged with no issues (its generator story adds it).
 */
export function gateCrewArtifact<K extends ArtifactKind>(
  kind: K,
  artifact: ArtifactByKind[K],
  context: QualityContext,
): QualityGateResult<K> {
  if (!isQualityGatedKind(kind)) return { artifact, result: { hard: [], soft: [] } };
  let subject: ArtifactByKind[K] = artifact;
  if (kind === "blueprint") {
    const normalised = normaliseBlueprint(artifact as ArtifactByKind["blueprint"], context);
    if ("result" in normalised) return { artifact: null, result: normalised.result };
    subject = normalised.artifact as ArtifactByKind[K];
  } else if (kind === "brand_kit") {
    const normalised = normaliseBrandKit(artifact as ArtifactByKind["brand_kit"], context);
    if ("result" in normalised) return { artifact: null, result: normalised.result };
    subject = normalised.artifact as ArtifactByKind[K];
  }
  // The exemption for "{brandName} costs $79" or "founder of {brandName}" uses
  // the server's name, so a model-written name can never widen it.
  const brandName = context.businessName;
  const checked = checkArtifact(kind, subject, { ownIdea: context.ownIdea, ...(brandName === undefined ? {} : { brandName }) });
  const result = kind === "email_sequence"
    ? mergeResults(checked, toResult(checkEmailSequenceLinks(subject as ArtifactByKind["email_sequence"])))
    : checked;
  return { artifact: result.hard.length > 0 ? null : subject, result };
}

/** Distinct issue codes, hard first, for a step result or a log line (never messages: they may quote model text). */
export function issueCodes(issues: CheckResult["hard"]): string[] {
  return [...new Set(issues.map((found) => found.code))];
}
