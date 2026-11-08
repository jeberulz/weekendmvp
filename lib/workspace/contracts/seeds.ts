/**
 * C-SEED — the per-idea crew seed (WP90-S1).
 *
 * One seed per library idea and seed version, written by the WP90-S3 batch
 * precompute from the idea's own published page (`content/ideas/{slug}.mdx`
 * and its `ideas/manifest.json` row) and read by:
 * - the wizard (`lib/workspace/wizard/defaults.ts`): the blueprint review, the
 *   suggested answer and its reason on steps 3–6, and the crew preview;
 * - the crew steps (`lib/workspace/crew/inputs.ts`): the blueprint seed, and
 *   the brand, email and social angles;
 * - later WPs: the landing page, build pack, SEO and outbound steps, which do
 *   not exist yet. Their fields are written and validated now.
 *
 * Rules:
 * - Objects are strict and every string and list is bounded, like C-ART.
 * - No text anywhere in a seed carries a market claim (money, percentages,
 *   market sizes, traction counts, keyword metrics): `hasMarketClaim`, the same
 *   check D15 applies to own ideas, enforced by a refinement on the whole
 *   seed. Library market numbers stay in the idea pipeline (ruling 38).
 * - The model drafts `ideaSeedDraftSchema`. The server adds what the model
 *   must not decide (`seedFromDraft`): the blueprint's `schemaVersion`,
 *   `source` and `ideaSlug`, and `validated`, which comes from the idea's
 *   research level, never from the model. An unvalidated seed carries no
 *   market block (owner ruling, 2026-11-07).
 * - The platform suggestion is not model-chosen. The model lists the phone
 *   capabilities the core loop needs (`deviceNeeds`, a closed list) and
 *   `platformSuggestion` decides: any need → native, none → web.
 *
 * Types and pure helpers only: no Convex imports, no I/O. Relative imports
 * only, with `.ts` extensions: the prompt-version check loads this file in
 * plain Node through `convex/ai/prompts/ideaSeed.v2.ts`.
 */
import { z } from "zod";

import { LIMITS, blueprintVariantSchemas, type Blueprint } from "./artifacts.ts";
import { hasMarketClaim } from "./marketClaims.ts";
import { commercialModelSchema, goalKindSchema, singleLineText, type CommercialModel, type GoalKind } from "./roster.ts";
import { goalTimeframeSchema, nameDedupeKey, type GoalTimeframe, type PlatformKind } from "./wizard.ts";

// ---------------------------------------------------------------------------
// Limits and enums
// ---------------------------------------------------------------------------

export const SEED_LIMITS = {
  reason: 160,
  positioning: 200,
  voiceCue: 60,
  voiceCuesMin: 2,
  voiceCuesMax: 5,
  avoid: 80,
  avoidMax: 5,
  imagery: 200,
  heroAngle: 160,
  painLine: 200,
  painLinesMax: 4,
  step: 140,
  stepsMin: 2,
  stepsMax: 5,
  differentiator: 200,
  quote: 280,
  attribution: 80,
  quotesMax: 3,
  angle: 80,
  hook: 200,
  channel: 40,
  emailAnglesMin: 2,
  emailAnglesMax: 6,
  socialAnglesMin: 3,
  socialAnglesMax: 8,
  stack: 200,
  coreFeature: 1200,
  screen: 80,
  screensMax: 3,
  doNotBuild: 120,
  doNotBuildMax: 6,
  buyerTitle: 60,
  buyerTitlesMax: 5,
  searchTerm: 80,
  searchTermsMax: 10,
  namesMax: 3,
  deviceNeedsMax: 4,
  seedVersion: 40,
} as const;

/**
 * Phone capabilities a core loop can need. Any one makes a native app the
 * suggestion; a loop that needs none ships as a website.
 */
export const DEVICE_NEEDS = [
  "background_location",
  "health_data",
  "camera",
  "push_notifications",
  "offline",
  "bluetooth",
  "daily_phone_habit",
] as const;
export type DeviceNeed = (typeof DEVICE_NEEDS)[number];
export const deviceNeedSchema = z.enum(DEVICE_NEEDS);

/** Words a reason can use for each need. */
export const DEVICE_NEED_LABELS = {
  background_location: "location in the background",
  health_data: "health data",
  camera: "the camera",
  push_notifications: "push notifications",
  offline: "offline use",
  bluetooth: "Bluetooth",
  daily_phone_habit: "a daily habit on the phone",
} as const satisfies Record<DeviceNeed, string>;

