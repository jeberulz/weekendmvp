// @vitest-environment node
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { toMicroUsd as engineToMicroUsd } from "@/lib/engine/cost";
import {
  CREDIT_ACTIONS,
  type CreditActionKey,
  FREE_CHANGE_ROUNDS,
  JOB_TYPES,
  MAX_PROVIDER_MICRO_USD_PER_CREDIT,
  MONTHLY_CREDIT_ALLOWANCE,
  PRICE_TBD_JOB_TYPES,
  PRICES_STATUS,
  REGENERATE_ACTION_BY_JOB_TYPE,
  STARTER_CREDITS,
  WORKSPACE_FEATURE_KEYS,
  WORKSPACE_PLAN_IDS,
  WORKSPACE_PLAN_REFERENCE,
  actionAllowedOnPlan,
  creditCostFor,
  isJobsContractError,
  jobKey,
  maxProviderMicroUsdFor,
  parseJobKey,
  priceRespectsCostRule,
} from "@/lib/workspace/contracts/jobs";
import {
  ESCALATION_MAX_TOKENS,
  EVAL_JUDGE_MAX_TOKENS,
  PROMPT_TIERS,
  type PromptSpec,
  TIER_MAX_INPUT_TOKENS,
  TIER_MAX_TOKENS,
  TIER_MODELS,
  definePromptSpec,
  isPromptSpecError,
  maxInputTokensForSpec,
  parsePromptRef,
  promptRef,
} from "@/lib/workspace/contracts/prompts";
import {
  type AiBudgetsRow,
  type AiUsageRow,
  BATCH_RESERVATION_SWEEP_AFTER_MS,
  DEEP_ESCALATIONS_PER_OWNER_PER_DAY,
  FREE_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD,
  FREE_LIFETIME_CEILING_MICRO_USD,
  MAX_RESERVATION_MICRO_USD,
  METER_ALARMS,
  METER_ERROR_CODES,
  METER_MAX_INPUT_TOKENS,
  type GatewayErrorCode,
  METER_FEATURES,
  REFUNDS_CREDITS,
  WORKSPACE_GATE_ERROR_CODES,
  OWNER_DAILY_CAP_MICRO_USD,
  PAID_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD,
  RESERVATION_SWEEP_AFTER_MS,
  type ReserveArgs,
  type ReserveState,
  assertReserveArgs,
  chargeOnFail,
  chatAttemptKey,
  firstReserveFailure,
  globalOvershootBoundMicroUsd,
  globalPoolFor,
  int64ToMicroUsd,
  isGatewayErrorData,
  isMeterErrorData,
  isWorkspaceGateErrorData,
  jobAttemptKey,
  lateSettleAdjustment,
  mediaReservation,
  meterMaxInputTokens,
  microUsdToInt64,
  reservationExpiresAt,
  refundsCredits,
  reserveDeltas,
  spendDeltas,
  sweepOutcome,
  toMicroUsd,
  utcDayKey,
  worstCaseReservation,
} from "@/lib/workspace/contracts/metering";

// WP69-S2. C-JOBS, C-PROMPT and C-METER: pure contracts, no provider calls.

function expectCode(fn: () => unknown, code: string) {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown, `expected a throw with code ${code}`).toBeDefined();
  expect((thrown as { code?: unknown }).code).toBe(code);
  return thrown;
}

