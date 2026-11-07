// @vitest-environment node
import { describe, expect, it } from "vitest";

import { planRoster } from "@/convex/crew/roles";
import { designCandidatesFor } from "@/lib/workspace/crew/design/proMax";
import { bakerySeedDraft, BAKERY_SLUG, hydrotrailSeedDraft } from "@/lib/workspace/contracts/fixtures/seeds";
import { hydrotrailRosterInput } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { rosterProfileSchema, type RosterInput } from "@/lib/workspace/contracts/roster";
import {
  DEVICE_NEEDS,
  ideaCrewSeedSchema,
  ideaIsValidated,
  ideaSeedDraftSchema,
  platformSuggestion,
  seedColumns,
  seedFromColumns,
  seedFromDraft,
} from "@/lib/workspace/contracts/seeds";

describe("WP90-S1 seed draft contract", () => {
  it("accepts both fixture drafts", () => {
    expect(ideaSeedDraftSchema.safeParse(hydrotrailSeedDraft).success).toBe(true);
    expect(ideaSeedDraftSchema.safeParse(bakerySeedDraft).success).toBe(true);
  });

  it("rejects a market claim anywhere in the seed", () => {
    const priced = structuredClone(hydrotrailSeedDraft);
    priced.socialAngles[0] = { ...priced.socialAngles[0]!, hook: "Join 10,000 hikers today" };
    expect(ideaSeedDraftSchema.safeParse(priced).success).toBe(false);

    const sized = structuredClone(hydrotrailSeedDraft);
    sized.brandSeeds.positioning = "A $2B hydration market";
    expect(ideaSeedDraftSchema.safeParse(sized).success).toBe(false);
  });

  it("rejects the server-set fields and unknown keys", () => {
    const withSlug = { ...hydrotrailSeedDraft, blueprint: { ...hydrotrailSeedDraft.blueprint, ideaSlug: "x" } };
    expect(ideaSeedDraftSchema.safeParse(withSlug).success).toBe(false);
    expect(ideaSeedDraftSchema.safeParse({ ...hydrotrailSeedDraft, validated: true }).success).toBe(false);
  });

  it("rejects duplicate names and duplicate device needs", () => {
    const names = structuredClone(hydrotrailSeedDraft);
    names.wizardHints.names = ["HydroTrail", "hydrotrail"];
    expect(ideaSeedDraftSchema.safeParse(names).success).toBe(false);
    const needs = structuredClone(hydrotrailSeedDraft);
    needs.wizardHints.platform.deviceNeeds = ["camera", "camera"];
    expect(ideaSeedDraftSchema.safeParse(needs).success).toBe(false);
  });
});

describe("WP90-S1 stored seed", () => {
  it("adds the blueprint's server fields and validated from the research level", () => {
    const seed = seedFromDraft(hydrotrailSeedDraft, { ideaSlug: "hydrotrail", researchLevel: "deep" });
    expect(seed.blueprint).toMatchObject({ schemaVersion: 1, source: "library", ideaSlug: "hydrotrail" });
    expect(seed.validated).toBe(true);
    expect(seed.blueprint.market).toBeDefined();
  });

  it("drops the market block for an unvalidated idea", () => {
    const seed = seedFromDraft(hydrotrailSeedDraft, { ideaSlug: "hydrotrail", researchLevel: "concept" });
    expect(seed.validated).toBe(false);
    expect(seed.blueprint.market).toBeUndefined();
    const forged = { ...seed, blueprint: { ...seed.blueprint, market: hydrotrailSeedDraft.blueprint.market } };
    expect(ideaCrewSeedSchema.safeParse(forged).success).toBe(false);
  });

  it("decides validated from facts, never the model", () => {
    expect(ideaIsValidated({ researchLevel: "deep" })).toBe(true);
    expect(ideaIsValidated({ researchLevel: "standard" })).toBe(true);
    expect(ideaIsValidated({ researchLevel: "concept" })).toBe(false);
    expect(ideaIsValidated({ researchLevel: "deep", auditPassed: false })).toBe(false);
    expect(ideaIsValidated({})).toBe(true);
  });

  it("round-trips through the row columns and refuses another idea's row", () => {
    const seed = seedFromDraft(bakerySeedDraft, { ideaSlug: BAKERY_SLUG, researchLevel: "deep" });
    expect(seedFromColumns(BAKERY_SLUG, seedColumns(seed))).toEqual(seed);
    expect(seedFromColumns("hydrotrail", seedColumns(seed))).toBeNull();
    expect(seedFromColumns(BAKERY_SLUG, { ...seedColumns(seed), wizardHints: undefined })).toBeNull();
  });
});

describe("WP90-S1 platform rule", () => {
  it("suggests web when the loop needs nothing from the phone", () => {
    expect(platformSuggestion([])).toEqual({
      kind: "web",
      reason: "Nothing here needs a phone app, so people use it in their browser.",
    });
  });

  it("suggests native and names every need once, in catalogue order", () => {
    expect(platformSuggestion(["push_notifications", "offline"])).toEqual({
      kind: "native",
      reason: "It needs push notifications and offline use, so a phone app.",
    });
    for (const need of DEVICE_NEEDS) expect(platformSuggestion([need]).kind).toBe("native");
  });
});

describe("WP90-S1 local_business roster rules", () => {
  const bakery: RosterInput = {
    ...hydrotrailRosterInput,
    ...rosterProfileSchema.parse(bakerySeedDraft.blueprint.profile),
  };
  const keys = (entries: readonly { roleKey: string }[]) => entries.map((e) => e.roleKey);

  it("hires Merch when the business sells goods, with light engineering", () => {
    const plan = planRoster(bakery);
    expect(keys(plan.hired)).toContain("merch");
    expect(plan.hired.find((h) => h.roleKey === "merch")?.reason).toBe("Sells goods in store");
    const engineering = plan.hired.find((h) => h.roleKey === "engineering");
    expect(engineering?.weight).toBe("light");
    expect(engineering?.reason).toBe("Booking, ordering or storefront setup only. No product build pack.");
    expect(plan.hired.find((h) => h.roleKey === "seo")?.reason).toBe("Local searches and map listings");
    expect(plan.skipped.find((s) => s.roleKey === "outbound")?.reason).toBe(
      "Regulars come via local search, maps and word of mouth",
    );
  });

  it("skips Merch for a local service with no goods", () => {
    const plan = planRoster({ ...bakery, sellsGoods: undefined });
    expect(plan.skipped.find((s) => s.roleKey === "merch")?.reason).toBe("Sells a service in person, no goods");
  });

  it("ignores sellsGoods for other kinds", () => {
    expect(keys(planRoster({ ...hydrotrailRosterInput, sellsGoods: true }).hired)).not.toContain("merch");
  });

  it("maps to a local product type for design", () => {
    const seed = seedFromDraft(bakerySeedDraft, { ideaSlug: BAKERY_SLUG, researchLevel: "deep" });
    expect(designCandidatesFor(seed.blueprint).productType).toBeTruthy();
  });
});
