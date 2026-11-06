/**
 * WP74-S1 suggested defaults for the eight wizard steps.
 *
 * Every step shows a suggested answer. Until WP71-S5 precomputes per-idea
 * seeds (`idea_crew_seeds`), the seed comes from fixtures: HydroTrail for its
 * slug, a generic fallback for every other library idea, and a light outline
 * for an own idea (D15: "Not yet validated", no market numbers; built and
 * checked in `light-blueprint.ts`).
 *
 * `wizardSeedFor` is the ONE place the seed source is chosen, so switching to
 * precomputed seeds later changes this function and nothing else.
 *
 * Pure: no Convex or React imports, relative imports only (the Convex bundler
 * loads this file).
 */
import { hydrotrailBlueprint } from "../contracts/fixtures/hydrotrail";
import {
  DEFAULT_PARTNER_NAME,
  WIZARD_LIMITS,
  nameDedupeKey,
  wizardAnswersProgressSchema,
  type WizardAnswersProgress,
  type WizardStep,
} from "../contracts/wizard";
import { truncateText } from "./labels";
import { ownIdeaBlueprintPreview, type OwnIdeaOutlineOrigin } from "./light-blueprint";

export type WizardIdea = NonNullable<WizardAnswersProgress["idea"]>;

/** What the blueprint review step shows. Display only; never stored. */
export type WizardBlueprintPreview = {
  readonly pitch: string;
  readonly oneUser: string;
  readonly oneLoop: string;
  readonly features: readonly string[];
  readonly scopeCuts: readonly string[];
  /** Library ideas are researched; own ideas show "Not yet validated" (D15). */
  readonly validated: boolean;
  /** `library` for library ideas; for own ideas, where the light outline came from. */
  readonly origin: "library" | OwnIdeaOutlineOrigin;
  /** Market-claim clauses or items removed from an own idea's outline (always 0 for library ideas). */
  readonly removedClaims: number;
};

export type WizardSeedSource = "fixture_hydrotrail" | "fixture_generic" | "fixture_own_idea";

export type WizardSeed = {
  readonly source: WizardSeedSource;
  readonly blueprint: WizardBlueprintPreview;
  /** A suggested answer for every step (parsed through the progress schema). */
  readonly defaults: WizardAnswersProgress;
  /** Names the name step offers as one-click choices (chosen + alternatives). */
  readonly suggestedNames: readonly string[];
};

export type WizardSeedInput = {
  readonly idea: WizardIdea;
  /** The library idea's title, when known; used for the generic name. */
  readonly ideaTitle?: string;
  /**
   * An own idea's stored drafted blueprint (Option A, not built). Undefined
   * until then, which gives the fixture outline.
   */
  readonly ownIdeaDraft?: unknown;
};

const GENERIC_FEATURES = [
  "Sign up and get started in one step",
  "The one core action, done in under a minute",
  "A simple record of what you did",
] as const;

const GENERIC_SCOPE_CUTS = ["No payments this weekend", "No team accounts"] as const;

const FALLBACK_NAME = "Weekend Launch";

/** The fixture idea with a full worked seed (`fixtures/hydrotrail.ts`). */
export const HYDROTRAIL_SLUG = "hydrotrail";

/** A name the strict schema accepts: one line, at most the business-name limit. */
function boundedName(raw: string): string {
  const cleaned = raw.replace(/[\p{Cc}\u2028\u2029]+/gu, " ").replace(/\s+/g, " ").trim();
  const bounded = truncateText(cleaned, WIZARD_LIMITS.businessName, "").trim();
  return bounded.length > 0 ? bounded : FALLBACK_NAME;
}

/** "HydroTrail – a hydration planner" → "HydroTrail". */
function nameFromTitle(title: string): string {
  const head = title.split(/\s[–—:|-]\s|:\s/u, 1)[0] ?? title;
  return boundedName(head);
}

/** The first three words of an own idea, title-cased. */
function nameFromOwnIdea(text: string): string {
  const words = text
    .replace(/^(an?|the)\s+/iu, "")
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .slice(0, 3)
    .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return boundedName(words.join(" "));
}

function baseDefaults(idea: WizardIdea, name: { chosen: string; alternatives: string[] }): WizardAnswersProgress {
  return wizardAnswersProgressSchema.parse({
    idea,
    blueprintDecision: { decision: "looks_good" },
    platform: { kind: "web" },
    commercialModel: "free",
    goal: { kind: "waitlist", timeframe: "weekend" },
    name,
    partnerPersonality: "strategist",
    partnerName: { kind: "preset", name: DEFAULT_PARTNER_NAME },
  });
}

function seed(
  source: WizardSeedSource,
  idea: WizardIdea,
  blueprint: WizardBlueprintPreview,
  name: { chosen: string; alternatives: string[] },
): WizardSeed {
  const defaults = baseDefaults(idea, name);
  return Object.freeze({
    source,
    blueprint: Object.freeze(blueprint),
    defaults,
    suggestedNames: Object.freeze([name.chosen, ...name.alternatives]),
  });
}

/**
 * The seed for a wizard session. The single switch point for the seed source:
 * fixtures now, `idea_crew_seeds` once WP71-S5 lands.
 */
