/**
 * WP75-S4a: deterministic quality and "never fake it" checks.
 *
 * Pure TypeScript, no Convex, no model call, no I/O. Run after each
 * generation (S3a-S3d), before the one `quality@1` call and the one repair
 * (S4b). WP76 reuses the same checks for its generators through
 * `checkArtifact`.
 *
 *   const result = checkArtifact("landing_spec", spec, { ownIdea, brandKit });
 *   if (hasHardIssues(result)) repairInput = toRepairIssues(result);
 *
 * `{ hard, soft }`: hard issues trigger the repair; soft ones ride along when
 * a repair happens and are otherwise shown, never blocking.
 *
 * Callers (the S3 generators, S4b and WP76) go through `checkArtifact`. It
 * runs the shape guard and the bounded-walk guard first, so malformed,
 * cyclic, too-deep or too-wide input returns a hard `invalid_shape` issue.
 * The single checks exported below assume input that already passed
 * `checkArtifact`'s guards (or its C-ART schema): run on their own over input
 * past `WALK_MAX_DEPTH` / `WALK_MAX_NODES`, they look only at the part they
 * reach and say nothing about the rest. They are exported for tests and for
 * composing, not as a cheaper entry point.
 */
import type { ArtifactByKind, ArtifactKind, BrandKit } from "../../contracts/artifacts";
import { checkBrandKit } from "./brandKit";
import { checkLandingLayouts, checkLandingSpec, checkAltText } from "./landing";
import { MARKET_CHECKED_KINDS, checkMarketNumbers } from "./marketNumbers";
import { checkNeverFake } from "./neverFake";
import { checkBuildPackStandard, type BuildPackStandardOptions } from "./promptStandard";
import { checkSlop } from "./slop";
import { checkShape, isReadableBrandKit } from "./shape";
import { issue, toResult, type CheckIssue, type CheckResult, type IssuePath } from "./types";

export * from "./types";
export { WALK_MAX_DEPTH, WALK_MAX_NODES, normalizeText, stringLeaves, stripPlaceholders } from "./walk";
export { checkNeverFake, neverFakeMatches, type NeverFakeHit, type NeverFakeOptions } from "./neverFake";
export { checkMarketNumbers, carriesMarketNumber, marketClaim, MARKET_CHECKED_KINDS, type MarketOptions } from "./marketNumbers";
export { checkShape, isReadableBrandKit } from "./shape";
export { checkSlop, isTriad } from "./slop";
export {
  DISPLAY_TARGETS,
  checkAltText,
  checkHeadingLengths,
  checkLandingLayouts,
  checkLandingSpec,
  checkNoEmoji,
  checkNoEyebrow,
  checkProofSlots,
} from "./landing";
export { checkBrandContrast, checkBrandKit, checkThemeMode, checkTypePairDirection } from "./brandKit";
export {
  DEFAULT_BILLING,
  DEFAULT_SETUP_PROMPT_NUMBERS,
  PROMPT_STANDARD_VERSION,
  checkBuildPackStandard,
  checkBuildPrompt,
  defaultBuildPackStandard,
  type BillingByKind,
  type BillingSeverity,
  type BuildPackStandardOptions,
  type PromptRole,
  type PromptStandardOptions,
} from "./promptStandard";

export type CheckContext = {
  /**
   * The idea is the founder's own (D15: no market data). Required, so a caller
   * cannot forget it. A blueprint reads its own `source` instead.
   */
  readonly ownIdea: boolean;
  /** The brand kit a landing spec is judged against (layouts per direction). */
  readonly brandKit?: BrandKit;
  /**
   * The business's own name. A quote from "the founder of {brandName}" is
   * soft (the founder's words); without it, a quote from the founder or owner
   * of any named business stays a hard testimonial. In an own idea,
   * "{brandName} costs $79" is the business's price, not a competitor's.
   */
  readonly brandName?: string;
  /** How standard v1 applies to a build pack (open owner rulings, see `promptStandard.ts`). */
  readonly buildPackStandard?: BuildPackStandardOptions;
};

const isMarketChecked = (kind: ArtifactKind): boolean => (MARKET_CHECKED_KINDS as readonly string[]).includes(kind);

/** A library blueprint's researched `market` describes other businesses (D15 allows it); it is not the founder's claim. */
const isResearchedMarketPath = (path: IssuePath): boolean => path[0] === "market";

/**
 * Every deterministic check that applies to one artifact kind. Input should
 * already be parsed with its C-ART schema (the schema owns shape and caps);
 * input that lacks the shape a check needs returns one hard `invalid_shape`
 * issue per missing part instead of throwing (`checkShape`).
 *
 * - every kind but the build pack: never fake it (proof, counts, press,
 *   stats); a library blueprint's `market` subtree is not walked;
 * - own ideas: no market numbers in the kinds in `MARKET_CHECKED_KINDS`;
 * - brand_kit: slop, contrast, type pair, theme, alt text;
 * - landing_spec: slop, headings, no eyebrow/emoji, proof slots, layouts
 *   (when `brandKit` is given), alt text;
 * - build_pack: prompt standard v1 only (its prompts are instructions to a
 *   coding tool, so neither slop nor never fake it applies: "rate each trail
 *   1 to 5 stars" is a feature, not a claim);
 * - roster_plan: nothing beyond never fake it (no copy);
 * - every other kind: slop and alt text.
 */
export function checkArtifact<K extends ArtifactKind>(kind: K, artifact: ArtifactByKind[K], context: CheckContext): CheckResult {
  const shape = checkShape(kind, artifact);
  if (shape.length > 0) return toResult(shape);

  const source = kind === "blueprint" ? (artifact as ArtifactByKind["blueprint"]).source : undefined;
  // Read defensively: plain-JavaScript callers may leave the context out.
  const given = context as CheckContext | undefined;
  const own = source !== undefined ? source === "own_idea" : given?.ownIdea === true;
  const brandName = typeof given?.brandName === "string" && given.brandName.trim() !== "" ? given.brandName : undefined;
  const issues: CheckIssue[] = [];
  if (kind !== "build_pack") {
    issues.push(...checkNeverFake(artifact, source === "library" ? { skip: isResearchedMarketPath, brandName } : { brandName }));
  }
  if (own && isMarketChecked(kind)) issues.push(...checkMarketNumbers(artifact, { brandName }));

  switch (kind) {
    case "brand_kit": {
      const kit = artifact as ArtifactByKind["brand_kit"];
      issues.push(...checkSlop(kit), ...checkBrandKit(kit), ...checkAltText(kit));
      break;
    }
    case "landing_spec": {
      const spec = artifact as ArtifactByKind["landing_spec"];
      issues.push(...checkSlop(spec), ...checkLandingSpec(spec));
      const kit = given?.brandKit;
      if (kit !== undefined && !isReadableBrandKit(kit)) {
        issues.push(issue("hard", "invalid_shape", ["brandKit"], "The brand kit given for the layout check has no known art direction. Pass a parsed brand kit."));
      } else if (kit !== undefined && spec.waitlist !== undefined) {
        issues.push(...checkLandingLayouts(spec, kit));
      }
      break;
    }
    case "build_pack":
      issues.push(...checkBuildPackStandard(artifact as ArtifactByKind["build_pack"], given?.buildPackStandard));
      break;
    case "roster_plan":
      break;
    default:
      issues.push(...checkSlop(artifact), ...checkAltText(artifact));
  }
  return toResult(issues);
}
