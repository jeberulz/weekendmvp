import { describe, expect, it } from "vitest";

import { parsePriceTerms } from "./evidence/amount.ts";
import type { PriceTerms, YearOnePlanV2 } from "./evidence/contract.ts";
import {
  ARR_CAP_CENTS,
  computeYearOne,
  formatUsdCents,
  validateYearOnePlan,
  YearOneMathError,
  yearOneTierTerms,
} from "./finance.ts";
import type { PricingTier } from "./research-record.ts";

const TIERS: PricingTier[] = [
  { name: "Open Source", price: "Free", includes: "Public repositories" },
  { name: "Team", price: "$100/month", includes: "One workspace" },
  { name: "Crew", price: "$20/developer/month", includes: "Per developer" },
  { name: "Indie", price: "$24.99/month", includes: "One seat" },
  { name: "Annual", price: "$1,199.88/year", includes: "Billed yearly" },
  { name: "Enterprise", price: "Custom", includes: "Talk to sales" },
  { name: "Growth", price: "from $99/month", includes: "Starting price" },
  { name: "Metered", price: "$49/month + usage", includes: "Usage add-on" },
  { name: "Euro", price: "€49/month", includes: "EU" },
  { name: "Weekly", price: "$9/week", includes: "Weekly" },
  { name: "Workspace", price: "$300 per workspace per month", includes: "Per workspace" },
];

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}

const terms = (text: string): PriceTerms => must(parsePriceTerms(text));

function rawPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    funnel: [
      { stage: "Founder-led demos", count: 120 },
      { stage: "Team paying accounts", count: 45 },
    ],
    tier: "Team",
    payingAccounts: 45,
    seatsPerAccount: 1,
    assumptions: "Assumes founder-led outbound to 1,200 teams.",
    ...overrides,
  };
}

function plan(overrides: Record<string, unknown> = {}): YearOnePlanV2 {
  return must(validateYearOnePlan(rawPlan(overrides), TIERS).plan);
}