describe("C-JOBS", () => {
  test("job types are exactly the D19 task literals", () => {
    expect(JOB_TYPES).toEqual([
      "crew_blueprint",
      "crew_roster",
      "crew_brand_kit",
      "crew_landing",
      "crew_email_sequence",
      "crew_social_pack",
      "crew_seo_pack",
      "crew_launch_plan",
      "crew_ads_drafts",
      "crew_build_pack",
      "crew_hire",
      "studio_image",
      "studio_video",
    ]);
  });

  test("credit prices match the D4 table exactly", () => {
    const prices = Object.fromEntries(
      Object.entries(CREDIT_ACTIONS).map(([key, action]) => [key, action.credits]),
    );
    expect(prices).toEqual({
      offer_image_standard: 2,
      offer_image_high_quality: 5,
      post_image: 2,
      short_video: 30,
      launch_film: 150,
      brand_kit_regenerate: 10,
      landing_regenerate: 5,
      email_sequence_regenerate: 3,
      extra_social_pack: 5,
      hire_skipped_specialist: 20,
      build_pack_regenerate: 8,
    });
    expect(PRICES_STATUS).toBe("provisional");
  });

  test("action constraints: short video cheapest tier, film paid plans only", () => {
    expect(CREDIT_ACTIONS.short_video.constraints).toMatchObject({ maxVideoSeconds: 8, providerTier: "cheapest" });
    expect(CREDIT_ACTIONS.launch_film.constraints).toMatchObject({ maxVideoSeconds: 30 });
    expect(actionAllowedOnPlan("launch_film", "free")).toBe(false);
    expect(actionAllowedOnPlan("launch_film", "builders_hub")).toBe(true);
    expect(actionAllowedOnPlan("hire_skipped_specialist", "builders_hub")).toBe(false);
    expect(actionAllowedOnPlan("hire_skipped_specialist", "growth")).toBe(true);
    expect(actionAllowedOnPlan("short_video", "free")).toBe(true);
  });

  // Planning provider costs (03 §7, 2026-11-05). S5 replaces these with measured values.
  const PLANNING_PROVIDER_MICRO_USD: Record<CreditActionKey, number> = {
    offer_image_standard: 20_000,
    offer_image_high_quality: 50_000,
    post_image: 20_000,
    short_video: 400_000,
    launch_film: 1_500_000,
    brand_kit_regenerate: 120_000,
    landing_regenerate: 40_000,
    email_sequence_regenerate: 30_000,
    extra_social_pack: 30_000,
    hire_skipped_specialist: 100_000,
    build_pack_regenerate: 75_000,
  };

  test("the cost rule is $0.013 a credit", () => {
    expect(MAX_PROVIDER_MICRO_USD_PER_CREDIT).toBe(13_000);
    expect(maxProviderMicroUsdFor(10)).toBe(130_000);
    expect(priceRespectsCostRule(10, 130_000)).toBe(true);
    expect(priceRespectsCostRule(10, 130_001)).toBe(false);
  });

  test("every action but short video covers its planning provider cost", () => {
    const failing = (Object.keys(CREDIT_ACTIONS) as CreditActionKey[]).filter(
      (key) => !priceRespectsCostRule(CREDIT_ACTIONS[key].credits, PLANNING_PROVIDER_MICRO_USD[key]),
    );
    // Known: 30 credits × $0.013 = $0.39 < $0.40 planning cost (03 §7: "$0.013" is rounded
    // from $0.0133). Raised to the owner; S5 decides 35 credits or 6 s clips.
    expect(failing).toEqual(["short_video"]);
    expect(maxProviderMicroUsdFor(CREDIT_ACTIONS.short_video.credits)).toBe(390_000);
  });

  test("first draft and change rounds 1–2 are free; round 3 costs the regenerate price", () => {
    expect(FREE_CHANGE_ROUNDS).toBe(2);
    expect(creditCostFor({ jobType: "crew_brand_kit", changeRound: 0, plan: "free" })).toEqual({
      credits: 0,
      free: true,
      reason: "first_draft",
    });
    for (const changeRound of [1, 2]) {
      expect(creditCostFor({ jobType: "crew_brand_kit", changeRound, plan: "free" })).toEqual({
        credits: 0,
        free: true,
        reason: "free_change_round",
      });
    }
    expect(creditCostFor({ jobType: "crew_brand_kit", changeRound: 3, plan: "free" })).toEqual({
      credits: 10,
      free: false,
      reason: "paid_change_round",
      action: "brand_kit_regenerate",
    });
    expect(
      creditCostFor({ jobType: "crew_brand_kit", changeRound: 3, action: "brand_kit_regenerate", plan: "free" }).credits,
    ).toBe(10);
  });

  test("each priced artifact maps to its regenerate action", () => {
    expect(REGENERATE_ACTION_BY_JOB_TYPE).toEqual({
      crew_brand_kit: "brand_kit_regenerate",
      crew_landing: "landing_regenerate",
      crew_email_sequence: "email_sequence_regenerate",
      crew_social_pack: "extra_social_pack",
      crew_build_pack: "build_pack_regenerate",
    });
    const at3 = (jobType: "crew_landing" | "crew_email_sequence" | "crew_social_pack" | "crew_build_pack") =>
      creditCostFor({ jobType, changeRound: 3, plan: "builders_hub" }).credits;
    expect([at3("crew_landing"), at3("crew_email_sequence"), at3("crew_social_pack"), at3("crew_build_pack")]).toEqual([
      5, 3, 5, 8,
    ]);
  });

  test("an extra social pack is always paid", () => {
    expect(
      creditCostFor({ jobType: "crew_social_pack", changeRound: 0, action: "extra_social_pack", plan: "free" }),
    ).toEqual({ credits: 5, free: false, reason: "extra_artifact", action: "extra_social_pack" });
    expect(creditCostFor({ jobType: "crew_social_pack", changeRound: 0, plan: "free" }).free).toBe(true);
  });

  test("studio actions and hiring always cost credits", () => {
    for (const changeRound of [0, 1, 2, 3]) {
      expect(
        creditCostFor({ jobType: "studio_image", changeRound, action: "offer_image_standard", plan: "free" }),
      ).toEqual({ credits: 2, free: false, reason: "always_paid", action: "offer_image_standard" });
    }
    expect(
      creditCostFor({ jobType: "studio_video", changeRound: 0, action: "launch_film", plan: "builders_hub" }).credits,
    ).toBe(150);
    expect(creditCostFor({ jobType: "crew_hire", changeRound: 0, plan: "growth" })).toEqual({
      credits: 20,
      free: false,
      reason: "always_paid",
      action: "hire_skipped_specialist",
    });
  });

  test("plan gates throw PLAN_GATED", () => {
    expectCode(
      () => creditCostFor({ jobType: "studio_video", changeRound: 0, action: "launch_film", plan: "free" }),
      "PLAN_GATED",
    );
    expectCode(() => creditCostFor({ jobType: "crew_hire", changeRound: 0, plan: "builders_hub" }), "PLAN_GATED");
    expectCode(() => creditCostFor({ jobType: "crew_hire", changeRound: 0, plan: "free" }), "PLAN_GATED");
  });

  test("unpriced artifacts throw PRICE_NOT_SET past the free rounds", () => {
    expect(PRICE_TBD_JOB_TYPES).toEqual([
      "crew_blueprint",
      "crew_roster",
      "crew_seo_pack",
      "crew_launch_plan",
      "crew_ads_drafts",
    ]);
    expect(creditCostFor({ jobType: "crew_blueprint", changeRound: 2, plan: "free" }).free).toBe(true);
    const error = expectCode(
      () => creditCostFor({ jobType: "crew_blueprint", changeRound: 3, plan: "growth" }),
      "PRICE_NOT_SET",
    );
    expect(isJobsContractError(error)).toBe(true);
  });

  test("impossible combinations throw typed errors", () => {
    const base = { plan: "free" } as const;
    expectCode(() => creditCostFor({ ...base, jobType: "crew_landing", changeRound: -1 }), "INVALID_CHANGE_ROUND");
    expectCode(() => creditCostFor({ ...base, jobType: "crew_landing", changeRound: 1.5 }), "INVALID_CHANGE_ROUND");
    expectCode(() => creditCostFor({ ...base, jobType: "studio_image", changeRound: 0 }), "ACTION_REQUIRED");
    expectCode(
      () => creditCostFor({ ...base, jobType: "studio_image", changeRound: 0, action: "short_video" }),
      "ACTION_JOB_MISMATCH",
    );
    expectCode(() => creditCostFor({ ...base, jobType: "nope" as never, changeRound: 0 }), "UNKNOWN_JOB_TYPE");
    expectCode(
      () => creditCostFor({ jobType: "crew_landing", changeRound: 0, plan: "builder" as never }),
      "UNKNOWN_PLAN",
    );
    expect(isJobsContractError(new Error("plain"))).toBe(false);
  });

  test("plan ids and the reference table (02 §4.3)", () => {
    expect(WORKSPACE_PLAN_IDS).toEqual(["free", "builders_hub", "growth"]);
    expect(STARTER_CREDITS).toBe(50);
    expect(MONTHLY_CREDIT_ALLOWANCE).toEqual({ free: 0, builders_hub: 500, growth: 2_000 });

    const limit = (key: "businesses" | "monthlyCredits" | "wrenMessagesPerDay" | "outboundSendsPerDay" | "members") =>
      WORKSPACE_PLAN_IDS.map((plan) => WORKSPACE_PLAN_REFERENCE[plan].limits[key]);
    expect(limit("businesses")).toEqual([1, 1, 3]);
    expect(limit("monthlyCredits")).toEqual([0, 500, 2_000]);
    expect(limit("wrenMessagesPerDay")).toEqual([40, 300, 600]);
    expect(limit("outboundSendsPerDay")).toEqual([0, 20, 100]);
    expect(limit("members")).toEqual([1, 1, 3]);
    expect(WORKSPACE_PLAN_REFERENCE.free.limits.tenantEmailSends).toEqual({
      count: 50,
      period: "lifetime",
      enforcement: "hard",
    });
    expect(WORKSPACE_PLAN_REFERENCE.builders_hub.limits.tenantEmailSends).toEqual({
      count: 5_000,
      period: "month",
      enforcement: "soft",
    });
    expect(WORKSPACE_PLAN_REFERENCE.growth.limits.tenantEmailSends).toMatchObject({ count: 20_000, period: "month" });

    for (const feature of ["autopilot", "adsLive", "nativePublishing", "customDomain", "studioLongVideo"] as const) {
      expect(WORKSPACE_PLAN_IDS.map((plan) => WORKSPACE_PLAN_REFERENCE[plan].features[feature])).toEqual([
        false,
        true,
        true,
      ]);
    }
    expect(WORKSPACE_PLAN_IDS.map((plan) => WORKSPACE_PLAN_REFERENCE[plan].features.hireSkippedRoles)).toEqual([
      false,
      false,
      true,
    ]);
    expect(WORKSPACE_FEATURE_KEYS).toHaveLength(6);
  });

  test("jobKey round-trips with a subject", () => {
    const key = jobKey("j57abc123", "crew_brand_kit", "main", 3);
    expect(key).toBe("crew:j57abc123:crew_brand_kit:main:3");
    expect(parseJobKey(key)).toEqual({ projectId: "j57abc123", jobType: "crew_brand_kit", subject: "main", revision: 3 });
    for (const type of JOB_TYPES) {
      const subject = type === "crew_hire" || type.startsWith("studio_") ? "req-1" : "main";
      expect(parseJobKey(jobKey("p1", type, subject, 0))).toEqual({ projectId: "p1", jobType: type, subject, revision: 0 });
    }
  });

  test("hires and studio renders get distinct keys per subject", () => {
    expect(jobKey("p1", "crew_hire", "merch", 0)).not.toBe(jobKey("p1", "crew_hire", "outbound", 0));
    expect(jobKey("p1", "studio_image", "req-a", 0)).not.toBe(jobKey("p1", "studio_image", "req-b", 0));
    expect(jobKey("p1", "crew_social_pack", "extra-7", 0)).not.toBe(jobKey("p1", "crew_social_pack", "main", 0));
  });

  test("jobKey rejects bad parts and parseJobKey rejects bad strings", () => {
    expectCode(() => jobKey("a:b", "crew_landing", "main", 0), "INVALID_JOB_KEY");
    expectCode(() => jobKey("", "crew_landing", "main", 0), "INVALID_JOB_KEY");
    expectCode(() => jobKey("p1", "crew_landing", "main", 1.5), "INVALID_JOB_KEY");
    expectCode(() => jobKey("p1", "crew_landing", "hero", 0), "INVALID_JOB_KEY");
    expectCode(() => jobKey("p1", "crew_hire", "main", 0), "INVALID_JOB_KEY");
    expectCode(() => jobKey("p1", "studio_image", "a:b", 0), "INVALID_JOB_KEY");
    expectCode(() => jobKey("p1", "studio_image", "x".repeat(65), 0), "INVALID_JOB_KEY");
    expect(jobKey("p1", "studio_image", "x".repeat(64), 0)).toContain("x".repeat(64));
    expect(parseJobKey("crew:p1:crew_unknown:main:0")).toBeNull();
    expect(parseJobKey("crew:p1:crew_landing:main:-1")).toBeNull();
    expect(parseJobKey("crew:p1:crew_landing:main:01")).toBeNull();
    expect(parseJobKey("crew:p1:crew_landing:0")).toBeNull();
    expect(parseJobKey("crew:p1:crew_hire:main:0")).toBeNull();
    expect(parseJobKey("task:p1:crew_landing:main:0")).toBeNull();
  });
});

