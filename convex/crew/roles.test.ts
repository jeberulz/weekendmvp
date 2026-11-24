import { describe, expect, it } from "vitest";
import {
  CORE_ROLE_KEYS,
  BUYERS,
  DELIVERY_FORMATS,
  IDEA_KINDS,
  ROLE_KEYS,
  rosterPlanSchema,
  type RosterInput,
  type RosterPlan,
} from "../../lib/workspace/contracts/roster";
import { hydrotrailRosterInput } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import {
  ROLE_CATALOGUE,
  ROSTER_RULES_VERSION,
  leadNameSchema,
  planRoster,
  renderTeamMd,
  summariseRoster,
} from "./roles";

const hydroTrail: RosterInput = hydrotrailRosterInput;

const course: RosterInput = {
  ideaKind: "course",
  buyer: "consumer",
  deliveryFormat: "cohort",
  audiencePlural: "hikers",
  commercialModel: "one_time",
  goal: {
    kind: "first_sale",
    target: { count: 20, unit: "seats" },
    paidPush: null,
  },
};

const keys = (list: { roleKey: string }[]) => list.map((e) => e.roleKey);

describe("ROLE_CATALOGUE", () => {
  it("has one entry per role key", () => {
    expect(ROLE_CATALOGUE.map((r) => r.key)).toEqual([...ROLE_KEYS]);
    expect(ROLE_CATALOGUE.filter((r) => r.always).map((r) => r.key)).toEqual(["lead", "brand", "email", "social"]);
  });
});

describe("planRoster: HydroTrail", () => {
  const plan = planRoster(hydroTrail);

  it("hires 9 and skips 4", () => {
    expect(plan.hired).toHaveLength(9);
    expect(keys(plan.skipped).sort()).toEqual(
      ["community", "curriculum", "merch", "outbound"].sort(),
    );
    expect(keys(plan.hired)).toContain("ads");
    expect(plan.rulesVersion).toBe(ROSTER_RULES_VERSION);
  });

  it("uses the exact reasons", () => {
    const skip = Object.fromEntries(plan.skipped.map((s) => [s.roleKey, s.reason]));
    expect(skip.merch).toBe("An app; nothing physical to sell");
    expect(skip.outbound).toBe("Hikers come via communities and search");
    expect(skip.curriculum).toBe("No course content");
    expect(skip.community).toBe("Not before the first 50 signups");
    const ads = plan.hired.find((h) => h.roleKey === "ads");
    expect(ads?.reason).toBe("Goal has a paid push: $7/day test");
    const eng = plan.hired.find((h) => h.roleKey === "engineering");
    expect(eng?.weight).toBe("full");
    expect(eng?.reason).toBe("PRD slice and 8-prompt build pack. The product is an app.");
    expect(plan.hired.find((h) => h.roleKey === "marketing")?.reason).toBe(
      "Owns 50 signups",
    );
  });

  it("summarises", () => {
    expect(summariseRoster(plan)).toEqual({
      hiredCount: 9,
      skippedCount: 4,
      line: "9 hired: the 4 core roles plus Landing, SEO, Marketing, Engineering and Ads. 4 skipped: Merch, Outbound, Curriculum, Community.",
    });
  });
});

describe("planRoster: course", () => {
  const plan = planRoster(course);

  it("hires 10 and skips ads, merch, outbound", () => {
    expect(plan.hired).toHaveLength(10);
    expect(keys(plan.skipped)).toEqual(["ads", "merch", "outbound"]);
    expect(keys(plan.hired)).toEqual(expect.arrayContaining(["curriculum", "community"]));
  });

  it("uses the exact reasons", () => {
    const skip = Object.fromEntries(plan.skipped.map((s) => [s.roleKey, s.reason]));
    expect(skip.ads).toBe("No paid goal yet");
    expect(skip.merch).toBe("Nothing physical");
    expect(skip.outbound).toBe("Not a B2B buyer");
    const hire = Object.fromEntries(plan.hired.map((h) => [h.roleKey, h]));
    expect(hire.curriculum.reason).toBe("Idea kind is course");
    expect(hire.community.reason).toBe("Cohort format");
    expect(hire.engineering.weight).toBe("light");
    expect(hire.engineering.reason).toBe(
      "Checkout and course hosting setup only. No product build pack.",
    );
  });

  it("gives a non-cohort course the community reason", () => {
    const p = planRoster({ ...course, deliveryFormat: "self_serve" });
    expect(p.hired.find((h) => h.roleKey === "community")?.reason).toBe(
      "Courses run better with a community",
    );
  });
});

