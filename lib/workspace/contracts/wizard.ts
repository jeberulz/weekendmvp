/**
 * C-WIZARD — the launch wizard's answers (WP69 follow-up to the WP68 schema).
 *
 * WP68's `wizard_sessions.answers` types against `wizardAnswersProgressSchema`
 * while a session is in progress and `wizardAnswersSchema` once it completes.
 * Source: `docs/wp/wp69-canvas-extract.md`, "Wizard answers and Blueprint".
 * Types and pure helpers only: no Convex imports, no I/O.
 *
 * Rules:
 * - Eight steps (`WIZARD_STEPS`). D10 removes the canvas's SMS step: there is
 *   no phone number field anywhere, and the strict schemas reject one.
 * - Objects are strict (unknown keys fail) and every string and array is
 *   bounded. Founder text is single-line (`singleLineText`).
 * - A completed session has accepted its blueprint (`looks_good`); `rework`
 *   exists only while the session is in progress.
 * - `ideaKind` is not a wizard question. `rosterInputFromWizard` takes it, and
 *   the rest of the roster profile, from the blueprint. The goal target is not
 *   a question either: it is derived from the goal kind (`GOAL_TARGETS`).
 * - Enums and shapes are reused from C-ROSTER (`roster.ts`), so the mapping to
 *   `rosterInputSchema` cannot drift.
 *
 * Storage (C-DATA, WP68):
 * - Writers store only the output of `wizardAnswersProgressSchema.parse()` or
 *   `wizardAnswersSchema.parse()`, never raw client input. The Convex
 *   validator on `wizard_sessions.answers` enforces none of the zod bounds,
 *   strictness or refinements, so an unparsed write would bypass all of them.
 *   `fixtures/hydrotrail.ts` exports `hydrotrailWizardAnswers` so WP68 can
 *   assert that its validator accepts the parsed fixture.
 * - `answers.idea` is the source of truth for which idea the session is about.
 *   If the session row also keeps a top-level `ideaSlug`, it must equal
 *   `answers.idea.ideaSlug` (and be absent for an own idea).
 */
import { z } from "zod";