export function wizardSeedFor(input: WizardSeedInput): WizardSeed {
  const { idea } = input;
  if (idea.source === "own_idea") {
    const preview = ownIdeaBlueprintPreview(idea.text, input.ownIdeaDraft);
    return seed(
      "fixture_own_idea",
      idea,
      {
        pitch: preview.blueprint.pitch,
        oneUser: preview.blueprint.oneUser,
        oneLoop: preview.blueprint.oneLoop,
        features: preview.blueprint.features,
        scopeCuts: preview.blueprint.scopeCuts,
        validated: false,
        origin: preview.origin,
        removedClaims: preview.removedClaims,
      },
      { chosen: nameFromOwnIdea(idea.text), alternatives: [] },
    );
  }
  if (idea.ideaSlug === HYDROTRAIL_SLUG) {
    return seed(
      "fixture_hydrotrail",
      idea,
      {
        pitch: hydrotrailBlueprint.pitch,
        oneUser: hydrotrailBlueprint.oneUser,
        oneLoop: hydrotrailBlueprint.oneLoop,
        features: hydrotrailBlueprint.features,
        scopeCuts: hydrotrailBlueprint.scopeCuts,
        validated: true,
        origin: "library",
        removedClaims: 0,
      },
      { chosen: "HydroTrail", alternatives: ["SipLine", "Trailwater"] },
    );
  }
  const title = input.ideaTitle?.trim() || idea.ideaSlug.replace(/-/g, " ");
  return seed(
    "fixture_generic",
    idea,
    {
      pitch: truncateText(`${title}: the smallest version you can launch this weekend.`, 160),
      oneUser: "The one person who feels this problem most.",
      oneLoop: "They arrive, do the one core thing, and come back next time they need it.",
      features: GENERIC_FEATURES,
      scopeCuts: GENERIC_SCOPE_CUTS,
      validated: true,
      origin: "library",
      removedClaims: 0,
    },
    { chosen: nameFromTitle(title), alternatives: [] },
  );
}

/** The C-WIZARD answers key a step writes, typed for indexing. */
export type WizardStepKey = Exclude<keyof WizardAnswersProgress, "signals">;

/**
 * True when the step's answer is the founder's own words rather than one of
 * the offered choices: an own idea, rework notes, a custom platform, a name
 * that is not one of the suggestions, or a custom partner name.
 */
export function isRewrittenAnswer(step: WizardStep, answers: WizardAnswersProgress, s: WizardSeed): boolean {
  switch (step) {
    case "idea": {
      const idea = answers.idea;
      const suggested = s.defaults.idea;
      if (idea?.source !== "own_idea") return false;
      return suggested?.source !== "own_idea" || suggested.text !== idea.text;
    }
    case "blueprint":
      return answers.blueprintDecision?.decision === "rework";
    case "platform":
      return answers.platform?.kind === "custom";
    case "name": {
      const chosen = answers.name?.chosen;
      if (chosen === undefined) return false;
      return !s.suggestedNames.some((name) => nameDedupeKey(name) === nameDedupeKey(chosen));
    }
    case "partner_name":
      return answers.partnerName?.kind === "custom";
    case "commercial_model":
    case "goal":
    case "partner_personality":
      return false;
  }
}

/** Whether the step's answer equals the suggested default (canonical JSON of parsed values). */
export function isDefaultAnswer(step: WizardStep, answers: WizardAnswersProgress, s: WizardSeed): boolean {
  const key = stepKey(step);
  const value = answers[key];
  return value !== undefined && JSON.stringify(value) === JSON.stringify(s.defaults[key]);
}

const STEP_KEYS = {
  idea: "idea",
  blueprint: "blueprintDecision",
  platform: "platform",
  commercial_model: "commercialModel",
  goal: "goal",
  name: "name",
  partner_personality: "partnerPersonality",
  partner_name: "partnerName",
} as const satisfies Record<WizardStep, WizardStepKey>;

export function stepKey(step: WizardStep): WizardStepKey {
  return STEP_KEYS[step];
}

/**
 * The name answer for a founder-written name: their name as `chosen`, the
 * suggestions as alternatives with anything colliding with it dropped.
 */
export function nameAnswerFor(chosen: string, s: WizardSeed): { chosen: string; alternatives: string[] } {
  const key = nameDedupeKey(chosen.trim());
  const seen = new Set<string>([key]);
  const alternatives: string[] = [];
  for (const name of s.suggestedNames) {
    const k = nameDedupeKey(name);
    if (seen.has(k)) continue;
    seen.add(k);
    alternatives.push(name);
    if (alternatives.length >= WIZARD_LIMITS.nameAlternativesMax) break;
  }
  return { chosen, alternatives };
}

/** One step's answer, as the step mutations take it. */
export type WizardStepAnswer = NonNullable<WizardAnswersProgress[WizardStepKey]>;


/** The answer a step holds in `answers`, if any. */
export function stepAnswerOf(step: WizardStep, answers: WizardAnswersProgress): WizardStepAnswer | undefined {
  return answers[stepKey(step)];
}