describe("planRoster: other rules", () => {
  it("hires Outbound for a B2B tool", () => {
    const plan = planRoster({
      ...hydroTrail,
      ideaKind: "b2b_software",
      buyer: "business",
    });
    expect(keys(plan.hired)).toContain("outbound");
    expect(plan.hired.find((h) => h.roleKey === "engineering")?.weight).toBe("full");
    expect(plan.skipped.find((s) => s.roleKey === "merch")?.reason).toBe(
      "A B2B tool; nothing physical to sell",
    );
  });

  it("hires Merch and light Engineering for a physical product", () => {
    const plan = planRoster({ ...hydroTrail, ideaKind: "physical_product" });
    expect(keys(plan.hired)).toContain("merch");
    expect(plan.hired.find((h) => h.roleKey === "engineering")?.weight).toBe("light");
  });

  it("uses a fallback community reason when the target is null", () => {
    const plan = planRoster({
      ...hydroTrail,
      goal: { ...hydroTrail.goal, target: null },
    });
    expect(plan.skipped.find((s) => s.roleKey === "community")?.reason).toBe(
      "No course or cohort to run yet",
    );
    expect(plan.hired.find((h) => h.roleKey === "marketing")?.reason).toBe(
      "Owns the first goal",
    );
  });

  it("passes rosterPlanSchema and keeps reasons within 160 chars", () => {
    const inputs: RosterInput[] = [
      hydroTrail,
      course,
      { ...hydroTrail, ideaKind: "service", deliveryFormat: "one_to_one" },
      { ...hydroTrail, ideaKind: "marketplace", audiencePlural: "x".repeat(40) },
    ];
    for (const input of inputs) {
      const plan = planRoster(input);
      expect(rosterPlanSchema.safeParse(plan).success).toBe(true);
      for (const e of [...plan.hired, ...plan.skipped]) {
        expect(e.reason.length).toBeLessThanOrEqual(160);
      }
    }
  });

  it("rejects invalid input", () => {
    expect(() =>
      planRoster({ ...hydroTrail, ideaKind: "robot" } as unknown as RosterInput),
    ).toThrow();
    expect(() =>
      planRoster({ ...hydroTrail, audiencePlural: "a".repeat(41) }),
    ).toThrow();
    expect(() =>
      planRoster({
        ...hydroTrail,
        goal: { ...hydroTrail.goal, paidPush: { dailyBudgetUsd: 0 } },
      }),
    ).toThrow();
  });

  it("is deterministic", () => {
    expect(planRoster(hydroTrail)).toEqual(planRoster(hydroTrail));
  });

  it("renames only the lead", () => {
    const base = planRoster(hydroTrail);
    const renamed = planRoster(hydroTrail, { leadName: "Juno" });
    expect(renamed.hired.find((h) => h.roleKey === "lead")?.employeeName).toBe("Juno");
    expect(
      renamed.hired.filter((h) => h.roleKey !== "lead"),
    ).toEqual(base.hired.filter((h) => h.roleKey !== "lead"));
    expect(renamed.skipped).toEqual(base.skipped);
  });
});

