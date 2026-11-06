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
 *   the reverse), and a library blueprint's `ideaSlug` is code-owned: it is
 *   set to the business's idea whatever the model wrote, then the artifact is
 *   parsed again with its C-ART schema.
 * - Hard issues fail the step closed (S4b's one repair is not built: Owner
 *   Q6/Q7 are open). Soft issues never block.
 *
 * Gated kinds are the S3a steps (blueprint, brand kit). Later generators add
 * their kind here with the context their checks need (a landing spec needs
 * the brand kit).
 */

import { parseArtifact, type ArtifactByKind, type ArtifactKind } from "../contracts/artifacts";
import { checkArtifact, issue, toResult, type CheckResult } from "./checks";

export const QUALITY_GATED_KINDS = ["blueprint", "brand_kit"] as const satisfies readonly ArtifactKind[];
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
};

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
  const reparsed = parseArtifact("blueprint", { ...blueprint, ideaSlug: context.ideaSlug });
  if (!reparsed.success) {
    return { result: blocked("blueprint_idea_invalid", ["ideaSlug"], "The business's idea slug is not a valid blueprint slug.") };
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
  }
  // The exemption for "{brandName} costs $79" or "founder of {brandName}" uses
  // the server's name, so a model-written name can never widen it.
  const brandName = context.businessName;
  const result = checkArtifact(kind, subject, { ownIdea: context.ownIdea, ...(brandName === undefined ? {} : { brandName }) });
  return { artifact: result.hard.length > 0 ? null : subject, result };
}

/** Distinct issue codes, hard first, for a step result or a log line (never messages: they may quote model text). */
export function issueCodes(issues: CheckResult["hard"]): string[] {
  return [...new Set(issues.map((found) => found.code))];
}
