import { describe, expect, test } from "vitest";

import {
  POOL_BUDGET_CEILING_MICRO_USD,
  budgetAllowed,
  cleanReason,
  confirmMatches,
  describeRisk,
  normalizeEmail,
  parseUsdInput,
  riskReasons,
  signedInRecently,
  type SpendControls,
} from "@/lib/admin/ai-costs/controls";

const ALL_OFF = { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true };
const base: SpendControls = { freeBudgetMicroUsd: 7_000_000, paidBudgetMicroUsd: 3_000_000, killSwitches: { ...ALL_OFF, ai: false } };
const spent = { free: 1_000_000, paid: 0 };

describe("ops control rules", () => {
  test("turning off and lowering are never risky", () => {
    expect(riskReasons(base, { ...base, freeBudgetMicroUsd: 1_000_000, killSwitches: ALL_OFF }, spent)).toEqual([]);
  });

  test("turning any feature back on is risky", () => {
    const reasons = riskReasons(base, { ...base, killSwitches: { ...base.killSwitches, email: false } }, spent);
    expect(reasons).toEqual([{ kind: "switch_on", key: "email" }]);
    expect(describeRisk(reasons[0])).toBe("turns email sending back on");
  });

  test("a raise is risky from $0 or above twice today's spend", () => {
    expect(riskReasons(base, { ...base, freeBudgetMicroUsd: 7_500_000 }, { free: 4_000_000, paid: 0 })).toEqual([]);
    expect(riskReasons(base, { ...base, freeBudgetMicroUsd: 8_000_001 }, { free: 4_000_000, paid: 0 }))
      .toEqual([{ kind: "budget_over_spend", pool: "free", spentMicroUsd: 4_000_000 }]);
    const zero = { ...base, paidBudgetMicroUsd: 0 };
    expect(riskReasons(zero, { ...zero, paidBudgetMicroUsd: 1 }, spent)).toEqual([{ kind: "budget_from_zero", pool: "paid" }]);
  });

  test("dollar input parses to whole micro-USD, cents at most", () => {
    expect(parseUsdInput("7")).toBe(7_000_000);
    expect(parseUsdInput(" $7.5 ")).toBe(7_500_000);
    expect(parseUsdInput("0.01")).toBe(10_000);
    expect(parseUsdInput("7.505")).toBeNull();
    expect(parseUsdInput("-1")).toBeNull();
    expect(parseUsdInput("1e3")).toBeNull();
    expect(parseUsdInput("")).toBeNull();
    expect(budgetAllowed(POOL_BUDGET_CEILING_MICRO_USD)).toBe(true);
    expect(budgetAllowed(POOL_BUDGET_CEILING_MICRO_USD + 1)).toBe(false);
    expect(budgetAllowed(-1)).toBe(false);
  });

  test("step-up window, typed confirm, reasons and emails", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    expect(signedInRecently(now - 9 * 60_000, now)).toBe(true);
    expect(signedInRecently(now - 11 * 60_000, now)).toBe(false);
    expect(signedInRecently(now + 60_000, now)).toBe(false);
    expect(confirmMatches(" Confirm ")).toBe(true);
    expect(confirmMatches("yes")).toBe(false);
    expect(confirmMatches(null)).toBe(false);
    expect(cleanReason("  beta   ended  ")).toBe("beta ended");
    expect(cleanReason("   ")).toBeNull();
    expect(cleanReason("x".repeat(400))).toHaveLength(300);
    expect(normalizeEmail(" A@B.test ")).toBe("a@b.test");
    expect(normalizeEmail("not an email")).toBeNull();
  });
});