describe("C-PROMPT", () => {
  const schema = z.object({ headline: z.string().max(80) });
  type Output = z.infer<typeof schema>;
  type Input = { businessName: string };

  const good: PromptSpec<Input, Output> = {
    id: "crew-landing-spec",
    version: 1,
    tier: "draft",
    effort: "low",
    thinking: { type: "between_tools" },
    maxTokens: 6_000,
    system: "stable system block",
    buildUser: (inputs) => `Business: ${inputs.businessName}`,
    outputSchema: schema,
    cacheLayout: { system: "stable", business: "per_business", ttl: "5m" },
    evalSuite: "crew-landing",
    mode: "realtime",
    fallbacks: "none",
  };
  const deepBase: PromptSpec<Input, Output> = { ...good, tier: "deep", effort: "medium", thinking: { type: "adaptive" } };

  test("tiers map to the 5.5 models", () => {
    expect(PROMPT_TIERS).toEqual(["fast", "draft", "deep"]);
    expect(TIER_MODELS).toEqual({
      fast: "claude-haiku-5-5",
      draft: "claude-sonnet-5-5",
      deep: "claude-opus-5-5",
    });
  });

  test("accepts a good spec and freezes it", () => {
    const spec = definePromptSpec(good);
    expect(spec.id).toBe("crew-landing-spec");
    expect(Object.isFrozen(spec)).toBe(true);
    expect(spec.buildUser({ businessName: "HydroTrail" })).toBe("Business: HydroTrail");
    expect(definePromptSpec({ ...deepBase, id: "idea-seed", mode: "batch", maxTokens: 20_000 }).tier).toBe("deep");
    expect(
      definePromptSpec({ ...good, id: "wren-chat", tier: "fast", thinking: { type: "adaptive" }, maxTokens: 1_024 }).tier,
    ).toBe("fast");
  });

  test("rejects missing effort and missing maxTokens", () => {
    const noEffort = { ...good, effort: undefined } as unknown as PromptSpec<Input, Output>;
    expect(isPromptSpecError(expectCode(() => definePromptSpec(noEffort), "MISSING_EFFORT"))).toBe(true);
    const noMax = { ...good, maxTokens: undefined } as unknown as PromptSpec<Input, Output>;
    expectCode(() => definePromptSpec(noMax), "MISSING_MAX_TOKENS");
  });

  test("rejects maxTokens over the tier cap", () => {
    expect(TIER_MAX_TOKENS).toEqual({ fast: 4_096, draft: 12_288, deep: 24_576 });
    expect(definePromptSpec({ ...good, maxTokens: TIER_MAX_TOKENS.draft }).maxTokens).toBe(12_288);
    expectCode(() => definePromptSpec({ ...good, maxTokens: TIER_MAX_TOKENS.draft + 1 }), "MAX_TOKENS_OVER_CAP");
    expectCode(
      () => definePromptSpec({ ...good, tier: "fast", thinking: { type: "adaptive" }, maxTokens: 5_000 }),
      "MAX_TOKENS_OVER_CAP",
    );
  });

  test("deep realtime needs a purpose, each with its own cap", () => {
    expectCode(() => definePromptSpec(deepBase), "DEEP_REALTIME_WITHOUT_PURPOSE");
    expect(definePromptSpec({ ...deepBase, purpose: "escalation" }).purpose).toBe("escalation");
    expectCode(
      () => definePromptSpec({ ...deepBase, purpose: "escalation", maxTokens: ESCALATION_MAX_TOKENS + 1 }),
      "MAX_TOKENS_OVER_CAP",
    );
    expect(EVAL_JUDGE_MAX_TOKENS).toBe(4_096);
    expect(definePromptSpec({ ...deepBase, purpose: "eval_judge", maxTokens: 4_096 }).purpose).toBe("eval_judge");
    expectCode(() => definePromptSpec({ ...deepBase, purpose: "eval_judge", maxTokens: 4_097 }), "MAX_TOKENS_OVER_CAP");
    expectCode(() => definePromptSpec({ ...good, purpose: "escalation" }), "INVALID_PURPOSE");
    expectCode(() => definePromptSpec({ ...deepBase, mode: "batch", purpose: "eval_judge" }), "INVALID_PURPOSE");
  });

  test("only deep runs in batch", () => {
    expectCode(() => definePromptSpec({ ...good, mode: "batch" }), "INVALID_MODE");
  });

  test("fallbacks must be none", () => {
    const withFallbacks = { ...good, fallbacks: "default" } as unknown as PromptSpec<Input, Output>;
    expectCode(() => definePromptSpec(withFallbacks), "INVALID_FALLBACKS");
    const missing = { ...good, fallbacks: undefined } as unknown as PromptSpec<Input, Output>;
    expectCode(() => definePromptSpec(missing), "INVALID_FALLBACKS");
  });

  test("rejects thinking the tier's model refuses", () => {
    expectCode(() => definePromptSpec({ ...good, thinking: { type: "disabled" } }), "INVALID_THINKING");
    expectCode(
      () => definePromptSpec({ ...good, effort: "xhigh", thinking: { type: "between_tools" } }),
      "INVALID_THINKING",
    );
    expectCode(
      () => definePromptSpec({ ...deepBase, mode: "batch", thinking: { type: "between_tools" } }),
      "INVALID_THINKING",
    );
    expectCode(
      () => definePromptSpec({ ...good, thinking: undefined } as unknown as PromptSpec<Input, Output>),
      "INVALID_THINKING",
    );
  });

  test("rejects a bad id, version, cache layout", () => {
    expectCode(() => definePromptSpec({ ...good, id: "Crew_Landing" }), "INVALID_ID");
    expectCode(() => definePromptSpec({ ...good, version: 0 }), "INVALID_VERSION");
    expectCode(
      () =>
        definePromptSpec({
          ...good,
          cacheLayout: { system: "stable", business: "none", ttl: "1h" },
        } as unknown as PromptSpec<Input, Output>),
      "INVALID_CACHE_LAYOUT",
    );
  });

  test("input ceilings per lane, mirrored by the meter", () => {
    expect(TIER_MAX_INPUT_TOKENS).toEqual({ fast: 40_000, draft: 60_000, deep_realtime: 60_000, deep_batch: 120_000 });
    expect(METER_MAX_INPUT_TOKENS).toEqual(TIER_MAX_INPUT_TOKENS);
    expect(maxInputTokensForSpec({ tier: "deep", mode: "batch" })).toBe(120_000);
    expect(maxInputTokensForSpec({ tier: "deep", mode: "realtime" })).toBe(meterMaxInputTokens("deep", false));
    expect(maxInputTokensForSpec({ tier: "fast", mode: "realtime" })).toBe(meterMaxInputTokens("fast", false));
  });

  test("promptRef round-trips", () => {
    const ref = promptRef(definePromptSpec({ ...good, version: 12 }));
    expect(ref).toBe("crew-landing-spec@12");
    expect(parsePromptRef(ref)).toEqual({ id: "crew-landing-spec", version: 12 });
    expect(parsePromptRef("crew-landing-spec@0")).toBeNull();
    expect(parsePromptRef("crew-landing-spec")).toBeNull();
    expect(parsePromptRef("Crew@1")).toBeNull();
  });
});

