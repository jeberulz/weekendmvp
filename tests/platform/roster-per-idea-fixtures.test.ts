/**
 * Roster per idea S4 (WP90): the blueprint prompts (version 2) ask the model
 * for a team, and the fixture client answers with a team that fits the idea's
 * own words, so a local fixture run gives different ideas different crews
 * with zero AI spend.
 */
import { describe, expect, test } from "vitest";

import { outputJsonSchema } from "@/convex/ai/gateway";
import { blueprintOwnIdeaSpec } from "@/convex/ai/prompts/blueprintOwnIdea.v2";
import { blueprintPersonaliseSpec } from "@/convex/ai/prompts/blueprintPersonalise.v2";
import { TEAM_ROLE_LINES } from "@/convex/ai/prompts/teamShared";
import type { AnthropicMessagesClient } from "@/convex/ai/providers/anthropic";
import { createFixtureOutputRegistry } from "@/convex/ai/providers/fixtureOutputs";
import { ROLE_CATALOGUE, planRoster } from "@/convex/crew/roles";
import { blueprintSchema, blueprintTeamVariantSchemas, type Blueprint } from "@/lib/workspace/contracts/artifacts";
import {
  FIXTURE_TEAM_PROFILE_KEYS,
  FIXTURE_TEAM_PROFILES,
  fixtureTeamProfileFor,
} from "@/lib/workspace/contracts/fixtures/teamProfiles";
import { hydrotrailWizardAnswers } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { TIER_MODELS } from "@/lib/workspace/contracts/prompts";
import { OPTIONAL_ROLE_KEYS } from "@/lib/workspace/contracts/roster";
import { partnerNameFromWizard, rosterInputFromWizard } from "@/lib/workspace/contracts/wizard";
import { gateCrewArtifact } from "@/lib/workspace/crew/quality";
import { cleanTeamProposal } from "@/lib/workspace/crew/teamProposal";

type MessageParams = Parameters<AnthropicMessagesClient["messages"]["create"]>[0];

const ANSWERS = JSON.stringify(hydrotrailWizardAnswers);

function libraryParams(idea: Record<string, unknown>): MessageParams {
  return {
    model: TIER_MODELS[blueprintPersonaliseSpec.tier],
    max_tokens: blueprintPersonaliseSpec.maxTokens,
    system: [{ type: "text", text: blueprintPersonaliseSpec.system }],
    messages: [
      { role: "user", content: blueprintPersonaliseSpec.buildUser({ seed: null, idea: JSON.stringify(idea), answers: ANSWERS }) },
    ],
    output_config: { format: { type: "json_schema", schema: outputJsonSchema(blueprintPersonaliseSpec.outputSchema) } },
  };
}

function ownIdeaParams(ownIdea: string): MessageParams {
  return {
    model: TIER_MODELS[blueprintOwnIdeaSpec.tier],
    max_tokens: blueprintOwnIdeaSpec.maxTokens,
    system: [{ type: "text", text: blueprintOwnIdeaSpec.system }],
    messages: [{ role: "user", content: blueprintOwnIdeaSpec.buildUser({ ownIdea, outline: null, answers: ANSWERS }) }],
    output_config: { format: { type: "json_schema", schema: outputJsonSchema(blueprintOwnIdeaSpec.outputSchema) } },
  };
}

const registry = createFixtureOutputRegistry();

/** The fixture reply for a request, as the blueprint the model "returned". */
function reply(request: MessageParams): Blueprint {
  return blueprintSchema.parse(registry.outputFor(request));
}

/** The optional roles the roster hires for a blueprint, with wizard answers that point at the same idea. */
function hiredOptional(blueprint: Blueprint): string[] {
  const idea =
    blueprint.source === "own_idea"
      ? { source: "own_idea" as const, text: "The founder's own idea" }
      : { source: "library" as const, ideaSlug: blueprint.ideaSlug };
  const input = rosterInputFromWizard({ ...hydrotrailWizardAnswers, idea }, blueprint);
  const plan = planRoster(input, { leadName: partnerNameFromWizard(hydrotrailWizardAnswers) });
  return plan.hired.map((h) => h.roleKey).filter((key) => (OPTIONAL_ROLE_KEYS as readonly string[]).includes(key));
}