describe("renderTeamMd", () => {
  it("renders the structure with one line per role", () => {
    const plan = planRoster(hydroTrail);
    const md = renderTeamMd(plan, {
      businessName: "HydroTrail",
      planLabel: "free for now",
      goalLabel: "50 waitlist signups · this weekend",
    });
    expect(md).toContain("# TEAM.md — HydroTrail");
    expect(md).toContain("ideaKind: app");
    expect(md).toContain("plan: free for now");
    expect(md).toContain("goal: 50 waitlist signups · this weekend");
    expect(md).toContain("## Hired");
    expect(md).toContain("## Skipped");
    expect(md).toContain("autopilot: off for everyone");
    expect(md).toContain("- engineering: Kai (added, weight: full) — PRD slice");
    expect(md).toContain("- brand: Iris (core) — logo, palette, voice");
    expect(md).toContain("- ads: Ada (added) — goal has a paid push: $7/day test");
    expect(md).toContain("- merch — an app; nothing physical to sell");
    for (const key of ROLE_KEYS) {
      const lines = md.split("\n").filter((l) => l.startsWith(`- ${key}:`) || l.startsWith(`- ${key} —`));
      expect(lines).toHaveLength(1);
    }
    expect(md.toLowerCase()).not.toContain("sms");
  });
});

