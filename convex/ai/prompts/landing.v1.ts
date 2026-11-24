import { definePromptSpec } from "../../../lib/workspace/contracts/prompts.ts";
import { artifactOutputSchemas, type LandingSpecDraft } from "../../../lib/workspace/contracts/artifacts.ts";
import { CREW_SYSTEM_RULES, REVISION_INSTRUCTION, dataBlock, revisionBlocks } from "./crewShared.ts";

type LandingInput = {
  blueprint: string; brandKit: string; layouts: string; research: string | null; irisAnswer: string;
  previousArtifact?: string | null; revisionNote?: string | null;
};

export const landingSpecPrompt = definePromptSpec<LandingInput, LandingSpecDraft>({
  id: "crew-landing", version: 1, tier: "draft", effort: "low", thinking: { type: "between_tools" },
  maxTokens: 6_144, outputMode: "prompted",
  system: [
    ...CREW_SYSTEM_RULES,
    "You are Leo, the landing-page specialist. Draft a private landing page for the audience, use scene and first goal in the approved blueprint. Use the approved brand's voice, typography, visual direction, product moment and name exactly where relevant.",
    "Read Iris's recorded recommendation. Select a layout per section from the provided allowed variants for this brand. Choose based on what this visitor needs to understand or do first. Use optional sections only when their contents make the product clearer.",
    "Direct the primary CTA to #waitlist. Include a waitlist with a success message asking the visitor to confirm their email. Deliver concrete copy and truthful image descriptions. Use only registered icon IDs. Do not claim that imagery, proof, research or testimonials exist unless supplied. Never output proof slots. Use an emphasis substring only when it appears verbatim in the headline.",
    "Use vetted research as background, never as proof of this founder’s own traction. Return the complete draft as JSON.",
  ].join("\n"),
  buildUser: (inputs) => [
    dataBlock("blueprint", "Approved audience, problem, product and launch goal.", inputs.blueprint),
    dataBlock("brand_kit", "Approved brand kit, with visual direction, type pair, palette and voice.", inputs.brandKit),
    dataBlock("layout_options", "Allowed section layouts for this art direction.", inputs.layouts),
    ...(inputs.research ? [dataBlock("idea_research", "Vetted idea seed for this project, if available.", inputs.research)] : []),
    dataBlock("iris_handoff", "Iris's saved design recommendation for this exact blueprint and brand.", inputs.irisAnswer),
    ...revisionBlocks(inputs), ...(inputs.previousArtifact ? [REVISION_INSTRUCTION] : []),
  ].join("\n"),
  outputSchema: artifactOutputSchemas.landing_spec,
  cacheLayout: { system: "stable", business: "per_business", ttl: "5m" }, evalSuite: "crew-landing", mode: "realtime", fallbacks: "none",
});