describe("C-METER", () => {
  const OPUS = { input: 4, output: 20, cacheWrite: 5 } as const;

  test("budget defaults, limits and alarms (D3, 03 §9)", () => {
    expect(FREE_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD).toBe(50_000_000);
    expect(PAID_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD).toBe(50_000_000);
    expect(FREE_LIFETIME_CEILING_MICRO_USD).toBe(1_500_000);
    expect(OWNER_DAILY_CAP_MICRO_USD).toEqual({ free: 1_000_000, builders_hub: 5_000_000, growth: 5_000_000 });
    expect(METER_ALARMS.globalDailyBudgetPercents).toEqual([80, 100]);
    expect(METER_ALARMS.ownerDailyMicroUsd).toBe(3_000_000);
    expect(RESERVATION_SWEEP_AFTER_MS).toBe(900_000);
    expect(BATCH_RESERVATION_SWEEP_AFTER_MS).toBe(25 * 3_600_000);
    expect(reservationExpiresAt(1_000, false)).toBe(901_000);
    expect(reservationExpiresAt(1_000, true)).toBe(1_000 + 90_000_000);
    expect(DEEP_ESCALATIONS_PER_OWNER_PER_DAY).toBe(3);
    expect(METER_ERROR_CODES).toEqual(["BUDGET_EXHAUSTED", "AI_DISABLED"]);
  });

  test("micro-USD converts to and from int64 storage at the boundary", () => {
    expect(microUsdToInt64(0)).toBe(BigInt(0));
    expect(microUsdToInt64(66_000)).toBe(BigInt(66_000));
    expect(microUsdToInt64(Number.MAX_SAFE_INTEGER)).toBe(BigInt(Number.MAX_SAFE_INTEGER));
    for (const bad of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, -0.000001]) {
      expect(() => microUsdToInt64(bad)).toThrow(RangeError);
    }
    expect(int64ToMicroUsd(BigInt(0))).toBe(0);
    expect(int64ToMicroUsd(BigInt(1_500_000))).toBe(1_500_000);
    expect(int64ToMicroUsd(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => int64ToMicroUsd(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))).toThrow(RangeError);
    expect(() => int64ToMicroUsd(BigInt(-1))).toThrow(RangeError);
    expect(() => int64ToMicroUsd(1 as unknown as bigint)).toThrow(TypeError);
    for (const n of [0, 1, 999_999, 50_000_000, Number.MAX_SAFE_INTEGER]) {
      expect(int64ToMicroUsd(microUsdToInt64(n))).toBe(n);
    }
  });

  test("gate error codes sit alongside the meter codes", () => {
    expect(WORKSPACE_GATE_ERROR_CODES).toEqual(["AI_DISABLED", "WORKSPACE_DISABLED", "RESOURCE_NOT_FOUND", "UNAUTHENTICATED"]);
    const all: readonly GatewayErrorCode[] = [...METER_ERROR_CODES, ...WORKSPACE_GATE_ERROR_CODES];
    expect(new Set(all)).toEqual(new Set(["BUDGET_EXHAUSTED", "AI_DISABLED", "WORKSPACE_DISABLED", "RESOURCE_NOT_FOUND", "UNAUTHENTICATED"]));
    // Gate codes are not meter error data: the meter never raises them itself.
    expect(isMeterErrorData({ code: "WORKSPACE_DISABLED", message: "off" })).toBe(false);
    expect(isMeterErrorData({ code: "RESOURCE_NOT_FOUND", message: "missing" })).toBe(false);
    expect(isMeterErrorData({ code: "UNAUTHENTICATED", message: "signed out" })).toBe(false);
  });

  test("gate error data has a contract shape (C-OPS throws { code })", () => {
    // What C-OPS and C-AUTHZ throw today.
    for (const code of WORKSPACE_GATE_ERROR_CODES) {
      expect(isWorkspaceGateErrorData({ code }), code).toBe(true);
      expect(isWorkspaceGateErrorData({ code, message: "closed" }), code).toBe(true);
      expect(isGatewayErrorData({ code }), code).toBe(true);
    }
    for (const scope of METER_FEATURES) {
      expect(isWorkspaceGateErrorData({ code: "AI_DISABLED", scope })).toBe(true);
    }
    // A gate-raised AI_DISABLED may only name a meter feature.
    for (const scope of ["workspace", "publish", "email", "ads", "", 1]) {
      expect(isWorkspaceGateErrorData({ code: "AI_DISABLED", scope }), String(scope)).toBe(false);
      expect(isGatewayErrorData({ code: "AI_DISABLED", scope, message: "off" }), String(scope)).toBe(false);
    }
    expect(isWorkspaceGateErrorData({ code: "WORKSPACE_DISABLED", scope: "publish" })).toBe(false);
    expect(isWorkspaceGateErrorData({ code: "RESOURCE_NOT_FOUND", scope: "ai" })).toBe(false);
    expect(isWorkspaceGateErrorData({ code: "UNAUTHENTICATED", scope: "workspace" })).toBe(false);
    expect(isWorkspaceGateErrorData({ code: "RESOURCE_NOT_FOUND", message: 404 })).toBe(false);
    for (const bad of [null, undefined, "AI_DISABLED", [], {}, { code: "BUDGET_EXHAUSTED", scope: "owner_daily" }, { code: "UNAUTHORIZED" }]) {
      expect(isWorkspaceGateErrorData(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  test("isGatewayErrorData covers meter and gate errors", () => {
    expect(isGatewayErrorData({ code: "BUDGET_EXHAUSTED", scope: "owner_daily", message: "cap" })).toBe(true);
    expect(isGatewayErrorData({ code: "AI_DISABLED", scope: "studioVideo", message: "off" })).toBe(true);
    expect(isGatewayErrorData({ code: "AI_DISABLED" })).toBe(true);
    expect(isGatewayErrorData({ code: "BUDGET_EXHAUSTED", message: "no scope" })).toBe(false);
    expect(isGatewayErrorData({ code: "INVALID_BUDGET" })).toBe(false);
  });

  test("every gate code and pre-call meter code refunds the task's credits", () => {
    const all: GatewayErrorCode[] = [...new Set<GatewayErrorCode>([...METER_ERROR_CODES, ...WORKSPACE_GATE_ERROR_CODES])];
    expect(Object.keys(REFUNDS_CREDITS).sort()).toEqual([...all].sort());
    for (const code of all) expect(refundsCredits(code), code).toBe(true);
    expect(REFUNDS_CREDITS.UNAUTHENTICATED).toBe(true);
  });

  test("toMicroUsd mirrors the engine helper", () => {
    for (const usd of [0, 0.013, 0.4, 1.5, 0.0000001]) {
      expect(toMicroUsd(usd)).toBe(engineToMicroUsd(usd));
    }
    expect(() => toMicroUsd(-1)).toThrow();
  });

  test("worstCaseReservation rounds up and is at least 1", () => {
    // Sonnet 5.5: 3,000 in × $2 + 6,000 out × $10 = 66,000 micro-USD exactly.
    expect(worstCaseReservation({ inputTokensEstimate: 3_000, maxTokens: 6_000, ratePerMTok: { input: 2, output: 10 } })).toBe(
      66_000,
    );
    // Haiku 5.5: 1,001 × $0.10 + 3 × $0.50 = 101.6 → 102; float noise (0.1 × 1000) adds nothing.
    expect(worstCaseReservation({ inputTokensEstimate: 1_001, maxTokens: 3, ratePerMTok: { input: 0.1, output: 0.5 } })).toBe(
      102,
    );
    expect(worstCaseReservation({ inputTokensEstimate: 1_000, maxTokens: 1, ratePerMTok: { input: 0.1, output: 0 } })).toBe(
      100,
    );
    // Zero rates still reserve 1 micro-USD.
    expect(worstCaseReservation({ inputTokensEstimate: 5_000, maxTokens: 100, ratePerMTok: { input: 0, output: 0 } })).toBe(1);
    // Cache writes at 1.25× input are the worst case for input tokens.
    expect(
      worstCaseReservation({ inputTokensEstimate: 4_000, maxTokens: 1, ratePerMTok: { input: 2, output: 10, cacheWrite: 2.5 } }),
    ).toBe(10_010);
    expect(() => worstCaseReservation({ inputTokensEstimate: 1, maxTokens: 0, ratePerMTok: { input: 1, output: 1 } })).toThrow();
    expect(() =>
      worstCaseReservation({
        inputTokensEstimate: 60_001,
        maxTokens: 1,
        ratePerMTok: OPUS,
        maxInputTokens: meterMaxInputTokens("deep", false),
      }),
    ).toThrow(RangeError);
  });

  test("the worst escalation reservation fits inside a Free owner's $1 day", () => {
    const worst = worstCaseReservation({
      inputTokensEstimate: meterMaxInputTokens("deep", false),
      maxTokens: ESCALATION_MAX_TOKENS,
      ratePerMTok: OPUS,
      maxInputTokens: meterMaxInputTokens("deep", false),
    });
    expect(worst).toBe(545_760);
    expect(worst).toBeLessThan(OWNER_DAILY_CAP_MICRO_USD.free);
  });

  test("mediaReservation rounds up and is at least 1", () => {
    expect(mediaReservation({ kind: "image", unitMicroUsd: 30_000, count: 3 })).toBe(90_000);
    expect(mediaReservation({ kind: "image", unitMicroUsd: 0.4, count: 1 })).toBe(1);
    expect(mediaReservation({ kind: "image", unitMicroUsd: 0, count: 2 })).toBe(1);
    expect(mediaReservation({ kind: "video", microUsdPerSecond: 50_000, maxSeconds: 30 })).toBe(1_500_000);
    expect(mediaReservation({ kind: "video", microUsdPerSecond: 50_000.5, maxSeconds: 1 })).toBe(50_001);
    expect(mediaReservation({ kind: "video", microUsdPerSecond: 50_000, maxSeconds: 30 })).toBeLessThanOrEqual(
      MAX_RESERVATION_MICRO_USD,
    );
    expect(() => mediaReservation({ kind: "image", unitMicroUsd: 1, count: 0 })).toThrow();
    expect(() => mediaReservation({ kind: "video", microUsdPerSecond: -1, maxSeconds: 8 })).toThrow();
  });

  test("chargeOnFail never returns 0 when the provider may have billed", () => {
    expect(chargeOnFail({ reservedMicroUsd: 66_000, billed: "possible" })).toBe(66_000);
    expect(chargeOnFail({ reservedMicroUsd: 66_000, billed: "possible", costMicroUsd: 0 })).toBe(66_000);
    expect(chargeOnFail({ reservedMicroUsd: 1, billed: "possible", costMicroUsd: 0 })).toBe(1);
    expect(chargeOnFail({ reservedMicroUsd: 66_000, billed: "possible", costMicroUsd: 90_000 })).toBe(90_000);
    expect(chargeOnFail({ reservedMicroUsd: 66_000, billed: "actual", costMicroUsd: 12_345 })).toBe(12_345);
    expect(chargeOnFail({ reservedMicroUsd: 66_000, billed: "actual" })).toBe(66_000);
    expect(chargeOnFail({ reservedMicroUsd: 66_000, billed: "none" })).toBe(0);
    expect(() => chargeOnFail({ reservedMicroUsd: 0, billed: "possible" })).toThrow();
  });

  test("isMeterErrorData accepts and rejects", () => {
    expect(isMeterErrorData({ code: "BUDGET_EXHAUSTED", scope: "global_daily_free", message: "x" })).toBe(true);
    expect(isMeterErrorData({ code: "BUDGET_EXHAUSTED", scope: "global_daily_paid", message: "x" })).toBe(true);
    expect(isMeterErrorData({ code: "BUDGET_EXHAUSTED", scope: "owner_free_lifetime", message: "x" })).toBe(true);
    expect(isMeterErrorData({ code: "AI_DISABLED", message: "x" })).toBe(true);
    expect(isMeterErrorData({ code: "AI_DISABLED", scope: "studioVideo", message: "x" })).toBe(true);
    expect(isMeterErrorData({ code: "BUDGET_EXHAUSTED", scope: "global_daily", message: "x" })).toBe(false);
    expect(isMeterErrorData({ code: "BUDGET_EXHAUSTED", message: "x" })).toBe(false);
    expect(isMeterErrorData({ code: "AI_DISABLED", scope: "owner_daily", message: "x" })).toBe(false);
    expect(isMeterErrorData({ code: "RATE_LIMITED", message: "x" })).toBe(false);
    expect(isMeterErrorData({ code: "AI_DISABLED" })).toBe(false);
    expect(isMeterErrorData(null)).toBe(false);
    expect(isMeterErrorData("BUDGET_EXHAUSTED")).toBe(false);
    expect(isMeterErrorData([])).toBe(false);
  });

  test("utcDayKey is the UTC date", () => {
    expect(utcDayKey(Date.UTC(2026, 10, 5, 23, 59, 59))).toBe("2026-11-05");
    expect(utcDayKey(Date.UTC(2026, 10, 6, 0, 0, 0))).toBe("2026-11-06");
  });

  test("attempt keys", () => {
    const key = jobKey("p1", "crew_landing", "main", 2);
    expect(jobAttemptKey(key, 1)).toBe("crew:p1:crew_landing:main:2:1");
    expect(chatAttemptKey("p1", "m9", 2)).toBe("chat:p1:m9:2");
    expect(() => jobAttemptKey(key, 0)).toThrow();
    expect(() => jobAttemptKey("landing", 1)).toThrow();
    expect(() => chatAttemptKey("p:1", "m9", 1)).toThrow();
  });

  describe("assertReserveArgs", () => {
    const args: ReserveArgs = {
      ownerId: "u1",
      projectId: "p1",
      taskId: "t1",
      attemptKey: "crew:p1:crew_landing:main:0:1",
      promptRef: "crew-landing-spec@1",
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      tier: "draft",
      feature: "ai",
      reservedMicroUsd: 66_000,
    };

    test("accepts good args", () => {
      expect(() => assertReserveArgs(args)).not.toThrow();
      expect(() => assertReserveArgs({ ...args, tier: "deep", model: "claude-opus-5-5", batch: true })).not.toThrow();
      expect(() => assertReserveArgs({ ...args, creditDebitId: "l1" })).not.toThrow();
    });

    test("batch is deep only; escalation is realtime deep only", () => {
      expect(() => assertReserveArgs({ ...args, batch: true })).toThrow(RangeError);
      expect(() => assertReserveArgs({ ...args, escalation: true })).toThrow(RangeError);
      expect(() => assertReserveArgs({ ...args, tier: "deep", batch: true, escalation: true })).toThrow(RangeError);
    });

    test("rejects missing attempt key, oversized reservation, mismatched provider, unanchored debit", () => {
      expect(() => assertReserveArgs({ ...args, attemptKey: "" })).toThrow(RangeError);
      expect(() => assertReserveArgs({ ...args, reservedMicroUsd: MAX_RESERVATION_MICRO_USD + 1 })).toThrow(RangeError);
      expect(() => assertReserveArgs({ ...args, reservedMicroUsd: 0 })).toThrow(RangeError);
      expect(() => assertReserveArgs({ ...args, provider: "recraft" })).toThrow(RangeError);
      expect(() => assertReserveArgs({ ...args, feature: "studioVideo" })).toThrow(RangeError);
      expect(() => assertReserveArgs({ ...args, taskId: undefined, creditDebitId: "l1" })).toThrow(RangeError);
    });
  });

  describe("firstReserveFailure", () => {
    const today = "2026-11-05";
    const pool = { budgetMicroUsd: 50_000_000, spentTodayMicroUsd: 0, inFlightMicroUsd: 0 };
    const zero: AiBudgetsRow = {
      ownerId: "u1",
      freeLifetimeSpentMicroUsd: 0,
      reservedMicroUsd: 0,
      freeReservedMicroUsd: 0,
      dayKey: today,
      daySpentMicroUsd: 0,
      dayEscalations: 0,
    };
    const open: ReserveState = {
      dayKey: today,
      killSwitches: { ai: false, studioVideo: false },
      global: { free: pool, paid: pool },
      owner: { plan: "free", budgets: zero },
    };
    const input = { ownerId: "u1", feature: "ai", reservedMicroUsd: 66_000, creditFunded: false } as const;
    const withOwner = (plan: "free" | "growth", budgets: Partial<AiBudgetsRow> | null): ReserveState => ({
      ...open,
      owner: { plan, budgets: budgets === null ? null : { ...zero, ...budgets } },
    });

    test("passes when every budget has room", () => {
      expect(firstReserveFailure(open, input)).toBeNull();
    });

    test("kill switches first, even with every budget exhausted", () => {
      const allBad: ReserveState = {
        ...withOwner("free", { freeLifetimeSpentMicroUsd: 9_999_999, daySpentMicroUsd: 9_999_999 }),
        killSwitches: { ai: true, studioVideo: true },
        global: { free: { ...pool, budgetMicroUsd: 0 }, paid: { ...pool, budgetMicroUsd: 0 } },
      };
      expect(firstReserveFailure(allBad, input)).toMatchObject({ code: "AI_DISABLED", scope: "ai" });
      const videoOff = { ...open, killSwitches: { ai: false, studioVideo: true } };
      expect(firstReserveFailure(videoOff, { ...input, feature: "studioVideo" })).toMatchObject({ scope: "studioVideo" });
      expect(firstReserveFailure(videoOff, input)).toBeNull();
    });

    test("global pools: free work vs credit-funded and paid-plan work", () => {
      expect(globalPoolFor({ plan: "free", creditFunded: false })).toBe("free");
      expect(globalPoolFor({ plan: "free", creditFunded: true })).toBe("paid");
      expect(globalPoolFor({ plan: "growth", creditFunded: false })).toBe("paid");
      expect(globalPoolFor({ plan: undefined, creditFunded: false })).toBe("free");

      // In-flight reservations count toward the global check.
      const freeFull: ReserveState = { ...open, global: { free: { ...pool, inFlightMicroUsd: 49_950_000 }, paid: pool } };
      expect(firstReserveFailure(freeFull, input)).toMatchObject({ code: "BUDGET_EXHAUSTED", scope: "global_daily_free" });
      expect(firstReserveFailure(freeFull, { ...input, creditFunded: true })).toBeNull();
      const paidFull: ReserveState = { ...open, global: { free: pool, paid: { ...pool, spentTodayMicroUsd: 50_000_000 } } };
      expect(firstReserveFailure({ ...paidFull, owner: { plan: "growth", budgets: zero } }, input)).toMatchObject({
        scope: "global_daily_paid",
      });
      expect(globalOvershootBoundMicroUsd({ maxInFlightReservations: 20 })).toBe(20 * MAX_RESERVATION_MICRO_USD);
    });

    test("then Free lifetime, then owner daily, then escalations", () => {
      const nearLifetime = withOwner("free", { freeLifetimeSpentMicroUsd: 1_450_000, daySpentMicroUsd: 999_999 });
      expect(firstReserveFailure(nearLifetime, input)).toMatchObject({ scope: "owner_free_lifetime" });
      // Credit-funded work is outside the Free ceiling (D3) but not the daily cap.
      expect(firstReserveFailure(nearLifetime, { ...input, creditFunded: true })).toMatchObject({ scope: "owner_daily" });
      // Paid plans have no lifetime ceiling and a $5 daily cap.
      expect(firstReserveFailure({ ...nearLifetime, owner: { ...nearLifetime.owner!, plan: "growth" } }, input)).toBeNull();
      // All in-flight reservations count toward the daily cap.
      expect(firstReserveFailure(withOwner("free", { reservedMicroUsd: 950_000 }), input)).toMatchObject({
        scope: "owner_daily",
      });
      // Escalations are capped per day.
      const escalated = withOwner("growth", { dayEscalations: DEEP_ESCALATIONS_PER_OWNER_PER_DAY });
      expect(firstReserveFailure(escalated, { ...input, escalation: true })).toMatchObject({
        scope: "owner_daily_escalations",
      });
      expect(firstReserveFailure(escalated, input)).toBeNull();
      // A new UTC day resets day spend and escalations.
      const yesterday = withOwner("growth", { dayKey: "2026-11-04", daySpentMicroUsd: 5_000_000, dayEscalations: 3 });
      expect(firstReserveFailure(yesterday, { ...input, escalation: true })).toBeNull();
    });

    test("credit-funded reservations in flight do not block Free work", () => {
      // 1.4M reserved for credit-funded renders, but only 0 of it is Free work.
      const state = withOwner("free", { reservedMicroUsd: 0, freeReservedMicroUsd: 0, freeLifetimeSpentMicroUsd: 1_400_000 });
      expect(firstReserveFailure(state, input)).toBeNull();
      const freeInFlight = withOwner("free", { freeReservedMicroUsd: 50_000, freeLifetimeSpentMicroUsd: 1_400_000 });
      expect(firstReserveFailure(freeInFlight, input)).toMatchObject({ scope: "owner_free_lifetime" });
    });

    test("fails closed: a missing budgets row is a zero row and caps still apply", () => {
      expect(firstReserveFailure(withOwner("free", null), input)).toBeNull();
      expect(firstReserveFailure(withOwner("free", null), { ...input, reservedMicroUsd: 1_000_001 })).toMatchObject({
        scope: "owner_daily",
      });
      expect(() => firstReserveFailure({ ...open, owner: undefined }, input)).toThrow(RangeError);
    });

    test("fails closed: NaN, negative or fractional state throws", () => {
      expect(() => firstReserveFailure(withOwner("free", { daySpentMicroUsd: Number.NaN }), input)).toThrow(RangeError);
      expect(() => firstReserveFailure(withOwner("free", { freeLifetimeSpentMicroUsd: -1 }), input)).toThrow(RangeError);
      expect(() => firstReserveFailure(withOwner("free", { reservedMicroUsd: 0.5 }), input)).toThrow(RangeError);
      const badGlobal: ReserveState = { ...open, global: { free: { ...pool, spentTodayMicroUsd: Number.NaN }, paid: pool } };
      expect(() => firstReserveFailure(badGlobal, input)).toThrow(RangeError);
      expect(() => firstReserveFailure(open, { ...input, reservedMicroUsd: Number.NaN })).toThrow(RangeError);
    });

    test("ownerless calls (precompute, evals) skip owner checks", () => {
      const noOwner: ReserveState = { ...open, owner: undefined };
      expect(firstReserveFailure(noOwner, { ...input, ownerId: undefined })).toBeNull();
    });
  });

  describe("row lifecycle helpers", () => {
    const row: Pick<
      AiUsageRow,
      "ownerId" | "plan" | "creditFunded" | "reservedMicroUsd" | "escalation" | "globalPool" | "dayKey" | "status" | "expiresAt" | "sentAt"
    > = {
      ownerId: "u1",
      plan: "free",
      creditFunded: false,
      reservedMicroUsd: 66_000,
      globalPool: "free",
      dayKey: "2026-11-05",
      status: "reserved",
      expiresAt: 1_000,
    };

    test("reserve and spend deltas track Free reservations separately", () => {
      expect(reserveDeltas(row).owner).toEqual({ reservedMicroUsd: 66_000, freeReservedMicroUsd: 66_000, dayEscalations: 0 });
      const credit = { ...row, creditFunded: true, globalPool: "paid" as const };
      expect(reserveDeltas(credit).owner).toEqual({ reservedMicroUsd: 66_000, freeReservedMicroUsd: 0, dayEscalations: 0 });
      expect(spendDeltas({ row, spendMicroUsd: 40_000, releaseReservation: true, budgetsDayKey: "2026-11-05" })).toEqual({
        owner: {
          reservedMicroUsd: -66_000,
          freeReservedMicroUsd: -66_000,
          daySpentMicroUsd: 40_000,
          freeLifetimeSpentMicroUsd: 40_000,
        },
        global: { pool: "free", dayKey: "2026-11-05", spentMicroUsd: 40_000, inFlightMicroUsd: -66_000 },
      });
      // Settle's lifetime add applies only to Free non-credit work.
      expect(
        spendDeltas({ row: credit, spendMicroUsd: 40_000, releaseReservation: true, budgetsDayKey: "2026-11-05" }).owner,
      ).toMatchObject({ freeLifetimeSpentMicroUsd: 0, freeReservedMicroUsd: 0 });
      // A settle after the owner's row rolled to a new day leaves today's spend alone.
      expect(
        spendDeltas({ row, spendMicroUsd: 40_000, releaseReservation: true, budgetsDayKey: "2026-11-06" }).owner,
      ).toMatchObject({ daySpentMicroUsd: 0, freeLifetimeSpentMicroUsd: 40_000 });
      // An ownerless row only moves the global counter.
      expect(
        spendDeltas({ row: { ...row, ownerId: undefined, plan: undefined }, spendMicroUsd: 1, releaseReservation: true, budgetsDayKey: null })
          .owner,
      ).toBeNull();
    });

    test("the sweep charges the worst case only when the request was sent", () => {
      expect(sweepOutcome(row, 999)).toBeNull();
      expect(sweepOutcome(row, 1_000)).toEqual({ billed: "none", chargeMicroUsd: 0, errorClass: "timeout" });
      expect(sweepOutcome({ ...row, sentAt: 500 }, 1_000)).toEqual({
        billed: "possible",
        chargeMicroUsd: 66_000,
        errorClass: "timeout",
      });
      expect(sweepOutcome({ ...row, status: "settled", sentAt: 500 }, 5_000)).toBeNull();
    });

    test("a late settle adds only what the sweep under-charged", () => {
      expect(lateSettleAdjustment({ chargedMicroUsd: 66_000, actualMicroUsd: 90_000 })).toBe(24_000);
      expect(lateSettleAdjustment({ chargedMicroUsd: 66_000, actualMicroUsd: 40_000 })).toBe(0);
      expect(lateSettleAdjustment({ chargedMicroUsd: 0, actualMicroUsd: 40_000 })).toBe(40_000);
      const late = spendDeltas({ row, spendMicroUsd: 24_000, releaseReservation: false, budgetsDayKey: "2026-11-05" });
      expect(late.owner).toMatchObject({ reservedMicroUsd: 0, freeReservedMicroUsd: 0, daySpentMicroUsd: 24_000 });
      expect(late.global.inFlightMicroUsd).toBe(0);
    });
  });
});