describe("input hardening", () => {
  it("rejects newlines in audiencePlural and unit", () => {
    expect(() =>
      planRoster({ ...hydroTrail, audiencePlural: "hikers\n## Hired" }),
    ).toThrow();
    expect(() =>
      planRoster({
        ...hydroTrail,
        goal: { ...hydroTrail.goal, target: { count: 5, unit: "a\nb" } },
      }),
    ).toThrow();
  });

  it("trims audiencePlural", () => {
    expect(planRoster({ ...hydroTrail, audiencePlural: "  hikers " })
      .skipped.find((s) => s.roleKey === "outbound")?.reason).toBe(
      "Hikers come via communities and search",
    );
  });

  it("validates leadName", () => {
    expect(() => planRoster(hydroTrail, { leadName: "Ju\nno" })).toThrow();
    expect(() => planRoster(hydroTrail, { leadName: "x".repeat(25) })).toThrow();
    expect(leadNameSchema.safeParse("Juno").success).toBe(true);
    const blank = planRoster(hydroTrail, { leadName: "   " });
    expect(blank.hired.find((h) => h.roleKey === "lead")?.employeeName).toBe("Wren");
  });

  it("rejects invisible and bidi-control characters in leadName", () => {
    for (const leadName of ["Ju\u200Bno", "\u202EnuJ", "Ju\u2066no\u2069", "Ju\u200Fno", "\u200B\u200B"]) {
      expect(() => planRoster(hydroTrail, { leadName }), JSON.stringify(leadName)).toThrow();
    }
    // ZWJ emoji sequences stay valid.
    expect(planRoster(hydroTrail, { leadName: "Wren \u{1F469}\u200D\u{1F4BB}" }).hired[0]?.employeeName).toBe(
      "Wren \u{1F469}\u200D\u{1F4BB}",
    );
  });

  it("caps a goal target at 1,000,000", () => {
    const at = { ...hydroTrail, goal: { ...hydroTrail.goal, target: { count: 1_000_000, unit: "signups" } } };
    expect(() => planRoster(at)).not.toThrow();
    const over = { ...hydroTrail, goal: { ...hydroTrail.goal, target: { count: 1_000_001, unit: "signups" } } };
    expect(() => planRoster(over)).toThrow();
  });

  it("renderTeamMd collapses newlines in meta", () => {
    const md = renderTeamMd(planRoster(hydroTrail), {
      businessName: "Evil\n## Hired\n- lead: Mallory",
      planLabel: "free\nplan",
      goalLabel: "goal\r\n## Hired",
    });
    expect(md.match(/^## Hired$/gm)).toHaveLength(1);
    expect(md.split("\n")[0]).toBe("# TEAM.md — Evil ## Hired - lead: Mallory");
  });

  it("renders a founder-hired role with the founder tag", () => {
    const plan = planRoster(hydroTrail);
    const founderPlan: RosterPlan = {
      ...plan,
      hired: plan.hired.map((h) =>
        h.roleKey === "ads" ? { ...h, hiredBy: "founder" as const } : h,
      ),
    };
    const md = renderTeamMd(founderPlan, {
      businessName: "HydroTrail",
      planLabel: "free",
      goalLabel: "g",
    });
    expect(md).toContain("- ads: Ada (founder) —");
  });
});

describe("rosterPlanSchema refinements", () => {
  const base = planRoster(hydroTrail);
  const clone = (): RosterPlan => structuredClone(base);
  const hiredOf = (p: RosterPlan, k: string) => {
    const e = p.hired.find((h) => h.roleKey === k);
    if (!e) throw new Error("missing");
    return e;
  };

  it("accepts the base plan", () => {
    expect(rosterPlanSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a duplicate role", () => {
    const p = clone();
    p.hired.push({ ...hiredOf(p, "ads") });
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a missing role", () => {
    const p = clone();
    p.skipped = p.skipped.filter((s) => s.roleKey !== "merch");
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a skipped always-on role", () => {
    const p = clone();
    p.hired = p.hired.filter((h) => h.roleKey !== "brand");
    p.skipped.push({ roleKey: "brand", roleLabel: "Brand", reason: "nope" });
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
  });

  it("rejects weight on a non-engineering role", () => {
    const p = clone();
    hiredOf(p, "brand").weight = "full";
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
  });

  it("rejects engineering without a weight", () => {
    const p = clone();
    delete hiredOf(p, "engineering").weight;
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
  });

  it("rejects ads with always:true", () => {
    const p = clone();
    hiredOf(p, "ads").always = true;
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
  });

  it("rejects an always-on role hired by founder", () => {
    const p = clone();
    hiredOf(p, "brand").hiredBy = "founder";
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
  });

  it("rejects an empty reason", () => {
    const p = clone();
    hiredOf(p, "brand").reason = "   ";
    expect(rosterPlanSchema.safeParse(p).success).toBe(false);
    const q = clone();
    const skip = q.skipped[0];
    if (!skip) throw new Error("missing");
    skip.reason = "";
    expect(rosterPlanSchema.safeParse(q).success).toBe(false);
  });
});

describe("ads budget and wording", () => {
  const withBudget = (dailyBudgetUsd: number) =>
    planRoster({
      ...hydroTrail,
      goal: { ...hydroTrail.goal, paidPush: { dailyBudgetUsd } },
    });
  const adsReason = (p: RosterPlan) =>
    p.hired.find((h) => h.roleKey === "ads")?.reason;

  it("formats whole and fractional amounts", () => {
    expect(adsReason(withBudget(7))).toBe("Goal has a paid push: $7/day test");
    expect(adsReason(withBudget(7.5))).toBe("Goal has a paid push: $7.50/day test");
  });

  it("rejects sub-dollar and sub-cent budgets", () => {
    expect(() => withBudget(0.5)).toThrow();
    expect(() => withBudget(7.123)).toThrow();
    expect(() => withBudget(101)).toThrow();
  });

  it("keeps mixed-case audience words as written", () => {
    const p = planRoster({ ...hydroTrail, audiencePlural: "iOS developers" });
    expect(p.skipped.find((s) => s.roleKey === "outbound")?.reason).toBe(
      "iOS developers come via communities and search",
    );
  });

  it("keys outbound skip on buyer and delivery format", () => {
    const p = planRoster({ ...hydroTrail, deliveryFormat: "one_to_one" });
    expect(p.skipped.find((s) => s.roleKey === "outbound")?.reason).toBe(
      "Not a B2B buyer",
    );
  });

  it("keys email and landing reasons on goal kind", () => {
    const reasons = (kind: RosterInput["goal"]["kind"]) => {
      const p = planRoster({ ...hydroTrail, goal: { ...hydroTrail.goal, kind } });
      return [
        p.hired.find((h) => h.roleKey === "email")?.reason,
        p.hired.find((h) => h.roleKey === "landing")?.reason,
      ];
    };
    expect(reasons("waitlist")).toEqual(["Waitlist email sequence", "Site and waitlist"]);
    for (const kind of ["first_sale", "mrr_500", "replace_income"] as const) {
      expect(reasons(kind)).toEqual([
        "Pre-launch and launch-day emails",
        "Sales page and early-bird list",
      ]);
    }
    expect(reasons("just_testing")[0]).toBe("A short welcome sequence");
  });
});

describe("drift and sweep", () => {
  it("catalogue always set equals CORE_ROLE_KEYS", () => {
    const always = ROLE_CATALOGUE.filter((r) => r.always).map((r) => r.key);
    expect([...always].sort()).toEqual([...CORE_ROLE_KEYS].sort());
  });

  it("every combination yields a valid plan with sane reasons", () => {
    const targets: RosterInput["goal"]["target"][] = [
      { count: 50, unit: "signups" },
      null,
    ];
    const pushes: RosterInput["goal"]["paidPush"][] = [
      { dailyBudgetUsd: 7 },
      null,
    ];
    let n = 0;
    for (const ideaKind of IDEA_KINDS)
      for (const buyer of BUYERS)
        for (const deliveryFormat of DELIVERY_FORMATS)
          for (const target of targets)
            for (const paidPush of pushes) {
              const plan = planRoster({
                ideaKind,
                buyer,
                deliveryFormat,
                audiencePlural: "hikers",
                commercialModel: "free",
                goal: { kind: "waitlist", target, paidPush },
              });
              n += 1;
              expect(rosterPlanSchema.safeParse(plan).success).toBe(true);
              for (const e of [...plan.hired, ...plan.skipped]) {
                expect(e.reason.length).toBeGreaterThan(0);
                expect(e.reason.length).toBeLessThanOrEqual(160);
              }
            }
    expect(n).toBe(IDEA_KINDS.length * 2 * 3 * 2 * 2);
  });
});

describe("roster per idea (WP91): the Crew Lead's proposal", () => {
  const withProposal = (input: RosterInput, proposal: NonNullable<RosterInput["proposal"]>): RosterInput => ({ ...input, proposal });

  it("with no proposal, the team is the WP69 one", () => {
    const plan = planRoster(hydroTrail);
    expect(keys(plan.hired)).toEqual(["lead", "brand", "landing", "seo", "marketing", "email", "social", "engineering", "ads"]);
    expect(plan.hired.every((h) => h.decidedBy === undefined)).toBe(true);
    expect(plan.skipped.every((s) => s.decidedBy === undefined)).toBe(true);
  });

  it("the proposal hires and skips optional roles with its own reasons", () => {
    const plan = planRoster(withProposal(hydroTrail, [
      { roleKey: "seo", hire: false, reason: "Hikers find trail tools through friends, not search" },
      { roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" },
      { roleKey: "community", hire: true, reason: "A trail group keeps hikers coming back" },
    ]));
    const skip = plan.skipped.find((s) => s.roleKey === "seo");
    expect(skip).toEqual({ roleKey: "seo", roleLabel: "SEO", reason: "Hikers find trail tools through friends, not search", decidedBy: "lead" });
    expect(plan.hired.find((h) => h.roleKey === "outbound")).toMatchObject({
      reason: "Outdoor shops could stock the planner",
      decidedBy: "lead",
      hiredBy: "rule",
      always: false,
    });
    expect(keys(plan.hired)).toContain("community");
    // Roles the proposal does not answer keep the rule and its reason.
    expect(plan.hired.find((h) => h.roleKey === "landing")).toMatchObject({ reason: "Site and waitlist" });
    expect(plan.hired.find((h) => h.roleKey === "landing")?.decidedBy).toBeUndefined();
    expect(plan.skipped.find((s) => s.roleKey === "merch")).toMatchObject({ reason: "An app; nothing physical to sell" });
  });

  it("a paid push always hires Ads and a course always hires Curriculum, whatever the proposal says", () => {
    const ads = planRoster(withProposal(hydroTrail, [{ roleKey: "ads", hire: false, reason: "Too early for paid" }]));
    expect(ads.hired.find((h) => h.roleKey === "ads")).toMatchObject({ reason: "Goal has a paid push: $7/day test" });
    expect(ads.hired.find((h) => h.roleKey === "ads")?.decidedBy).toBeUndefined();
    const cohort = planRoster(withProposal(course, [
      { roleKey: "curriculum", hire: false, reason: "Not needed" },
      { roleKey: "community", hire: false, reason: "A small first cohort runs in the founder's inbox" },
    ]));
    expect(keys(cohort.hired)).toContain("curriculum");
    // Community is not forced: the lead may skip it, with its reason.
    expect(cohort.skipped.find((s) => s.roleKey === "community")).toMatchObject({ decidedBy: "lead" });
  });

  it("the core is hired whatever the proposal holds", () => {
    const everyOptional = (["landing", "seo", "marketing", "engineering", "merch", "outbound", "community"] as const)
      .map((roleKey) => ({ roleKey, hire: false, reason: "Not for this idea" }));
    const plan = planRoster({ ...hydroTrail, goal: { ...hydroTrail.goal, paidPush: null }, proposal: everyOptional });
    expect(keys(plan.hired)).toEqual(["lead", "brand", "email", "social"]);
    expect(plan.skipped).toHaveLength(9);
    expect(summariseRoster(plan).line).toBe(
      "4 hired: the 4 core roles. 9 skipped: Landing, SEO, Marketing, Engineering, Ads, Merch, Outbound, Curriculum, Community.",
    );
  });

  it("no cap: the proposal may hire every optional role", () => {
    const every = (["landing", "seo", "marketing", "engineering", "ads", "curriculum", "community", "merch", "outbound"] as const)
      .map((roleKey) => ({ roleKey, hire: true, reason: `Needed for ${roleKey}` }));
    const plan = planRoster(withProposal(hydroTrail, every));
    expect(plan.hired).toHaveLength(13);
    expect(plan.skipped).toEqual([]);
    expect(plan.hired.find((h) => h.roleKey === "engineering")?.weight).toBe("full");
  });

  it("a skipped engineer carries no weight", () => {
    const plan = planRoster(withProposal(course, [{ roleKey: "engineering", hire: false, reason: "The course runs on a hosted platform" }]));
    expect(plan.skipped.find((s) => s.roleKey === "engineering")).toBeDefined();
    expect(rosterPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("a proposal for a core role is refused by the input schema", () => {
    expect(() => planRoster({
      ...hydroTrail,
      proposal: [{ roleKey: "brand", hire: false, reason: "No" }] as unknown as NonNullable<RosterInput["proposal"]>,
    })).toThrow();
  });

  it("the plan schema refuses a lead decision on a core role", () => {
    const plan = planRoster(hydroTrail);
    const tampered = structuredClone(plan) as RosterPlan;
    const brand = tampered.hired.find((h) => h.roleKey === "brand");
    if (brand === undefined) throw new Error("missing brand");
    brand.decidedBy = "lead";
    expect(rosterPlanSchema.safeParse(tampered).success).toBe(false);
  });

  it("TEAM.md marks the lead's calls", () => {
    const plan = planRoster(withProposal(hydroTrail, [
      { roleKey: "outbound", hire: true, reason: "Outdoor shops could stock the planner" },
      { roleKey: "seo", hire: false, reason: "Hikers find it through friends" },
    ]));
    const md = renderTeamMd(plan, { businessName: "HydroTrail", planLabel: "free", goalLabel: "50 signups" });
    expect(md).toContain("- outbound: Oli (lead's call) — outdoor shops could stock the planner");
    expect(md).toContain("- seo (lead's call) — hikers find it through friends");
  });

  it("is deterministic for the same input", () => {
    const input = withProposal(course, [{ roleKey: "merch", hire: true, reason: "Printed trail workbooks" }]);
    expect(planRoster(input)).toEqual(planRoster(input));
  });
});