/**
 * How sure the seed is. `high` lets the wizard show the step as a quick
 * confirm (owner ruling, 2026-11-07); `low` shows the full choice with the
 * suggestion pre-selected.
 */
export const SEED_CONFIDENCES = ["high", "low"] as const;
export type SeedConfidence = (typeof SEED_CONFIDENCES)[number];
export const seedConfidenceSchema = z.enum(SEED_CONFIDENCES);

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const line = (max: number) => singleLineText(max);
const list = <T extends z.ZodType>(item: T, min: number, max: number) => z.array(item).min(min).max(max);
const reason = line(SEED_LIMITS.reason);

/** A multi-line, trimmed, bounded body: `\n` and `\t` allowed, no other control character. */
const body = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/.test(value), {
      message: "Only \\n and \\t are allowed as control characters",
    });

// ---------------------------------------------------------------------------
// Wizard hints
// ---------------------------------------------------------------------------

export const platformHintSchema = z
  .object({
    deviceNeeds: list(deviceNeedSchema, 0, SEED_LIMITS.deviceNeedsMax).refine(
      (needs) => new Set(needs).size === needs.length,
      "Each device need appears once",
    ),
    confidence: seedConfidenceSchema,
  })
  .strict();

export const commercialModelHintSchema = z
  .object({ value: commercialModelSchema, reason, confidence: seedConfidenceSchema })
  .strict();

export const goalHintSchema = z
  .object({ kind: goalKindSchema, timeframe: goalTimeframeSchema, reason, confidence: seedConfidenceSchema })
  .strict();

export const wizardHintsSchema = z
  .object({
    platform: platformHintSchema,
    commercialModel: commercialModelHintSchema,
    goal: goalHintSchema,
    /** Business names to offer; the first is pre-selected. */
    names: list(line(LIMITS.brandKit.name), 1, SEED_LIMITS.namesMax).refine(
      (names) => new Set(names.map(nameDedupeKey)).size === names.length,
      "Suggested names must differ from each other",
    ),
  })
  .strict();
export type WizardHints = z.infer<typeof wizardHintsSchema>;

// ---------------------------------------------------------------------------
// Crew seeds
// ---------------------------------------------------------------------------

export const brandSeedsSchema = z
  .object({
    positioning: line(SEED_LIMITS.positioning),
    voiceCues: list(line(SEED_LIMITS.voiceCue), SEED_LIMITS.voiceCuesMin, SEED_LIMITS.voiceCuesMax),
    avoid: list(line(SEED_LIMITS.avoid), 0, SEED_LIMITS.avoidMax),
    imagery: line(SEED_LIMITS.imagery),
  })
  .strict();
export type BrandSeeds = z.infer<typeof brandSeedsSchema>;

/**
 * A buyer's words from the idea page's research, quoted exactly (the audit
 * checks it). Input for writing copy in the buyer's own language: never shown
 * as a testimonial, review or proof for the founder's business, which has
 * none yet ("Never fake it", `crewShared.ts`).
 */
export const sourceQuoteSchema = z
  .object({ quote: line(SEED_LIMITS.quote), attribution: line(SEED_LIMITS.attribution) })
  .strict();

export const landingSeedsSchema = z
  .object({
    heroAngle: line(SEED_LIMITS.heroAngle),
    painLines: list(line(SEED_LIMITS.painLine), 1, SEED_LIMITS.painLinesMax),
    howItWorks: list(line(SEED_LIMITS.step), SEED_LIMITS.stepsMin, SEED_LIMITS.stepsMax),
    differentiator: line(SEED_LIMITS.differentiator).optional(),
    buyerWords: list(sourceQuoteSchema, 0, SEED_LIMITS.quotesMax),
  })
  .strict();
export type LandingSeeds = z.infer<typeof landingSeedsSchema>;

export const seedAngleSchema = z
  .object({ angle: line(SEED_LIMITS.angle), hook: line(SEED_LIMITS.hook) })
  .strict();

export const socialAngleSchema = z
  .object({ angle: line(SEED_LIMITS.angle), hook: line(SEED_LIMITS.hook), channel: line(SEED_LIMITS.channel) })
  .strict();