describe("the team block the prompts describe", () => {
  test("each role line matches the catalogue's label and job", () => {
    const expected = OPTIONAL_ROLE_KEYS.map((key) => {
      const entry = ROLE_CATALOGUE.find((role) => role.key === key);
      return `${key}: ${entry?.label}. ${entry?.does}`;
    });
    expect([...TEAM_ROLE_LINES]).toEqual(expected);
  });

  test("both blueprint prompts carry the team rules and the team schema", () => {
    for (const spec of [blueprintPersonaliseSpec, blueprintOwnIdeaSpec]) {
      expect(spec.version).toBe(2);
      expect(spec.system).toContain("smallest team");
      for (const line of TEAM_ROLE_LINES) expect(spec.system).toContain(line);
    }
    expect(blueprintPersonaliseSpec.outputSchema).toBe(blueprintTeamVariantSchemas.library);
    expect(blueprintOwnIdeaSpec.outputSchema).toBe(blueprintTeamVariantSchemas.own_idea);
  });
});

describe("fixture team profiles", () => {
  test.each(FIXTURE_TEAM_PROFILE_KEYS)("%s decides every optional role once, cleanly", (key) => {
    const { team } = FIXTURE_TEAM_PROFILES[key];
    expect(team.map((entry) => entry.roleKey)).toEqual([...OPTIONAL_ROLE_KEYS]);
    expect(cleanTeamProposal(team, { ownIdea: true })).toEqual(team);
    expect(cleanTeamProposal(team, { ownIdea: false })).toEqual(team);
  });

  test("the classifier reads the idea's own words", () => {
    expect(fixtureTeamProfileFor("An AI receptionist that answers calls for dental clinics")).toBe("b2b_software");
    expect(fixtureTeamProfileFor("A six-week cohort course teaching product design")).toBe("course");
    expect(fixtureTeamProfileFor("Hand-poured soy candles sold online")).toBe("physical_product");
    expect(fixtureTeamProfileFor("Mobile dog grooming in my town")).toBe("local_service");
    expect(fixtureTeamProfileFor("PostureUp: a phone app that nudges you to sit up straight")).toBe("consumer_app");
  });
});

describe("the fixture blueprint reply", () => {
  test("an own idea gets a blueprint that passes the gate, with a team that fits it", () => {
    const output = reply(ownIdeaParams("An AI receptionist that answers calls for dental clinics"));
    const gated = gateCrewArtifact("blueprint", output, { ownIdea: true });
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact?.team).toEqual(FIXTURE_TEAM_PROFILES.b2b_software.team);
    expect(gated.artifact?.profile?.buyer).toBe("business");
    expect(hiredOptional(gated.artifact ?? output)).toContain("outbound");
  });

  test("an own idea that parses as JSON is still read as the founder's text", () => {
    const output = reply(ownIdeaParams("42"));
    const gated = gateCrewArtifact("blueprint", output, { ownIdea: true });
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact?.source).toBe("own_idea");
  });

  test("a library course keeps its slug and hires Curriculum and Community", () => {
    const idea = { slug: "cohort-design-course", title: "Design Cohort", description: "A cohort course teaching product design" };
    const output = reply(libraryParams(idea));
    const gated = gateCrewArtifact("blueprint", output, { ownIdea: false, ideaSlug: idea.slug });
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact?.source === "library" ? gated.artifact.ideaSlug : null).toBe(idea.slug);
    const hired = hiredOptional(gated.artifact ?? output);
    expect(hired).toEqual(expect.arrayContaining(["curriculum", "community"]));
    expect(hired).not.toContain("seo");
  });

  test("HydroTrail keeps its own profile and gets the consumer-app team", () => {
    const idea = { slug: "hydrotrail", title: "HydroTrail", description: "A hydration planner for solo hikers" };
    const output = reply(libraryParams(idea));
    const gated = gateCrewArtifact("blueprint", output, { ownIdea: false, ideaSlug: "hydrotrail" });
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact?.team).toEqual(FIXTURE_TEAM_PROFILES.consumer_app.team);
    expect(hiredOptional(gated.artifact ?? output)).not.toContain("outbound");
  });

  test("two different ideas get two different teams", () => {
    const receptionist = reply(ownIdeaParams("An AI receptionist for small businesses"));
    const candles = reply(ownIdeaParams("Hand-poured candles shipped to your door"));
    const a = gateCrewArtifact("blueprint", receptionist, { ownIdea: true }).artifact ?? receptionist;
    const b = gateCrewArtifact("blueprint", candles, { ownIdea: true }).artifact ?? candles;
    expect(hiredOptional(a)).not.toEqual(hiredOptional(b));
  });
});
