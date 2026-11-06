/**
 * WP75-S4a: deterministic quality and "never fake it" checks.
 *
 * Pure TypeScript, no Convex, no model call, no I/O. Run after each
 * generation (S3a-S3d), before the one `quality@1` call and the one repair
 * (S4b). WP76 reuses the same checks for its generators through
 * `checkArtifact`.
 *
 *   const result = checkArtifact("landing_spec", spec, { brandKit });
 *   if (hasHardIssues(result)) repairInput = toRepairIssues(result);
 *
 * `{ hard, soft }`: hard issues trigger the repair; soft ones ride along when
 * a repair happens and are otherwise shown, never blocking.
 */
import type { ArtifactByKind, ArtifactKind, BrandKit } from "../../contracts/artifacts";
import { checkBrandKit } from "./brandKit";
import { checkLandingLayouts, checkLandingSpec, checkAltText } from "./landing";
import { MARKET_CHECKED_KINDS, checkMarketNumbers } from "./marketNumbers";
import { checkNeverFake } from "./neverFake";
import { checkBuildPackStandard, type BuildPackStandardOptions } from "./promptStandard";
import { checkSlop } from "./slop";
import { toResult, type CheckIssue, type CheckResult } from "./types";

export * from "./types";
export { stringLeaves, stripPlaceholders } from "./walk";
export { checkNeverFake, neverFakeMatches } from "./neverFake";
export { checkMarketNumbers, carriesMarketNumber, MARKET_CHECKED_KINDS } from "./marketNumbers";
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
  PROMPT_STANDARD_VERSION,
  checkBuildPackStandard,
  checkBuildPrompt,
  defaultBuildPackStandard,
  type BuildPackStandardOptions,
  type PromptRole,
  type PromptStandardOptions,
} from "./promptStandard";

export type CheckContext = {
  /** The idea is the founder's own (no market data). A blueprint reads this from its `source`. */
  readonly ownIdea?: boolean;
  /** The brand kit a landing spec is judged against (layouts per direction). */
  readonly brandKit?: BrandKit;
  /** How standard v1 applies to a build pack (open owner rulings, see `promptStandard.ts`). */
  readonly buildPackStandard?: BuildPackStandardOptions;
};

const isMarketChecked = (kind: ArtifactKind): boolean => (MARKET_CHECKED_KINDS as readonly string[]).includes(kind);

/**
 * Every deterministic check that applies to one artifact kind. Input is
 * already parsed with its C-ART schema (the schema owns shape and caps).
 *
 * - all kinds: never fake it (proof, counts, press, stats);
 * - own ideas: no market numbers in the kinds in `MARKET_CHECKED_KINDS`;
 * - brand_kit: slop, contrast, type pair, theme, alt text;
 * - landing_spec: slop, headings, no eyebrow/emoji, proof slots, layouts
 *   (when `brandKit` is given), alt text;
 * - build_pack: prompt standard v1 (no slop: prompts are instructions);
 * - every other kind: slop.
 */
export function checkArtifact<K extends ArtifactKind>(kind: K, artifact: ArtifactByKind[K], context: CheckContext = {}): CheckResult {
  const issues: CheckIssue[] = [...checkNeverFake(artifact)];
  const own = kind === "blueprint" ? (artifact as ArtifactByKind["blueprint"]).source === "own_idea" : context.ownIdea === true;
  if (own && isMarketChecked(kind)) issues.push(...checkMarketNumbers(artifact));

  switch (kind) {
    case "brand_kit": {
      const kit = artifact as ArtifactByKind["brand_kit"];
      issues.push(...checkSlop(kit), ...checkBrandKit(kit), ...checkAltText(kit));
      break;
    }
    case "landing_spec": {
      const spec = artifact as ArtifactByKind["landing_spec"];
      issues.push(...checkSlop(spec), ...checkLandingSpec(spec));
      if (context.brandKit !== undefined) issues.push(...checkLandingLayouts(spec, context.brandKit));
      break;
    }
    case "build_pack":
      issues.push(...checkBuildPackStandard(artifact as ArtifactByKind["build_pack"], context.buildPackStandard));
      break;
    case "roster_plan":
      break;
    default:
      issues.push(...checkSlop(artifact));
  }
  return toResult(issues);
}