describe("computeYearOne", () => {
  it("45 × $100/month → $54,000 ARR, downside 22 × $100 × 12 = $26,400", () => {
    const math = computeYearOne(plan(), terms("$100/month"));
    expect(math).toEqual({
      baseAccounts: 45,
      seatsPerAccount: 1,
      unitPriceCents: 10_000,
      period: "month",
      perAccountCents: 10_000,
      arrCents: 5_400_000,
      downsideAccounts: 22,
      downsideArrCents: 2_640_000,
    });
    expect(formatUsdCents(math.arrCents)).toBe("$54,000");
    expect(formatUsdCents(math.downsideArrCents)).toBe("$26,400");
  });

  it("$24.99/month keeps cents exactly", () => {
    const math = computeYearOne(
      plan({ tier: "Indie", payingAccounts: 7, funnel: [{ stage: "Trials", count: 40 }, { stage: "Indie payers", count: 7 }] }),
      terms("$24.99/month"),
    );
    expect(math.unitPriceCents).toBe(2_499);
    expect(math.arrCents).toBe(209_916);
    expect(formatUsdCents(math.arrCents)).toBe("$2,099.16");
    expect(math.downsideAccounts).toBe(3);
    expect(formatUsdCents(math.downsideArrCents)).toBe("$899.64");
  });

  it("a one-account base has a zero-account downside", () => {
    const math = computeYearOne(
      plan({ payingAccounts: 1, funnel: [{ stage: "Demos", count: 3 }, { stage: "Payers", count: 1 }] }),
      terms("$100/month"),
    );
    expect(math.downsideAccounts).toBe(0);
    expect(math.downsideArrCents).toBe(0);
    expect(math.downsideArrCents).toBeLessThanOrEqual(math.arrCents);
  });

  it("$20/developer/month with 5 seats → $100/account/month and the right ARR", () => {
    const crew = plan({ tier: "Crew", seatsPerAccount: 5 });
    const math = computeYearOne(crew, terms("$20/developer/month"));
    expect(math.unitPriceCents).toBe(2_000);
    expect(math.perAccountCents).toBe(10_000);
    expect(formatUsdCents(math.perAccountCents)).toBe("$100");
    expect(formatUsdCents(math.arrCents)).toBe("$54,000");
    expect(formatUsdCents(math.downsideArrCents)).toBe("$26,400");
  });

  it("an annual-priced tier computes ARR without a monthly conversion", () => {
    const math = computeYearOne(plan({ tier: "Annual" }), terms("$1,199.88/year"));
    expect(math.period).toBe("year");
    expect(math.perAccountCents).toBe(119_988);
    expect(math.arrCents).toBe(45 * 119_988);
    expect(formatUsdCents(math.arrCents)).toBe("$53,994.60");
    expect(formatUsdCents(math.downsideArrCents)).toBe("$26,397.36");
  });

  it("throws a typed error for bad counts, prices and an ARR above the cap", () => {
    const base = plan();
    const cases: Array<[YearOnePlanV2, PriceTerms, string]> = [
      [{ ...base, payingAccounts: 0.4 }, terms("$100/month"), "invalid_plan"],
      [{ ...base, seatsPerAccount: 2 }, terms("$100/month"), "invalid_plan"],
      [base, terms("$9/week"), "invalid_price"],
      [base, terms("€49/month"), "invalid_price"],
      [base, terms("from $99/month"), "invalid_price"],
      [base, terms("$0/month"), "invalid_price"],
      [{ ...base, payingAccounts: 1_000_000 }, terms("$100,000/month"), "arr_cap"],
    ];
    for (const [badPlan, badTerms, code] of cases) {
      let caught: unknown = null;
      try {
        computeYearOne(badPlan, badTerms);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(YearOneMathError);
      expect(caught instanceof YearOneMathError ? caught.code : null).toBe(code);
    }
  });

  it("accepts ARR exactly at the cap", () => {
    const atCap = computeYearOne(
      { ...plan(), payingAccounts: 1, seatsPerAccount: 1 },
      terms("$10,000,000,000/year"),
    );
    expect(atCap.arrCents).toBe(ARR_CAP_CENTS);
  });
});

describe("validateYearOnePlan", () => {
  it("returns the plan with no issues for a coherent funnel and tier", () => {
    expect(validateYearOnePlan(rawPlan(), TIERS)).toEqual({
      plan: {
        funnel: [
          { stage: "Founder-led demos", count: 120 },
          { stage: "Team paying accounts", count: 45 },
        ],
        tier: "Team",
        payingAccounts: 45,
        seatsPerAccount: 1,
        assumptions: "Assumes founder-led outbound to 1,200 teams.",
      },
      issues: [],
    });
  });

  it("rejects 0.4, 0, negative, NaN, Infinity and unsafe account counts without rounding", () => {
    for (const bad of [0.4, 0, -3, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2, "45"]) {
      const result = validateYearOnePlan(rawPlan({ payingAccounts: bad }), TIERS);
      expect(result.plan, String(bad)).toBeUndefined();
      expect(result.issues.join(" | "), String(bad)).toContain("payingAccounts: must be a whole number ≥ 1");
    }
    const fractionalStage = validateYearOnePlan(
      rawPlan({ funnel: [{ stage: "Demos", count: 120.5 }, { stage: "Payers", count: 45 }] }),
      TIERS,
    );
    expect(fractionalStage.issues).toEqual(["editorial.yearOne.funnel[0].count: must be a whole number ≥ 1 (got 120.5)"]);
  });

  it("requires a non-increasing funnel of at least two stages ending at the paying accounts", () => {
    expect(validateYearOnePlan(rawPlan({ funnel: [{ stage: "Payers", count: 45 }] }), TIERS).issues).toEqual([
      "editorial.yearOne.funnel: need at least 2 stages",
    ]);
    expect(
      validateYearOnePlan(rawPlan({ funnel: [{ stage: "Demos", count: 40 }, { stage: "Payers", count: 45 }] }), TIERS).issues,
    ).toEqual(["editorial.yearOne.funnel: stage counts must not increase (stage 1)"]);
    expect(validateYearOnePlan(rawPlan({ payingAccounts: 40 }), TIERS).issues).toEqual([
      "editorial.yearOne.payingAccounts: must equal the last funnel stage count (45)",
    ]);
  });

  it("rejects seats > 1 on a flat or per-workspace tier", () => {
    expect(validateYearOnePlan(rawPlan({ seatsPerAccount: 5 }), TIERS).issues).toEqual([
      "editorial.yearOne.seatsPerAccount: must be 1 for a flat tier price",
    ]);
    expect(validateYearOnePlan(rawPlan({ tier: "Workspace", seatsPerAccount: 3 }), TIERS).issues).toEqual([
      "editorial.yearOne.seatsPerAccount: must be 1 for a per-workspace tier price",
    ]);
    expect(validateYearOnePlan(rawPlan({ seatsPerAccount: 0 }), TIERS).issues).toEqual([
      "editorial.yearOne.seatsPerAccount: must be a whole number ≥ 1 (got 0)",
    ]);
  });

  it("rejects an unknown tier", () => {
    expect(validateYearOnePlan(rawPlan({ tier: "Platinum" }), TIERS).issues).toEqual([
      `editorial.yearOne.tier: "Platinum" is not a pricing tier (tiers: ${TIERS.map((t) => t.name).join(", ")})`,
    ]);
    expect(validateYearOnePlan(rawPlan({ tier: "" }), TIERS).issues).toEqual(["editorial.yearOne.tier: required"]);
    const duplicated = [...TIERS, { name: "Team", price: "$120/month", includes: "Again" }];
    expect(validateYearOnePlan(rawPlan(), duplicated).issues).toEqual([
      'editorial.yearOne.tier: "Team" names more than one pricing tier',
    ]);
  });

  it("rejects tiers whose price cannot drive the math (Free, Custom, from, usage, non-USD, weekly)", () => {
    const issueFor = (tier: string) => validateYearOnePlan(rawPlan({ tier }), TIERS).issues[0] ?? "";
    expect(issueFor("Open Source")).toContain('tier price "Free" is not one supported fixed price');
    expect(issueFor("Enterprise")).toContain('tier price "Custom" is not one supported fixed price');
    expect(issueFor("Growth")).toContain("not one fixed price (starting_at)");
    expect(issueFor("Metered")).toContain("not one fixed price (plus_usage)");
    expect(issueFor("Euro")).toContain("year-one math is in USD");
    expect(issueFor("Weekly")).toContain("per month or per year");
  });

  it("rejects an ARR above $10,000,000,000", () => {
    const issues = validateYearOnePlan(
      rawPlan({
        tier: "Annual",
        payingAccounts: 9_000_000,
        funnel: [{ stage: "Prospects", count: 9_000_000 }, { stage: "Payers", count: 9_000_000 }],
      }),
      TIERS,
    ).issues;
    expect(issues).toEqual(["editorial.yearOne: ARR $10,798,920,000 is above the $10,000,000,000 cap"]);
  });

  // WP54 integration: the v1 revenue-per-account cross-check that used to
  // live here was unreachable (parseResearchRecord's closed schema refuses
  // editorial.yearOne.monthlyRevenuePerAccount before the finance rules run;
  // research-record.v2.test.ts "rejects the legacy monthlyRevenuePerAccount
  // field"), so it was removed. This test pins that the math never reads it.
  it("never reads a v1 revenue-per-account: revenue comes from the tier price × seats", () => {
    const result = validateYearOnePlan(rawPlan({ tier: "Crew", seatsPerAccount: 5, monthlyRevenuePerAccount: 90 }), TIERS);
    expect(result.issues).toEqual([]);
    const validated = must(result.plan);
    expect(validated).not.toHaveProperty("monthlyRevenuePerAccount");
    const math = computeYearOne(validated, terms("$20/developer/month"));
    expect(math.perAccountCents).toBe(10_000);
    expect(math.arrCents).toBe(45 * 10_000 * 12);
  });

  it("rejects a plan that is not an object", () => {
    expect(validateYearOnePlan(null, TIERS)).toEqual({ issues: ["editorial.yearOne: expected an object"] });
  });
});

describe("yearOneTierTerms and formatUsdCents", () => {
  it("resolves a named tier to its parsed price", () => {
    const resolved = yearOneTierTerms(" Crew ", TIERS);
    expect(resolved.ok && resolved.terms).toEqual({
      amount: { value: "20", magnitude: "none", unit: "currency", currency: "USD" },
      period: "month",
      basis: "per_user",
      qualifiers: [],
    });
  });

  it("formats exact USD cents", () => {
    expect(formatUsdCents(5_400_000)).toBe("$54,000");
    expect(formatUsdCents(2_499)).toBe("$24.99");
    expect(formatUsdCents(119_988)).toBe("$1,199.88");
    expect(formatUsdCents(50)).toBe("$0.50");
    expect(formatUsdCents(0)).toBe("$0");
    expect(() => formatUsdCents(1.5)).toThrow(RangeError);
  });
});