export const emailAnglesSchema = list(seedAngleSchema, SEED_LIMITS.emailAnglesMin, SEED_LIMITS.emailAnglesMax);
export type EmailAngles = z.infer<typeof emailAnglesSchema>;
export const socialAnglesSchema = list(socialAngleSchema, SEED_LIMITS.socialAnglesMin, SEED_LIMITS.socialAnglesMax);
export type SocialAngles = z.infer<typeof socialAnglesSchema>;

export const buildPackSeedsSchema = z
  .object({
    stack: line(SEED_LIMITS.stack),
    coreFeature: body(SEED_LIMITS.coreFeature),
    screens: list(line(SEED_LIMITS.screen), 1, SEED_LIMITS.screensMax),
    doNotBuild: list(line(SEED_LIMITS.doNotBuild), 0, SEED_LIMITS.doNotBuildMax),
  })
  .strict();
export type BuildPackSeeds = z.infer<typeof buildPackSeedsSchema>;

export const roleBriefsSchema = z
  .object({
    outbound: z
      .object({
        buyerTitles: list(line(SEED_LIMITS.buyerTitle), 0, SEED_LIMITS.buyerTitlesMax),
        channels: list(line(SEED_LIMITS.channel), 0, SEED_LIMITS.buyerTitlesMax),
      })
      .strict(),
    /** Search terms only: keyword numbers come from DataForSEO records, never from a model (ruling 38). */
    seo: z.object({ searchTerms: list(line(SEED_LIMITS.searchTerm), 0, SEED_LIMITS.searchTermsMax) }).strict(),
  })
  .strict();
export type RoleBriefs = z.infer<typeof roleBriefsSchema>;

// ---------------------------------------------------------------------------
// The draft (model output) and the stored seed
// ---------------------------------------------------------------------------

/**
 * The library blueprint without the fields the server sets. The seed prompt
 * never asks for a team (roster per idea, WP91), so `team` stays out of the
 * model-facing draft; the stored seed keeps it optional.
 */
export const seedBlueprintDraftSchema = blueprintVariantSchemas.library.omit({
  schemaVersion: true,
  source: true,
  ideaSlug: true,
  team: true,
});
export type SeedBlueprintDraft = z.infer<typeof seedBlueprintDraftSchema>;

const seedDraftShape = {
  blueprint: seedBlueprintDraftSchema,
  wizardHints: wizardHintsSchema,
  brandSeeds: brandSeedsSchema,
  landingSeeds: landingSeedsSchema,
  emailAngles: emailAnglesSchema,
  socialAngles: socialAnglesSchema,
  buildPackSeeds: buildPackSeedsSchema,
  roleBriefs: roleBriefsSchema,
};

/** Every string in a value, depth first. */
export function seedStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(seedStrings);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(seedStrings);
  return [];
}

function noMarketClaims(value: unknown, ctx: z.RefinementCtx): void {
  for (const text of seedStrings(value)) {
    if (hasMarketClaim(text)) {
      ctx.addIssue({ code: "custom", message: "A seed carries no market numbers, prices or keyword data" });
      return;
    }
  }
}

/** What the `crew-idea-seed` prompt returns. */
export const ideaSeedDraftSchema = z.object(seedDraftShape).strict().superRefine(noMarketClaims);
export type IdeaSeedDraft = z.infer<typeof ideaSeedDraftSchema>;

/** A stored seed: the draft with the server-set blueprint fields and `validated`. */
export const ideaCrewSeedSchema = z
  .object({
    ...seedDraftShape,
    blueprint: blueprintVariantSchemas.library,
    validated: z.boolean(),
  })
  .strict()
  .superRefine(noMarketClaims)
  .superRefine((seed, ctx) => {
    if (!seed.validated && seed.blueprint.market !== undefined) {
      ctx.addIssue({ code: "custom", path: ["blueprint", "market"], message: "An unvalidated seed has no market block" });
    }
  });
export type IdeaCrewSeed = z.infer<typeof ideaCrewSeedSchema>;

/**
 * The research levels that count as validated. `concept` ideas and ideas whose
 * audit did not pass are "Not yet validated" (owner ruling, 2026-11-07).
 */
export const VALIDATED_RESEARCH_LEVELS = ["deep", "standard", "summary"] as const;

export type IdeaValidationFacts = {
  readonly researchLevel?: string | null;
  /** `provenance.auditPassed` from the idea row, when it records one. */
  readonly auditPassed?: boolean | null;
};

/**
 * Whether a library idea counts as validated: a researched level and no
 * recorded audit failure. An idea with no research level is a legacy
 * researched row and counts as validated, as it did before WP90.
 */
