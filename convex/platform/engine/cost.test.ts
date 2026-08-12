import { describe, expect, test } from "vitest";
import {
  assertWithinCap,
  CAP_MICRO_USD,
  CostCapExceededError,
  fromMicroUsd,
  toMicroUsd,
  VALIDATION_REPORT_CREDITS,
  worstCaseMicroUsd,
} from "./cost";
import { PIPELINE, stepAt } from "./pipeline";
import {
  REFERENCE_RUN_USD,
  REPORT_COST_CAP_USD,
  SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS,
} from "./providers/pricing";
import { MAX_ATTEMPTS } from "./executor";

/**
 * WP26-S4. The cap is the only thing standing between a misbehaving run and an
 * unbounded provider bill, so these tests probe the boundary rather than the
 * middle: exactly at the cap, one millionth of a dollar over, and the case the
 * AC singles out — a run whose *actual* spend is still under the cap but whose
 * next call cannot fit beneath it.
 */

describe("micro-USD conversion", () => {
  test("rounds up, because an under-stated cost is what overspends", () => {
    expect(toMicroUsd(0.0000001)).toBe(1);
    expect(toMicroUsd(1.0000001)).toBe(1_000_001);
    expect(toMicroUsd(0)).toBe(0);
  });

  test("round-trips a whole-cent value exactly", () => {
    expect(fromMicroUsd(toMicroUsd(0.52))).toBeCloseTo(0.52, 10);
  });

  test("refuses a negative or non-finite cost rather than crediting the run", () => {
    expect(() => toMicroUsd(-0.01)).toThrow();
    expect(() => toMicroUsd(Number.NaN)).toThrow();
    expect(() => toMicroUsd(Number.POSITIVE_INFINITY)).toThrow();
  });

  test("the cap constant matches the ruled dollar figure", () => {
    expect(CAP_MICRO_USD).toBe(4_000_000);
    expect(REPORT_COST_CAP_USD).toBe(4.0);
  });
});

describe("the reservation boundary", () => {
  test("a reservation landing exactly on the cap is allowed", () => {
    expect(() =>
      assertWithinCap({ spentMicroUsd: 3_000_000, worstCaseMicroUsd: 1_000_000 }),
    ).not.toThrow();
  });

  test("one millionth of a dollar over the cap is refused", () => {
    expect(() =>
      assertWithinCap({ spentMicroUsd: 3_000_000, worstCaseMicroUsd: 1_000_001 }),
    ).toThrow(CostCapExceededError);
  });

  test("refuses a call whose worst case crosses the cap even though actual spend has not", () => {
    // The AC's exact scenario. A post-hoc check on the running total would look
    // at $3.90 spent, see it is under $4.00, and wave the call through — after
    // which the run lands at $4.90. The pre-call check refuses it.
    const spentMicroUsd = 3_900_000; // $3.90 actually spent
    const worstCaseMicroUsd = 1_000_000; // this call could cost $1.00

    expect(spentMicroUsd).toBeLessThan(CAP_MICRO_USD);
    expect(() => assertWithinCap({ spentMicroUsd, worstCaseMicroUsd })).toThrow(
      CostCapExceededError,
    );
  });

  test("the error carries both numbers so a refund can explain itself", () => {
    try {
      assertWithinCap({ spentMicroUsd: 3_900_000, worstCaseMicroUsd: 1_000_000 });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CostCapExceededError);
      const capError = error as CostCapExceededError;
      expect(capError.code).toBe("COST_CAP_EXCEEDED");
      expect(capError.spentMicroUsd).toBe(3_900_000);
      expect(capError.worstCaseMicroUsd).toBe(1_000_000);
    }
  });
});

describe("worst-case step budgets", () => {
  test("the unpaid render step reserves nothing", () => {
    expect(worstCaseMicroUsd({ role: null })).toBe(0);
    expect(worstCaseMicroUsd(stepAt(6).budget)).toBe(0);
  });

  test("every paid step reserves something above zero", () => {
    for (const step of PIPELINE) {
      const reserved = worstCaseMicroUsd(step.budget);
      if (step.role === null) expect(reserved).toBe(0);
      else expect(reserved).toBeGreaterThan(0);
    }
  });

  test("synthesis reserves at the uncached rate", () => {
    // Reserving at the cached rate would under-reserve by 10x whenever the
    // cache misses, which is precisely when the call is most expensive.
    // Kept below the long-context threshold so this isolates the cache-rate
    // question from the surcharge, which the next test covers.
    const reserved = worstCaseMicroUsd({
      role: "synthesis",
      maxInputTokens: 100_000,
      maxOutputTokens: 0,
    });
    // $5.00/1M uncached. At the $0.50/1M cached rate this would be 50_000.
    expect(reserved).toBe(500_000);
  });

  test("a budget past the long-context threshold reserves the surcharge", () => {
    const under = worstCaseMicroUsd({
      role: "synthesis",
      maxInputTokens: SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS,
      maxOutputTokens: 1_000,
    });
    const over = worstCaseMicroUsd({
      role: "synthesis",
      maxInputTokens: SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS + 1,
      maxOutputTokens: 1_000,
    });
    // One token past the threshold roughly doubles the bill for the whole
    // request, so the reservation must jump, not creep.
    expect(over).toBeGreaterThan(under * 1.9);
  });

  test("search reserves the per-request fee, not just tokens", () => {
    const withFee = worstCaseMicroUsd({
      role: "search",
      maxInputTokens: 0,
      maxOutputTokens: 0,
      requests: 1,
      searchContextSize: "high",
    });
    // $14 per 1,000 requests at the high tier — the fee dominates token cost.
    expect(withFee).toBe(14_000);
  });

  test("keyword data reserves the task fee plus every item it could return", () => {
    expect(
      worstCaseMicroUsd({ role: "keywordData", tasks: 1, maxItems: 50 }),
    ).toBe(toMicroUsd(0.01 + 50 * 0.0001));
  });
});

describe("the pipeline fits inside the cap", () => {
  test("a clean run's worst case leaves room, and a fully-retried one still fits", () => {
    const perRun = PIPELINE.reduce(
      (total, step) => total + worstCaseMicroUsd(step.budget),
      0,
    );
    expect(perRun).toBeLessThan(CAP_MICRO_USD);
    // Every step taking its one allowed retry must still be affordable,
    // otherwise the cap would fire on a run that behaved exactly as designed.
    expect(perRun * MAX_ATTEMPTS).toBeLessThan(CAP_MICRO_USD);
  });

  test("the configured budgets stay in the neighbourhood of the ruled reference cost", () => {
    // The cap sits ~8x above expected spend, so it cannot detect a drift that
    // merely doubles the bill. This pins the budgets to the ruling's $0.52
    // reference instead: a change that blows past 4x it is a real regression
    // even though the cap would never notice.
    const perRun = PIPELINE.reduce(
      (total, step) => total + worstCaseMicroUsd(step.budget),
      0,
    );
    expect(perRun).toBeLessThan(toMicroUsd(REFERENCE_RUN_USD * 4));
  });
});

describe("customer price", () => {
  test("is a server-side constant, expressed in whole credits", () => {
    expect(VALIDATION_REPORT_CREDITS).toBe(15n);
    expect(typeof VALIDATION_REPORT_CREDITS).toBe("bigint");
  });
});