import { LIMITS, blueprintSchema, type Blueprint } from "./artifacts.ts";
import {
  normaliseTeamProposal,
  commercialModelSchema,
  goalKindSchema,
  goalTargetSchema,
  rosterInputSchema,
  singleLineText,
  type GoalKind,
  type GoalTarget,
  type RosterInput,
} from "./roster.ts";

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** The eight wizard steps, in order (D10: no SMS step). */
export const WIZARD_STEPS = [
  "idea",
  "blueprint",
  "platform",
  "commercial_model",
  "goal",
  "name",
  "partner_personality",
  "partner_name",
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
export const wizardStepSchema = z.enum(WIZARD_STEPS);

/** The answers key each step writes. `signals` is the only key no step owns. */
export const WIZARD_STEP_ANSWER_KEY = {
  idea: "idea",
  blueprint: "blueprintDecision",
  platform: "platform",
  commercial_model: "commercialModel",
  goal: "goal",
  name: "name",
  partner_personality: "partnerPersonality",
  partner_name: "partnerName",
} as const satisfies Record<WizardStep, string>;

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const WIZARD_LIMITS = {
  ownIdea: 240,
  reworkNotes: 400,
  customPlatform: 120,
  businessName: LIMITS.brandKit.name,
  nameAlternativesMax: LIMITS.brandKit.nameAlternativesMax,
  partnerName: 24,
  signalNote: 160,
} as const;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PLATFORM_KINDS = ["native", "web", "custom"] as const;
export type PlatformKind = (typeof PLATFORM_KINDS)[number];

export const GOAL_TIMEFRAMES = ["weekend", "2w", "30d", "none"] as const;
export type GoalTimeframe = (typeof GOAL_TIMEFRAMES)[number];
export const goalTimeframeSchema = z.enum(GOAL_TIMEFRAMES);

export const PARTNER_PERSONALITIES = ["hustler", "strategist", "creative", "operator"] as const;
export type PartnerPersonality = (typeof PARTNER_PERSONALITIES)[number];
export const partnerPersonalitySchema = z.enum(PARTNER_PERSONALITIES);

export const PARTNER_NAME_PRESETS = ["Wren", "Juno", "Ridge"] as const;
export type PartnerNamePreset = (typeof PARTNER_NAME_PRESETS)[number];
/** The last-resort name when none is stored. Never offered as a default choice (roster per idea S2). */
export const DEFAULT_PARTNER_NAME: PartnerNamePreset = "Wren";

/**
 * Roster per idea S2: the names the partner-name step may suggest, each with a
 * one-line hint. Short, easy to read, and never a specialist's name (Iris,
 * Leo, Sana, Marco, Elle, Theo, Kai, Ada, Cora, Nia, Max, Oli; a test checks).
 * The three stored presets are in the pool, so an old answer still reads.
 */
export const LEAD_NAME_POOL = [
  { name: "Wren", hint: "Small bird, big range." },
  { name: "Juno", hint: "Steady and direct." },
  { name: "Ridge", hint: "Grounded and calm." },
  { name: "Sage", hint: "Thinks before speaking." },
  { name: "Rowan", hint: "Quietly resourceful." },
  { name: "Quinn", hint: "Sharp and to the point." },
  { name: "Arlo", hint: "Easygoing, keeps things moving." },
  { name: "Bea", hint: "Warm and organised." },
  { name: "Remy", hint: "Curious and quick." },
  { name: "Tess", hint: "Plain-spoken and practical." },
  { name: "Hugo", hint: "Sees the big picture." },
  { name: "Ivy", hint: "Never drops a thread." },
  { name: "Milo", hint: "Friendly and even-tempered." },
  { name: "Nell", hint: "Careful with the details." },
  { name: "Otto", hint: "Methodical and patient." },
  { name: "Pia", hint: "Bright and brisk." },
  { name: "Rhea", hint: "Calm under pressure." },
  { name: "Silas", hint: "Measured and thorough." },
  { name: "Tova", hint: "Clear and decisive." },
  { name: "Vera", hint: "Honest, even when it stings." },
  { name: "Ezra", hint: "Asks the useful question." },
  { name: "Fern", hint: "Patient and steady." },
  { name: "Lark", hint: "Light touch, early start." },
  { name: "Jude", hint: "Loyal and level-headed." },
] as const satisfies readonly { readonly name: string; readonly hint: string }[];

/** How many names the partner-name step offers. */
export const LEAD_NAME_SUGGESTIONS = 3;

/** FNV-1a, 32 bits: a small, stable hash with no clock or randomness. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Roster per idea S2: three distinct names from `LEAD_NAME_POOL`, picked by a
 * hash of `seedKey` (the wizard session id), so the same session always gets
 * the same names and two businesses rarely share a lead. Pure.
 */
export function leadNameSuggestions(seedKey: string, count: number = LEAD_NAME_SUGGESTIONS): string[] {
  const pool = LEAD_NAME_POOL.map((entry) => entry.name);
  const picked: string[] = [];
  for (let round = 0; picked.length < Math.min(count, pool.length); round += 1) {
    const name = pool[fnv1a(`${seedKey}:${round.toString()}`) % pool.length] ?? pool[0];
    if (name !== undefined && !picked.includes(name)) picked.push(name);
  }
  return picked;
}

/** The pool's hint for a suggested name, or undefined for a typed one. */
export function leadNameHint(name: string): string | undefined {
  return LEAD_NAME_POOL.find((entry) => entry.name === name)?.hint;
}

/** The stored answer for a chosen lead name: a preset when it is one, else custom. */
export function partnerNameAnswer(name: string): WizardPartnerName {
  const preset = PARTNER_NAME_PRESETS.find((value) => value === name);
  return preset === undefined ? { kind: "custom", name } : { kind: "preset", name: preset };
}

export const FOUNDER_SIGNALS = ["kept", "edited"] as const;
export type FounderSignal = (typeof FOUNDER_SIGNALS)[number];

// ---------------------------------------------------------------------------
// Goal targets (derived, not answered)
// ---------------------------------------------------------------------------

/**
 * The target each goal kind implies, in the roster's target shape. Goals
 * without a measurable target map to `null`.
 */
export const GOAL_TARGETS = {
  waitlist: { count: 50, unit: "signups" },
  first_sale: { count: 1, unit: "sale" },
  mrr_500: { count: 500, unit: "USD a month" },
  replace_income: null,
  just_testing: null,
} as const satisfies Record<GoalKind, GoalTarget | null>;

/** The roster target for a goal kind, as a fresh object (or `null`). */
export function goalTargetFor(kind: GoalKind): GoalTarget | null {
  const target = GOAL_TARGETS[kind];
  return target === null ? null : goalTargetSchema.parse({ ...target });
}

// ---------------------------------------------------------------------------
// Field schemas
// ---------------------------------------------------------------------------

/**
 * The founder's partner (Crew Lead) display name. Mirrors `leadNameSchema` in
 * `convex/crew/roles.ts` (`singleLineText(24)`) so this contract stays free of
 * `convex/` imports; a test asserts the two agree.
 */
export const wizardLeadNameSchema = singleLineText(WIZARD_LIMITS.partnerName);

const slugSchema = z
  .string()
  .max(LIMITS.common.slug)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use a lowercase-hyphenated slug");

/** Step 1: a library idea by slug, or the founder's own idea in one sentence. */
export const wizardIdeaSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("library"), ideaSlug: slugSchema }).strict(),
  z.object({ source: z.literal("own_idea"), text: singleLineText(WIZARD_LIMITS.ownIdea) }).strict(),
]);

