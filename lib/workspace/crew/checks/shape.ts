/**
 * WP75-S4a: the minimum shape each check needs, so malformed input returns a
 * hard `invalid_shape` issue instead of throwing.
 *
 * `checkArtifact` expects input already parsed with its C-ART schema, and the
 * schema owns shape and caps. This guard is the fallback for a caller that
 * skipped parsing (or a draft that arrived unparsed): it checks only what the
 * typed checks dereference, not the full schema, so a low-contrast brand kit
 * (which the schema's refinement also rejects) still reaches the contrast
 * check and gets its own issue. Pure.
 */
import { ART_DIRECTIONS, BUILD_PHASES, PALETTE_ROLES, TYPE_PAIRS, type ArtifactKind } from "../../contracts/artifacts";
import { issue, type CheckIssue, type IssuePath } from "./types";
import { isWalkable, valueAt } from "./walk";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

const PROMPT_FIELDS = ["title", "body", "doNotBuild", "doneWhen"] as const;

function invalid(kind: ArtifactKind, path: IssuePath, what: string): CheckIssue {
  return issue("hard", "invalid_shape", path, `The ${kind} is malformed: ${what}. Regenerate it from its schema.`);
}

function promptIssues(kind: ArtifactKind, prompt: unknown, path: IssuePath): CheckIssue[] {
  if (!isRecord(prompt)) return [invalid(kind, path, "a build prompt is not an object")];
  return PROMPT_FIELDS.filter((field) => !isString(prompt[field])).map((field) => invalid(kind, [...path, field], `${field} is not text`));
}

function buildPackIssues(pack: Record<string, unknown>): CheckIssue[] {
  const issues: CheckIssue[] = [];
  if (pack.weight === "full") {
    for (const phase of BUILD_PHASES) {
      for (const slot of ["first", "second"] as const) {
        const path: IssuePath = ["phases", phase.key, "prompts", slot];
        issues.push(...promptIssues("build_pack", valueAt(pack, path), path));
      }
    }
  } else if (pack.weight === "light") {
    if (!Array.isArray(pack.setupPrompts)) issues.push(invalid("build_pack", ["setupPrompts"], "setupPrompts is not a list"));
    else pack.setupPrompts.forEach((prompt: unknown, index) => issues.push(...promptIssues("build_pack", prompt, ["setupPrompts", index])));
  } else {
    issues.push(invalid("build_pack", ["weight"], "weight is neither full nor light"));
  }
  if (!Array.isArray(pack.stack) || !pack.stack.every((item: unknown) => isRecord(item) && isString(item.value))) {
    issues.push(invalid("build_pack", ["stack"], "stack is not a list of items with a value"));
  }
  if (pack.productMd !== undefined && !isString(pack.productMd)) issues.push(invalid("build_pack", ["productMd"], "productMd is not text"));
  return issues;
}

function brandKitIssues(kit: Record<string, unknown>): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const role of PALETTE_ROLES) {
    if (!isString(valueAt(kit, ["palette", role, "hex"]))) issues.push(invalid("brand_kit", ["palette", role, "hex"], `the ${role} colour has no hex`));
  }
  const pair = valueAt(kit, ["type", "pair"]);
  if (!isString(pair) || !Object.hasOwn(TYPE_PAIRS, pair)) issues.push(invalid("brand_kit", ["type", "pair"], "the type pair is not a known pair"));
  if (!isString(valueAt(kit, ["visualSystem", "direction"]))) issues.push(invalid("brand_kit", ["visualSystem", "direction"], "the direction is missing"));
  if (!isString(valueAt(kit, ["visualSystem", "theme", "mode"]))) issues.push(invalid("brand_kit", ["visualSystem", "theme", "mode"], "the theme mode is missing"));
  return issues;
}

/** Sections every landing spec has (`waitlist` may be missing in a draft: `checkLandingSpec` reports that). */
const LANDING_REQUIRED = ["hero", "footer"] as const;
const LANDING_OPTIONAL = ["promises", "how_it_works", "app_preview", "waitlist"] as const;

function landingSpecIssues(spec: Record<string, unknown>): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const key of LANDING_REQUIRED) {
    if (!isRecord(spec[key])) issues.push(invalid("landing_spec", [key], `the ${key} section is not an object`));
  }
  for (const key of LANDING_OPTIONAL) {
    if (spec[key] !== undefined && !isRecord(spec[key])) issues.push(invalid("landing_spec", [key], `the ${key} section is not an object`));
  }
  return issues;
}

/** True when a brand kit given as context can be read for layouts (a known art direction). */
export function isReadableBrandKit(kit: unknown): boolean {
  const direction = valueAt(kit, ["visualSystem", "direction"]);
  return isString(direction) && (ART_DIRECTIONS as readonly string[]).includes(direction);
}

/** Empty when the artifact has the shape every check for `kind` needs; otherwise hard `invalid_shape` issues. */
export function checkShape(kind: ArtifactKind, artifact: unknown): CheckIssue[] {
  if (!isRecord(artifact)) return [invalid(kind, [], "it is not an object")];
  if (!isWalkable(artifact)) return [invalid(kind, [], "it is too deep, too large or refers to itself")];
  switch (kind) {
    case "blueprint":
      return artifact.source === "library" || artifact.source === "own_idea" ? [] : [invalid(kind, ["source"], "source is neither library nor own_idea")];
    case "brand_kit":
      return brandKitIssues(artifact);
    case "build_pack":
      return buildPackIssues(artifact);
    case "landing_spec":
      return landingSpecIssues(artifact);
    default:
      return [];
  }
}
