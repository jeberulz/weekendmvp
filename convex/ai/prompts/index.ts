/**
 * WP71-S3. Every registered prompt spec (`02` §5.3). Add a spec here with its
 * module path and sample inputs; `convex/ai/registry.ts` builds the registry
 * from this list, and `scripts/check-prompt-versions.mjs` locks each
 * `id@version`.
 *
 * `module` is the repo-relative path of the file that defines the spec, and
 * the entry must register that module's exported spec object unchanged (the
 * script checks every field). The lock hashes that file and every repo-local
 * module it imports at runtime (not `node_modules`, not
 * `lib/workspace/contracts/prompts.ts`), so a locked version's module is
 * frozen. Keep each version in its own module (`brandKit.v1.ts`,
 * `brandKit.v2.ts`) when an old one must stay registered.
 *
 * Dependency bumps count too: the `outputSchema` part is zod's
 * `toJSONSchema` output, so a zod upgrade that changes it (and a C-PROMPT
 * change to `TIER_MODELS` or a ceiling, through the `run` part) fails every
 * locked prompt it touches and forces a version bump of each.
 *
 * Retiring a version: remove its entry here and add a `retired` note to its
 * lock entry.
 */

import { blueprintOwnIdeaSpec } from "./blueprintOwnIdea.v2.ts";
import { blueprintPersonaliseSpec } from "./blueprintPersonalise.v2.ts";
import { brandKitSpec } from "./brandKit.v2.ts";
import { emailSequenceSpec } from "./emailSequence.v2.ts";
import { ideaSeedSpec } from "./ideaSeed.v1.ts";
import { promptEntry, type PromptEntry } from "./entry.ts";
import { registryProbeSpec } from "./registryProbe.ts";
import { socialPackSpec } from "./socialPack.v2.ts";
import { wrenChatSpec } from "./wrenChat.ts";
import { wrenPlanTurnSpec } from "./wrenPlanTurn.ts";

const WREN_SAMPLE = {
  message: "Can we move the launch email to Sunday morning?",
  history: ["founder: The brand kit looks good.", "wren: Great. The landing page is next."],
} as const;

/** WP75-S3a sample answers (the shape `lib/workspace/crew/inputs.ts` sends). */
const CREW_SAMPLE_ANSWERS = JSON.stringify({
  platform: { kind: "web" },
  commercialModel: "free",
  goal: { kind: "waitlist", timeframe: "weekend" },
  name: { chosen: "HydroTrail", alternatives: ["SipLine"] },
});

export const PROMPT_ENTRIES: readonly PromptEntry[] = Object.freeze([
  promptEntry(registryProbeSpec, {
    module: "convex/ai/prompts/registryProbe.ts",
    sampleInputs: { label: "registry probe sample" },
    internal: true,
  }),
  promptEntry(wrenChatSpec, { module: "convex/ai/prompts/wrenChat.ts", sampleInputs: WREN_SAMPLE }),
  promptEntry(wrenPlanTurnSpec, { module: "convex/ai/prompts/wrenPlanTurn.ts", sampleInputs: WREN_SAMPLE }),
  promptEntry(blueprintPersonaliseSpec, {
    module: "convex/ai/prompts/blueprintPersonalise.v2.ts",
    sampleInputs: {
      seed: null,
      idea: JSON.stringify({ slug: "hydrotrail", title: "HydroTrail", description: "A hydration planner for solo hikers." }),
      answers: CREW_SAMPLE_ANSWERS,
    },
  }),
  promptEntry(blueprintOwnIdeaSpec, {
    module: "convex/ai/prompts/blueprintOwnIdea.v2.ts",
    sampleInputs: {
      ownIdea: "A packing checklist that adapts to the weather forecast for weekend campers.",
      outline: null,
      answers: CREW_SAMPLE_ANSWERS,
    },
  }),
  promptEntry(brandKitSpec, {
    module: "convex/ai/prompts/brandKit.v2.ts",
    sampleInputs: {
      blueprint: JSON.stringify({ source: "library", ideaSlug: "hydrotrail", pitch: "A hydration planner for solo hikers." }),
      answers: CREW_SAMPLE_ANSWERS,
      design: JSON.stringify({ productType: "Micro SaaS", palettes: [], typePairs: [], landingPattern: { id: "minimal-single-column" } }),
      ideaAngles: JSON.stringify({ positioning: "Water planning for solo hikers.", voiceCues: ["Calm", "Practical"], avoid: [], imagery: "A bottle on a ridge." }),
    },
  }),
  promptEntry(emailSequenceSpec, {
    module: "convex/ai/prompts/emailSequence.v2.ts",
    sampleInputs: {
      blueprint: JSON.stringify({ source: "library", ideaSlug: "hydrotrail", pitch: "A hydration planner for solo hikers." }),
      brand: JSON.stringify({ name: "HydroTrail", tagline: "Drink before you're thirsty.", voice: { traits: ["Calm", "Practical"] } }),
      answers: CREW_SAMPLE_ANSWERS,
      ideaAngles: JSON.stringify({ emailAngles: [{ angle: "Running dry", hook: "The last climb is the thirsty one." }], buyerWords: [] }),
    },
  }),
  promptEntry(ideaSeedSpec, {
    module: "convex/ai/prompts/ideaSeed.v1.ts",
    sampleInputs: {
      source: JSON.stringify({
        slug: "hydrotrail",
        title: "HydroTrail",
        description: "A hydration planner for solo hikers.",
        audiences: ["hikers"],
        sections: { problem: "Hikers run dry on long, hot routes.", solution: "Plan litres to carry from the route." },
        howItWorks: ["Enter your route", "Get litres to carry"],
        buildPrompts: [],
      }),
    },
  }),
  promptEntry(socialPackSpec, {
    module: "convex/ai/prompts/socialPack.v2.ts",
    sampleInputs: {
      blueprint: JSON.stringify({ source: "library", ideaSlug: "hydrotrail", pitch: "A hydration planner for solo hikers." }),
      brand: JSON.stringify({ name: "HydroTrail", tagline: "Drink before you're thirsty.", voice: { traits: ["Calm", "Practical"] } }),
      ideaAngles: JSON.stringify({ socialAngles: [{ angle: "Running dry", hook: "The last climb is the thirsty one.", channel: "Instagram" }], buyerWords: [] }),
    },
  }),
]);
