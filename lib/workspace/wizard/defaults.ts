/**
 * WP74-S1 suggested defaults for the eight wizard steps.
 *
 * Every step shows a suggested answer. For a library idea with a stored
 * WP90 seed (`idea_crew_seeds`, precomputed from the idea's own page), the
 * blueprint, the platform, commercial-model, goal and name defaults and a
 * one-line reason for each come from that seed. Without one, the seed comes
 * from fixtures: HydroTrail for its slug, a generic fallback for every other
 * library idea, and a light outline for an own idea (D15: "Not yet
 * validated", no market numbers; built and checked in `light-blueprint.ts`).
 *
 * `wizardSeedFor` is the ONE place the seed source is chosen.
 *
 * Pure: no Convex or React imports, relative imports only (the Convex bundler
 * loads this file).
 */
import { hydrotrailBlueprint } from "../contracts/fixtures/hydrotrail";
import type { RosterProfile } from "../contracts/roster";
import {
  ideaIsValidated,
  platformSuggestion,
  type IdeaCrewSeed,
  type IdeaValidationFacts,
} from "../contracts/seeds";
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

export type WizardSeedSource = "idea_crew_seeds" | "fixture_hydrotrail" | "fixture_generic" | "fixture_own_idea";

/** The steps a stored seed explains. */
export const WIZARD_HINT_STEPS = ["platform", "commercial_model", "goal", "name"] as const;
export type WizardHintStep = (typeof WIZARD_HINT_STEPS)[number];

/** Why a step's suggestion was made, and whether the step may offer a quick confirm. */
export type WizardStepHint = {
  readonly reason: string;
  /** A confident suggestion shows "Looks right" with the full choice one click away. */
  readonly confident: boolean;
};
export type WizardStepHints = Readonly<Partial<Record<WizardHintStep, WizardStepHint>>>;

export type WizardSeed = {
  readonly source: WizardSeedSource;
  readonly blueprint: WizardBlueprintPreview;
  /** A suggested answer for every step (parsed through the progress schema). */
  readonly defaults: WizardAnswersProgress;
  /** Names the name step offers as one-click choices (chosen + alternatives). */
  readonly suggestedNames: readonly string[];
  /** Reasons for the suggestions; empty for fixture seeds, which have none to give. */
  readonly hints: WizardStepHints;
  /** The idea's roster profile, for the crew preview; null when no blueprint states one. */
  readonly profile: RosterProfile | null;
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
  /** The library idea's newest stored WP90 seed, if any (`seedFromColumns` output). */
  readonly storedSeed?: IdeaCrewSeed | null;
  /**
   * The library idea row's research level and audit result. Decides
   * `validated` for every library seed: a concept idea, or one whose audit
   * failed, is "Not yet validated" (owner ruling, 2026-11-07).
   */
  readonly ideaFacts?: IdeaValidationFacts;
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

/**
 * L1-C7: words a suggested name never ends on. The articles, conjunctions and
 * prepositions a cut title would otherwise leave dangling ("… app for").
 */
const DANGLING_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "&", "+",
  "for", "with", "of", "to", "in", "on", "at", "by", "from", "into", "onto", "via", "vs",
  "your", "my", "our", "their", "its",
]);

/** Where a descriptive title turns into its explanation; the name stops before it once it has two words. */
const PHRASE_BREAKS: ReadonlySet<string> = new Set([
  "for", "with", "of", "to", "in", "on", "at", "by", "from", "into", "via", "and", "or", "but", "&", "+",
  "using", "without", "so", "because",
]);

/** Clause starters: the name always stops before them ("A list that adapts" → "List"). */
const CLAUSE_STARTERS: ReadonlySet<string> = new Set(["that", "which", "who", "whom", "whose", "where", "when", "while", "if"]);

/** Small words stay lower case inside a title-cased name ("AI for Dentists"). */
const SMALL_WORDS: ReadonlySet<string> = new Set([...DANGLING_WORDS, "as", "per"]);

/** A suggested name is a short phrase, not a sentence. */
export const SUGGESTED_NAME_MAX_WORDS = 4;

