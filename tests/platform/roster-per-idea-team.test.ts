/**
 * Roster per idea S3 (WP90): the blueprint's team proposal is cleaned before
 * it is stored and before it is planned from, so a bad entry falls back to the
 * rules and never blocks the blueprint or the launch.
 */
import { describe, expect, test } from "vitest";

import { planRoster } from "@/convex/crew/roles";
import { blueprintSchema, type BlueprintTeamEntry } from "@/lib/workspace/contracts/artifacts";
import { hydrotrailBlueprint, hydrotrailRosterPlan, hydrotrailWizardAnswers, ownIdeaLightBlueprint } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { LEGACY_ALWAYS_HIRED_ROLE_KEYS, LEGACY_ROSTER_RULES_VERSIONS, rosterPlanSchema } from "@/lib/workspace/contracts/roster";
import { partnerNameFromWizard, rosterInputFromWizard } from "@/lib/workspace/contracts/wizard";
import { gateCrewArtifact } from "@/lib/workspace/crew/quality";
import { cleanTeamProposal } from "@/lib/workspace/crew/teamProposal";

const LIBRARY = { ownIdea: false } as const;
const OWN = { ownIdea: true } as const;

describe("cleanTeamProposal", () => {
  test("keeps clean optional-role decisions, in catalogue order", () => {
    const team: BlueprintTeamEntry[] = [
      { roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" },
      { roleKey: "seo", hire: false, reason: "Hikers find trail tools through friends" },
    ];
    expect(cleanTeamProposal(team, LIBRARY)).toEqual([
      { roleKey: "seo", hire: false, reason: "Hikers find trail tools through friends" },
      { roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" },
    ]);
  });

  test("undefined stays undefined, so an older blueprint keeps the rules", () => {
    expect(cleanTeamProposal(undefined, LIBRARY)).toBeUndefined();
    expect(cleanTeamProposal([], LIBRARY)).toEqual([]);
  });

  test("drops core roles, unknown roles and roles answered twice", () => {
    const team: BlueprintTeamEntry[] = [
      { roleKey: "brand", hire: false, reason: "Skip brand" },
      { roleKey: "lead", hire: false, reason: "Skip lead" },
      { roleKey: "growth_hacker", hire: true, reason: "Unknown role" },
      { roleKey: "merch", hire: true, reason: "Printed maps" },
      { roleKey: "merch", hire: false, reason: "No merch" },
      { roleKey: "community", hire: true, reason: "A trail group keeps hikers coming back" },
    ];
    expect(cleanTeamProposal(team, LIBRARY)).toEqual([
      { roleKey: "community", hire: true, reason: "A trail group keeps hikers coming back" },
    ]);
  });

  test("drops reasons that are too long, multi-line, links or invented proof", () => {
    const team: BlueprintTeamEntry[] = [
      { roleKey: "landing", hire: true, reason: "x".repeat(161) },
      { roleKey: "seo", hire: true, reason: "Line one\nLine two" },
      { roleKey: "marketing", hire: true, reason: "See https://example.com for the plan" },
      { roleKey: "engineering", hire: true, reason: "Trusted by 10,000 hikers already" },
      { roleKey: "outbound", hire: false, reason: "   " },
      { roleKey: "merch", hire: false, reason: "An app; nothing physical to sell" },
    ];
    expect(cleanTeamProposal(team, LIBRARY)).toEqual([
      { roleKey: "merch", hire: false, reason: "An app; nothing physical to sell" },
    ]);
  });

  test("an own idea's reason may not carry a market number (D15)", () => {
    const team: BlueprintTeamEntry[] = [{ roleKey: "seo", hire: true, reason: "The market for packing apps grows 30% a year" }];
    expect(cleanTeamProposal(team, OWN)).toEqual([]);
  });
});

describe("the quality gate stores only clean decisions", () => {
  test("a library blueprint with a messy team still passes, with the bad entries dropped", () => {
    const team: BlueprintTeamEntry[] = [
      { roleKey: "brand", hire: false, reason: "Skip brand" },
      { roleKey: "seo", hire: false, reason: "Trusted by 10,000 hikers already" },
      { roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" },
    ];
    const gated = gateCrewArtifact("blueprint", { ...hydrotrailBlueprint, team }, { ownIdea: false, ideaSlug: "hydrotrail" });
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact?.team).toEqual([{ roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" }]);
  });

  test("an own-idea blueprint with a market number in a reason is not blocked; the entry is dropped", () => {
    const team: BlueprintTeamEntry[] = [
      { roleKey: "seo", hire: true, reason: "The market for packing apps grows 30% a year" },
      { roleKey: "merch", hire: false, reason: "Nothing physical to sell" },
    ];
    const gated = gateCrewArtifact("blueprint", { ...ownIdeaLightBlueprint, team }, { ownIdea: true });
    expect(gated.result.hard).toEqual([]);
    expect(gated.artifact?.team).toEqual([{ roleKey: "merch", hire: false, reason: "Nothing physical to sell" }]);
  });

  test("a blueprint without a team stays without one", () => {
    const gated = gateCrewArtifact("blueprint", hydrotrailBlueprint, { ownIdea: false, ideaSlug: "hydrotrail" });
    expect(gated.artifact).not.toBeNull();
    expect(gated.artifact?.team).toBeUndefined();
  });
});

describe("rosterInputFromWizard", () => {
  test("passes the cleaned proposal to the roster", () => {
    const blueprint = blueprintSchema.parse({
      ...hydrotrailBlueprint,
      team: [
        { roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" },
        { roleKey: "seo", hire: true, reason: "x".repeat(300) },
      ],
    });
    const input = rosterInputFromWizard(hydrotrailWizardAnswers, blueprint);
    expect(input.proposal).toEqual([{ roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" }]);
    const plan = planRoster(input, { leadName: partnerNameFromWizard(hydrotrailWizardAnswers) });
    expect(plan.hired.find((h) => h.roleKey === "outbound")?.decidedBy).toBe("lead");
    expect(plan.hired.find((h) => h.roleKey === "seo")?.decidedBy).toBeUndefined();
  });

  test("without a team block there is no proposal", () => {
    expect(rosterInputFromWizard(hydrotrailWizardAnswers, hydrotrailBlueprint).proposal).toBeUndefined();
  });
});

describe("stored plans keep the always set of their own rules version", () => {
  const legacyAlways = new Set<string>(LEGACY_ALWAYS_HIRED_ROLE_KEYS);
  const asLegacy = { ...hydrotrailRosterPlan, rulesVersion: LEGACY_ROSTER_RULES_VERSIONS[0] };
  const withLegacyFlags = (plan: typeof hydrotrailRosterPlan) => ({
    ...plan,
    hired: plan.hired.map((entry) => ({ ...entry, always: legacyAlways.has(entry.roleKey) })),
  });

  test("a pre-WP90 plan (eight always roles) still parses", () => {
    expect(rosterPlanSchema.safeParse(withLegacyFlags(asLegacy)).success).toBe(true);
  });

  test("a pre-WP90 plan may not mark only the new core as always", () => {
    expect(rosterPlanSchema.safeParse(asLegacy).success).toBe(false);
  });

  test("a current plan uses the four-role core", () => {
    expect(rosterPlanSchema.safeParse(hydrotrailRosterPlan).success).toBe(true);
    expect(rosterPlanSchema.safeParse(withLegacyFlags(hydrotrailRosterPlan)).success).toBe(false);
  });
});
