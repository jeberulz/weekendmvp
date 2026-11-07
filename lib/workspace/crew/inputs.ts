/**
 * WP75-S3a — the prompt inputs for the blueprint and brand kit steps, built on
 * the server from rows the server read (never from client arguments). Pure: no
 * Convex imports, relative imports only (the Convex bundler loads this file).
 *
 * - The prompt is chosen by the business's source: a library idea gets
 *   `crew-blueprint-personalise@1`, an own idea `crew-blueprint-own-idea@1`
 *   (D15, "Not yet validated").
 * - The seed: `idea_crew_seeds` when a row parses as a library blueprint for
 *   this idea; the HydroTrail fixture seed for its slug until WP71-S5 has run;
 *   otherwise none (the library idea record carries the facts).
 * - The brand kit reads the stored blueprint, the founder's answers and the
 *   Pro Max design candidates for the blueprint (`design/proMax.ts`), worked
 *   out here before the call (no tool loop, D23).
 * - WP76-S1a: the email sequence reads the blueprint, the brand kit's name,
 *   tagline and voice (never its palette or art), and the founder's answers.
 * - Every value is a string the spec quotes as data (`convex/ai/prompts/crewShared.ts`).
 */

import { blueprintSchema, type Blueprint, type BrandKit } from "../contracts/artifacts";
import { hydrotrailBlueprint } from "../contracts/fixtures/hydrotrail";
import type { WizardAnswers } from "../contracts/wizard";
import { HYDROTRAIL_SLUG } from "../wizard/defaults";
import { ownIdeaBlueprintPreview } from "../wizard/light-blueprint";
import { designCandidatesFor, type DesignCandidates } from "./design/proMax";

export const BLUEPRINT_LIBRARY_PROMPT_REF = "crew-blueprint-personalise@1";
export const BLUEPRINT_OWN_IDEA_PROMPT_REF = "crew-blueprint-own-idea@1";
export const BRAND_KIT_PROMPT_REF = "crew-brand-kit@1";
export const EMAIL_SEQUENCE_PROMPT_REF = "crew-email-sequence@1";

export type CrewPromptInputs = Record<string, string | null>;

export type CrewSeedSource = "idea_crew_seeds" | "fixture_hydrotrail" | "none";

export type CrewSeed = { readonly source: CrewSeedSource; readonly blueprint: Blueprint | null };

/**
 * Seed versions compared with numbers as numbers ("v10" after "v9",
 * "2026-11-06.10" after "2026-11-06.9"), not as text. Pure, no `Intl`.
 */
export function compareSeedVersions(a: string, b: string): number {
  const chunks = (value: string): string[] => value.match(/\d+|\D+/gu) ?? [];
  const left = chunks(a);
  const right = chunks(b);
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const x = left[i] ?? "";
    const y = right[i] ?? "";
    if (x === y) continue;
    if (/^\d/u.test(x) && /^\d/u.test(y)) {
      const xs = x.replace(/^0+(?=\d)/u, "");
      const ys = y.replace(/^0+(?=\d)/u, "");
      if (xs.length !== ys.length) return xs.length < ys.length ? -1 : 1;
      if (xs !== ys) return xs < ys ? -1 : 1;
      continue;
    }
    return x < y ? -1 : 1;
  }
  return left.length - right.length;
}

/**
 * The platform seed to use: rows written by WP71-S5 for the idea itself
 * (`projectId` unset), newest `seedVersion` first by `compareSeedVersions`.
 * A row tied to one business is never another business's seed.
 */
export function newestPlatformSeed<R extends { readonly projectId?: unknown; readonly seedVersion: string }>(rows: readonly R[]): R | null {
  let best: R | null = null;
  for (const row of rows) {
    if (row.projectId !== undefined) continue;
    if (best === null || compareSeedVersions(row.seedVersion, best.seedVersion) > 0) best = row;
  }
  return best;
}

/**
 * The seed blueprint for a library idea. A stored seed is used only when it
 * parses as a library blueprint for the same slug (seeds are `v.any()`); any
 * other stored value is ignored rather than sent to the model.
 */