export function ideaIsValidated(facts: IdeaValidationFacts): boolean {
  if (facts.auditPassed === false) return false;
  const level = facts.researchLevel ?? null;
  if (level === null || level === "") return true;
  return (VALIDATED_RESEARCH_LEVELS as readonly string[]).includes(level);
}

/** The draft plus the server's fields; throws when the result is not a valid seed. */
export function seedFromDraft(
  draft: IdeaSeedDraft,
  facts: { readonly ideaSlug: string } & IdeaValidationFacts,
): IdeaCrewSeed {
  const validated = ideaIsValidated(facts);
  const { market, ...rest } = draft.blueprint;
  const blueprint = {
    ...rest,
    ...(validated && market !== undefined ? { market } : {}),
    schemaVersion: 1 as const,
    source: "library" as const,
    ideaSlug: facts.ideaSlug,
  };
  return ideaCrewSeedSchema.parse({ ...draft, blueprint, validated });
}

// ---------------------------------------------------------------------------
// Platform rule
// ---------------------------------------------------------------------------

export type PlatformSuggestion = {
  readonly kind: Extract<PlatformKind, "native" | "web">;
  readonly reason: string;
};

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Any device need → a native app, with the needs named; none → a website. Pure. */
export function platformSuggestion(deviceNeeds: readonly DeviceNeed[]): PlatformSuggestion {
  const unique = DEVICE_NEEDS.filter((need) => deviceNeeds.includes(need));
  if (unique.length === 0) {
    return { kind: "web", reason: "Nothing here needs a phone app, so people use it in their browser." };
  }
  return { kind: "native", reason: `It needs ${joinWords(unique.map((need) => DEVICE_NEED_LABELS[need]))}, so a phone app.` };
}

// ---------------------------------------------------------------------------
// Reading a stored row
// ---------------------------------------------------------------------------

/** The `idea_crew_seeds` columns a seed is stored in. */
export type IdeaCrewSeedColumns = {
  readonly blueprint: unknown;
  readonly wizardHints?: unknown;
  readonly brandSeeds: unknown;
  readonly landingSeeds: unknown;
  readonly emailAngles: unknown;
  readonly socialAngles: unknown;
  readonly buildPackSeeds: unknown;
  readonly roleBriefs?: unknown;
  readonly validated?: unknown;
};

/**
 * The full seed from a row's columns, or null when the row is not a complete
 * WP90 seed for this idea (rows are `v.any()`; a pre-WP90 row with only a
 * blueprint is read by `crewSeedFor` as before, never here).
 */
export function seedFromColumns(ideaSlug: string, row: IdeaCrewSeedColumns): IdeaCrewSeed | null {
  const parsed = ideaCrewSeedSchema.safeParse({
    blueprint: row.blueprint,
    wizardHints: row.wizardHints,
    brandSeeds: row.brandSeeds,
    landingSeeds: row.landingSeeds,
    emailAngles: row.emailAngles,
    socialAngles: row.socialAngles,
    buildPackSeeds: row.buildPackSeeds,
    roleBriefs: row.roleBriefs,
    validated: row.validated,
  });
  if (!parsed.success || parsed.data.blueprint.ideaSlug !== ideaSlug) return null;
  return parsed.data;
}

/** The typed columns of a stored seed. */
export type IdeaCrewSeedRow = {
  readonly blueprint: Blueprint;
  readonly wizardHints: WizardHints;
  readonly brandSeeds: BrandSeeds;
  readonly landingSeeds: LandingSeeds;
  readonly emailAngles: EmailAngles;
  readonly socialAngles: SocialAngles;
  readonly buildPackSeeds: BuildPackSeeds;
  readonly roleBriefs: RoleBriefs;
  readonly validated: boolean;
};

/** The stored columns for a seed (the inverse of `seedFromColumns`). */
export function seedColumns(seed: IdeaCrewSeed): IdeaCrewSeedRow {
  return {
    blueprint: seed.blueprint,
    wizardHints: seed.wizardHints,
    brandSeeds: seed.brandSeeds,
    landingSeeds: seed.landingSeeds,
    emailAngles: seed.emailAngles,
    socialAngles: seed.socialAngles,
    buildPackSeeds: seed.buildPackSeeds,
    roleBriefs: seed.roleBriefs,
    validated: seed.validated,
  };
}

export type { CommercialModel, GoalKind, GoalTimeframe };