const acceptedBlueprintSchema = z.object({ decision: z.literal("looks_good") }).strict();

/** Step 2, in progress: the blueprint review. Notes are only valid on `rework`. */
export const blueprintDecisionSchema = z.discriminatedUnion("decision", [
  acceptedBlueprintSchema,
  z
    .object({
      decision: z.literal("rework"),
      notes: singleLineText(WIZARD_LIMITS.reworkNotes).optional(),
    })
    .strict(),
]);

/**
 * Step 3: `native` (iOS + Android), `web` (mobile web, installable) or
 * `custom`. Not a roster input: the build pack and launch plan read it.
 */
export const wizardPlatformSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("native") }).strict(),
  z.object({ kind: z.literal("web") }).strict(),
  z.object({ kind: z.literal("custom"), description: singleLineText(WIZARD_LIMITS.customPlatform) }).strict(),
]);

/** The roster input's paid-push shape, reused so the mapping cannot drift. */
const paidPushSchema = rosterInputSchema.shape.goal.shape.paidPush.unwrap();

/**
 * Step 5: the goal kind, its timeframe and an optional paid test. The target
 * is derived from the kind (`GOAL_TARGETS`), never answered. `timeframe` is
 * not a roster input: the launch plan reads it.
 */
export const wizardGoalSchema = z
  .object({
    kind: goalKindSchema,
    timeframe: goalTimeframeSchema,
    paidPush: paidPushSchema.optional(),
  })
  .strict();

/**
 * A name's subdomain form: diacritics stripped, lowercase, every run of
 * non-alphanumerics collapsed to one `-`, no leading or trailing `-`.
 */
export function nameSubdomainSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The key two names collide on: the subdomain form when it is non-empty,
 * otherwise (e.g. a name written only in non-Latin script) the NFKC-lowercased
 * name. Prefixed so the two kinds of key can never collide with each other.
 */
export function nameDedupeKey(name: string): string {
  const slug = nameSubdomainSlug(name);
  return slug.length > 0 ? `slug:${slug}` : `name:${name.normalize("NFKC").toLowerCase()}`;
}

/**
 * Step 6: the chosen business name plus alternatives, deduped on
 * `nameDedupeKey`. Any script is allowed: the subdomain is a separate choice
 * with its own availability check, so it is not stored here.
 */
export const wizardNameSchema = z
  .object({
    chosen: singleLineText(WIZARD_LIMITS.businessName),
    alternatives: z.array(singleLineText(WIZARD_LIMITS.businessName)).max(WIZARD_LIMITS.nameAlternativesMax),
  })
  .strict()
  .superRefine((name, ctx) => {
    const seen = new Set<string>();
    const entries: { value: string; path: (string | number)[] }[] = [
      { value: name.chosen, path: ["chosen"] },
      ...name.alternatives.map((value, i) => ({ value, path: ["alternatives", i] })),
    ];
    for (const { value, path } of entries) {
      const key = nameDedupeKey(value);
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Names must differ from the chosen name and from each other",
          path,
        });
      }
      seen.add(key);
    }
  });

/** Step 8: a preset name (Wren by default) or a custom one under the lead-name rules. */
export const wizardPartnerNameSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preset"), name: z.enum(PARTNER_NAME_PRESETS) }).strict(),
  z.object({ kind: z.literal("custom"), name: wizardLeadNameSchema }).strict(),
]);
export type WizardPartnerName = z.infer<typeof wizardPartnerNameSchema>;