export function crewSeedFor(ideaSlug: string, storedBlueprint: unknown): CrewSeed {
  if (storedBlueprint !== undefined && storedBlueprint !== null) {
    const parsed = blueprintSchema.safeParse(storedBlueprint);
    if (parsed.success && parsed.data.source === "library" && parsed.data.ideaSlug === ideaSlug) {
      return { source: "idea_crew_seeds", blueprint: parsed.data };
    }
  }
  if (ideaSlug === HYDROTRAIL_SLUG) return { source: "fixture_hydrotrail", blueprint: hydrotrailBlueprint };
  return { source: "none", blueprint: null };
}

/** The founder's choices a generator reads: never the idea itself (it has its own block). */
export function answersForPrompt(answers: WizardAnswers): Record<string, unknown> {
  return {
    platform: answers.platform,
    commercialModel: answers.commercialModel,
    goal: answers.goal,
    name: answers.name,
    partnerPersonality: answers.partnerPersonality,
    ...(answers.signals === undefined ? {} : { signals: answers.signals }),
  };
}

/** The library idea fields a blueprint may use (published content; still quoted as data). */
export type LibraryIdeaRecord = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly summary?: string;
  readonly category?: string;
  readonly audiences?: readonly string[];
};

export type BlueprintStepPlan = { readonly promptRef: string; readonly inputs: CrewPromptInputs; readonly seedSource: CrewSeedSource | null };

/** The blueprint step's prompt and inputs for a library idea or an own idea. */
export function blueprintStepPlan(
  input:
    | { readonly source: "library"; readonly answers: WizardAnswers; readonly idea: LibraryIdeaRecord; readonly seed: CrewSeed }
    | { readonly source: "own_idea"; readonly answers: WizardAnswers; readonly ownIdeaText: string },
): BlueprintStepPlan {
  const answers = JSON.stringify(answersForPrompt(input.answers));
  if (input.source === "own_idea") {
    const outline = ownIdeaBlueprintPreview(input.ownIdeaText).blueprint;
    return {
      promptRef: BLUEPRINT_OWN_IDEA_PROMPT_REF,
      inputs: { ownIdea: input.ownIdeaText, outline: JSON.stringify(outline), answers },
      seedSource: null,
    };
  }
  const { idea } = input;
  return {
    promptRef: BLUEPRINT_LIBRARY_PROMPT_REF,
    inputs: {
      seed: input.seed.blueprint === null ? null : JSON.stringify(input.seed.blueprint),
      idea: JSON.stringify({
        slug: idea.slug,
        title: idea.title,
        description: idea.description,
        ...(idea.summary === undefined ? {} : { summary: idea.summary }),
        ...(idea.category === undefined ? {} : { category: idea.category }),
        ...(idea.audiences === undefined ? {} : { audiences: [...idea.audiences] }),
      }),
      answers,
    },
    seedSource: input.seed.source,
  };
}

export type BrandKitStepPlan = { readonly promptRef: string; readonly inputs: CrewPromptInputs; readonly design: DesignCandidates };

/** The brand kit step's inputs: the stored blueprint, the founder's answers and the design candidates. */
export function brandKitStepPlan(input: { readonly answers: WizardAnswers; readonly blueprint: Blueprint }): BrandKitStepPlan {
  const design = designCandidatesFor(input.blueprint);
  return {
    promptRef: BRAND_KIT_PROMPT_REF,
    inputs: {
      blueprint: JSON.stringify(input.blueprint),
      answers: JSON.stringify(answersForPrompt(input.answers)),
      design: JSON.stringify({
        productType: design.productType,
        palettes: design.palettes,
        typePairs: design.typePairs,
        landingPattern: design.landingPattern,
      }),
    },
    design,
  };
}

export type EmailSequenceStepPlan = { readonly promptRef: string; readonly inputs: CrewPromptInputs };

/** WP76-S1a: the email sequence step's inputs: the blueprint, the brand kit's name and voice, the founder's answers. */
export function emailSequenceStepPlan(input: {
  readonly answers: WizardAnswers;
  readonly blueprint: Blueprint;
  readonly brandKit: BrandKit;
}): EmailSequenceStepPlan {
  const { brandKit } = input;
  return {
    promptRef: EMAIL_SEQUENCE_PROMPT_REF,
    inputs: {
      blueprint: JSON.stringify(input.blueprint),
      brand: JSON.stringify({ name: brandKit.name, tagline: brandKit.tagline.text, voice: brandKit.voice }),
      answers: JSON.stringify(answersForPrompt(input.answers)),
    },
  };
}