/** "posture" → "Posture", "ai-powered" → "Ai-Powered"; a word with its own capitals ("HydroTrail", "iOS") is kept. */
function titleCaseWord(word: string, first: boolean): string {
  if (/\p{Lu}/u.test(word.slice(1))) return word;
  const lower = word.toLowerCase();
  if (!first && SMALL_WORDS.has(lower)) return lower;
  return word.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-");
}

/** Trims edge punctuation from one word ("phone-" → "phone", "(beta)" → "beta"); "&" and "+" stay. */
function trimWord(word: string): string {
  if (word === "&" || word === "+") return word;
  return word.replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}]+$/u, "");
}

/**
 * L1-C7: a short, clean, title-cased name from a phrase. Whole words only (a
 * cut never lands mid-word or on a hyphen), at most `maxWords` words and the
 * business-name limit, stopping before the phrase turns into an explanation
 * ("for …", "that …"), and never ending on an article, conjunction or
 * preposition, and never starting on "&" or "+". A single word longer than
 * the limit is cut and trimmed. Empty
 * input gives the fallback name.
 */
export function shortBusinessName(raw: string, maxWords: number = SUGGESTED_NAME_MAX_WORDS): string {
  const cleaned = raw.replace(/[\p{Cc}\u2028\u2029]+/gu, " ").replace(/\s+/g, " ").trim();
  const words = cleaned
    .split(" ")
    .map(trimWord)
    .filter((word) => word === "&" || word === "+" || /[\p{L}\p{N}]/u.test(word));
  const picked: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (picked.length >= maxWords) break;
    // A name never starts on "&" or "+".
    if (picked.length === 0 && (word === "&" || word === "+")) continue;
    if (picked.length >= 1 && CLAUSE_STARTERS.has(lower)) break;
    if (picked.length >= 2 && PHRASE_BREAKS.has(lower)) break;
    if ([...picked, word].join(" ").length > WIZARD_LIMITS.businessName) break;
    picked.push(word);
  }
  while (picked.length > 0 && DANGLING_WORDS.has((picked[picked.length - 1] ?? "").toLowerCase())) picked.pop();
  if (picked.length === 0) {
    // Only one over-long word (or nothing usable): cut it to the limit on a letter or digit.
    const first = words.find((word) => !DANGLING_WORDS.has(word.toLowerCase()));
    if (first === undefined) return FALLBACK_NAME;
    const cut = trimWord(truncateText(first, WIZARD_LIMITS.businessName, ""));
    return cut.length > 0 ? boundedName(titleCaseWord(cut, true)) : FALLBACK_NAME;
  }
  return boundedName(picked.map((word, index) => titleCaseWord(word, index === 0)).join(" "));
}

/** "HydroTrail – a hydration planner" → "HydroTrail"; "Gamified posture tracking app for phone-based…" → "Gamified Posture Tracking App". */
export function nameFromTitle(title: string): string {
  const head = title.split(/\s[–—:|-]\s|:\s|[,;(]/u, 1)[0] ?? title;
  return shortBusinessName(head.replace(/^(an?)\s+/iu, ""));
}

/**
 * "I want to", "I'd like to", "I’m going to", "I wanna" … : how an own idea
 * often starts. Straight and curly apostrophes both count.
 */
const OWN_IDEA_LEAD_IN =
  /^\s*i(?:\s+want\s+to|\s+wanna|\s+plan\s+to|(?:\s+would|\s*['’]d)\s+like\s+to|(?:\s+am|\s*['’]m)\s+going\s+to)\s+/iu;

/** A short name from an own idea's first words: "A packing list that adapts to the forecast" → "Packing List". */
export function nameFromOwnIdea(text: string): string {
  const head = text.split(/[.!?\n]|[,;:(]|\s[–—-]\s/u, 1)[0] ?? text;
  const trimmed = head
    .replace(OWN_IDEA_LEAD_IN, "")
    .replace(/^\s*(build|make|create|launch|start)\s+/iu, "")
    .replace(/^\s*(an?|the)\s+/iu, "");
  return shortBusinessName(trimmed, 3);
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
  profile: RosterProfile | null = null,
): WizardSeed {
  const defaults = baseDefaults(idea, name);
  return Object.freeze({
    source,
    blueprint: Object.freeze(blueprint),
    defaults,
    suggestedNames: Object.freeze([name.chosen, ...name.alternatives]),
    hints: Object.freeze({}),
    profile,
  });
}

/** Why the name step offers the seed's names. */
export const SEED_NAME_REASON = "Drafted from the idea's page. Pick one or type your own.";

/** The seed's names as a name answer: bounded, deduplicated, at most the alternatives limit. */
function seedNameAnswer(names: readonly string[]): { chosen: string; alternatives: string[] } | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = boundedName(raw);
    const key = nameDedupeKey(name);
    if (name === FALLBACK_NAME && raw.trim() !== FALLBACK_NAME) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length > WIZARD_LIMITS.nameAlternativesMax) break;
  }
  const [chosen, ...alternatives] = out;
  return chosen === undefined ? null : { chosen, alternatives };
}