export const founderSignalSchema = z
  .object({
    signal: z.enum(FOUNDER_SIGNALS),
    note: singleLineText(WIZARD_LIMITS.signalNote).optional(),
  })
  .strict();

/** Per-step founder signals (KEPT / EDIT on the canvas). Every key optional. */
export const founderSignalsSchema = z
  .object({
    idea: founderSignalSchema.optional(),
    blueprint: founderSignalSchema.optional(),
    platform: founderSignalSchema.optional(),
    commercial_model: founderSignalSchema.optional(),
    goal: founderSignalSchema.optional(),
    name: founderSignalSchema.optional(),
    partner_personality: founderSignalSchema.optional(),
    partner_name: founderSignalSchema.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

const answersShape = {
  idea: wizardIdeaSchema,
  platform: wizardPlatformSchema,
  commercialModel: commercialModelSchema,
  goal: wizardGoalSchema,
  name: wizardNameSchema,
  partnerPersonality: partnerPersonalitySchema,
  partnerName: wizardPartnerNameSchema,
  signals: founderSignalsSchema.optional(),
};

/** A completed wizard session: every step answered and the blueprint accepted. */
export const wizardAnswersSchema = z
  .object({ ...answersShape, blueprintDecision: acceptedBlueprintSchema })
  .strict();
export type WizardAnswers = z.infer<typeof wizardAnswersSchema>;

/** An in-progress session: every answer optional (rework allowed), still strict and bounded. */
export const wizardAnswersProgressSchema = z
  .object({ ...answersShape, blueprintDecision: blueprintDecisionSchema })
  .partial()
  .strict();
export type WizardAnswersProgress = z.infer<typeof wizardAnswersProgressSchema>;

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** The Crew Lead's display name: the preset or custom name, else Wren. */
export function partnerNameFromWizard(answers: Pick<WizardAnswersProgress, "partnerName">): string {
  return answers.partnerName?.name ?? DEFAULT_PARTNER_NAME;
}

/**
 * Completed answers + the reviewed blueprint → the roster input.
 *
 * The caller loads the blueprint itself, by wizard session or by project; it
 * is never taken from the client alongside the answers.
 *
 * `ideaKind`, buyer, delivery format and audience come from
 * `blueprint.profile`; the commercial model, goal kind and paid push come from
 * the answers; the target comes from `GOAL_TARGETS`; the Crew Lead's team
 * proposal comes from `blueprint.team`, cleaned. Platform, timeframe,
 * name, partner and signals are not roster inputs. Throws when the blueprint
 * was sent back for rework, when the answers are not a completed session, or
 * when the blueprint is not the one the founder picked.
 */
export function rosterInputFromWizard(answers: WizardAnswers, blueprint: Blueprint): RosterInput {
  const decision: unknown = (answers as { blueprintDecision?: { decision?: unknown } }).blueprintDecision?.decision;
  if (decision === "rework") {
    throw new Error("The blueprint was sent back for rework; the roster needs an accepted blueprint");
  }
  const a = wizardAnswersSchema.parse(answers);
  const b = blueprintSchema.parse(blueprint);
  if (a.idea.source !== b.source) {
    throw new Error(`Blueprint source "${b.source}" does not match the wizard idea source "${a.idea.source}"`);
  }
  if (a.idea.source === "library" && b.source === "library" && a.idea.ideaSlug !== b.ideaSlug) {
    throw new Error(`Blueprint idea "${b.ideaSlug}" does not match the wizard idea "${a.idea.ideaSlug}"`);
  }
  // Roster per idea (WP91): the Crew Lead's proposal. The quality gate already
  // ran the full cleaning (`cleanTeamProposal`: links, invented proof, market
  // numbers) on every stored blueprint; the structural part runs again here so
  // a malformed team can never break the roster.
  const proposal = normaliseTeamProposal(b.team);
  return rosterInputSchema.parse({
    ...b.profile,
    ...(proposal === undefined ? {} : { proposal }),
    commercialModel: a.commercialModel,
    goal: {
      kind: a.goal.kind,
      target: goalTargetFor(a.goal.kind),
      paidPush: a.goal.paidPush ?? null,
    },
  });
}