/**
 * The wizard seed from a stored WP90 seed, or null when it cannot make one
 * (a wrong idea, or defaults the progress schema refuses): the caller then
 * falls back to the fixtures, so a bad row never breaks the wizard.
 */
function seedFromStored(idea: Extract<WizardIdea, { source: "library" }>, stored: IdeaCrewSeed, validated: boolean): WizardSeed | null {
  const { blueprint, wizardHints: hints } = stored;
  if (blueprint.ideaSlug !== idea.ideaSlug) return null;
  const name = seedNameAnswer(hints.names);
  if (name === null) return null;
  const platform = platformSuggestion(hints.platform.deviceNeeds);
  const parsed = wizardAnswersProgressSchema.safeParse({
    idea,
    blueprintDecision: { decision: "looks_good" },
    platform: { kind: platform.kind },
    commercialModel: hints.commercialModel.value,
    goal: { kind: hints.goal.kind, timeframe: hints.goal.timeframe },
    name,
    partnerPersonality: "strategist",
    partnerName: { kind: "preset", name: DEFAULT_PARTNER_NAME },
  });
  if (!parsed.success) return null;
  return Object.freeze({
    source: "idea_crew_seeds",
    blueprint: Object.freeze({
      pitch: blueprint.pitch,
      oneUser: blueprint.oneUser,
      oneLoop: blueprint.oneLoop,
      features: Object.freeze([...blueprint.features]),
      scopeCuts: Object.freeze([...blueprint.scopeCuts]),
      validated,
      origin: "library",
      removedClaims: 0,
    }),
    defaults: parsed.data,
    suggestedNames: Object.freeze([name.chosen, ...name.alternatives]),
    hints: Object.freeze({
      platform: { reason: platform.reason, confident: hints.platform.confidence === "high" },
      commercial_model: { reason: hints.commercialModel.reason, confident: hints.commercialModel.confidence === "high" },
      goal: { reason: hints.goal.reason, confident: hints.goal.confidence === "high" },
      name: { reason: SEED_NAME_REASON, confident: false },
    }),
    profile: blueprint.profile,
  });
}

/**
 * The seed for a wizard session. The single switch point for the seed source:
 * a stored WP90 seed when the library idea has a valid one, else fixtures.
 */
export function wizardSeedFor(input: WizardSeedInput): WizardSeed {
  const { idea } = input;
  // An idea row with no facts (tests, older callers) keeps the pre-WP90 behaviour: validated.
  const libraryValidated = ideaIsValidated(input.ideaFacts ?? {});
  if (idea.source === "library" && input.storedSeed) {
    const fromStored = seedFromStored(idea, input.storedSeed, input.storedSeed.validated && libraryValidated);
    if (fromStored !== null) return fromStored;
  }
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
        validated: libraryValidated,
        origin: "library",
        removedClaims: 0,
      },
      { chosen: "HydroTrail", alternatives: ["SipLine", "Trailwater"] },
      hydrotrailBlueprint.profile,
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
      validated: libraryValidated,
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
