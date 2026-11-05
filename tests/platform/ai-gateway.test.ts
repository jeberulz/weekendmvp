// @vitest-environment node
/**
 * WP71-S2. The AI gateway, end to end in fixture mode: the S1 adapters run
 * with their fixture transports (or injected fakes), and C-METER is the
 * in-memory stub. No test makes a network call or reads env.
 */
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  runImageGateway,
  runTextGateway,
  textReservationMicroUsd,
  inputTokenUpperBound,
  outputJsonSchema,
  type GatewayCaller,
  type MeterPort,
  type OverrunSignal,
  type TextAdapterPort,
  type TextGatewayDeps,
} from "@/convex/ai/gateway";
import { createMeterStub, type MeterStub, type MeterStubOptions } from "@/convex/ai/meterStub";
import { anthropicWorstCaseMicroUsd, openAiImageSettleMicroUsd } from "@/convex/ai/pricing";
import { createAnthropicAdapter } from "@/convex/ai/providers/anthropic";
import type { AnthropicFixtureReply } from "@/convex/ai/providers/fixtures";
import { createOpenAiImagesAdapter, openAiImageReservationMicroUsd } from "@/convex/ai/providers/openaiImages";
import { createRecraftAdapter } from "@/convex/ai/providers/recraft";
import { FIXTURE_PNG_BASE64 } from "@/convex/ai/providers/fixtures";
import { ProviderError, type ProviderCost, type TextRequest, type TextResult } from "@/convex/ai/providers/types";
import { jobAttemptKey, utcDayKey } from "@/lib/workspace/contracts/metering";
import { definePromptSpec, TIER_MODELS, type PromptSpec } from "@/lib/workspace/contracts/prompts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const DAY = utcDayKey(NOW);
const OWNER = "owner_1";
const JOB_KEY = "crew:project_1:landing-headline";

const headlineSchema = z.object({ headline: z.string().min(1), bullets: z.array(z.string()) });
type Headline = z.infer<typeof headlineSchema>;

function spec(overrides: Partial<PromptSpec<{ idea: string }, Headline>> = {}) {
  return definePromptSpec<{ idea: string }, Headline>({
    id: "crew-landing-headline",
    version: 1,
    tier: "draft",
    effort: "low",
    thinking: { type: "between_tools" },
    maxTokens: 2_000,
    system: "You are the Weekend MVP crew. Write plain, specific copy.",
    buildUser: (inputs) => `Write the landing headline for: ${inputs.idea}`,
    outputSchema: headlineSchema,
    cacheLayout: { system: "stable", business: "none", ttl: "5m" },
    evalSuite: "crew/landing",
    mode: "realtime",
    fallbacks: "none",
    ...overrides,
  });
}

function clock() {
  let t = NOW;
  return { now: () => (t += 5) };
}

const caller: GatewayCaller = {
  ownerId: OWNER,
  projectId: "project_1",
  taskId: "task_1",
  attemptKey: (n) => jobAttemptKey(JOB_KEY, n),
};

type Event = { readonly step: string; readonly detail?: unknown };

/** Wraps a meter so every call is logged in order. */
function recordingMeter(meter: MeterPort, events: Event[]): MeterPort {
  return {
    reserve: async (args) => {
      events.push({ step: "reserve", detail: args });
      return meter.reserve(args);
    },
    markSent: async (args) => {
      events.push({ step: "markSent", detail: args });
      return meter.markSent(args);
    },
    settle: async (args) => {
      events.push({ step: "settle", detail: args });
      return meter.settle(args);
    },
    fail: async (args) => {
      events.push({ step: "fail", detail: args });
      return meter.fail(args);
    },
  };
}

type Harness = {
  readonly meter: MeterStub;
  readonly events: Event[];
  readonly params: Anthropic.MessageCreateParamsNonStreaming[];
  readonly deps: TextGatewayDeps;
  readonly overruns: OverrunSignal[];
};

/** The real Claude adapter in fixture mode, the stub meter, and a call log. */
function harness(
  replies: (call: number) => AnthropicFixtureReply | undefined = () => undefined,
  meterOptions: MeterStubOptions = {},
): Harness {
  const time = clock();
  const meter = createMeterStub({ now: time.now, owners: { [OWNER]: { plan: "builders_hub" } }, ...meterOptions });
  const events: Event[] = [];
  const params: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const overruns: OverrunSignal[] = [];
  const adapter = createAnthropicAdapter({
    env: {},
    fixtureResponder: (p) => {
      params.push(p);
      return replies(params.length);
    },
  });
  const recordingAdapter: TextAdapterPort = {
    complete: async (request) => {
      events.push({ step: "call", detail: request });
      return adapter.complete(request);
    },
  };
  return {
    meter,
    events,
    params,
    overruns,
    deps: {
      meter: recordingMeter(meter, events),
      adapter: recordingAdapter,
      clock: time,
      onOverrun: (signal) => {
        overruns.push(signal);
      },
    },
  };
}

function steps(events: readonly Event[]): string[] {
  return events.map((event) => event.step);
}

function fakeCost(microUsd: number): ProviderCost {
  return {
    provider: "anthropic",
    billedAs: "claude-sonnet-5-5 (fixture)",
    microUsd,
    estimated: false,
    units: {},
    rateCard: "2026-10-06",
  };
}

/** A fake adapter that throws `error` and logs the call. */
function throwingDeps(error: unknown, meter: MeterStub, events: Event[]): TextGatewayDeps {
  return {
    meter: recordingMeter(meter, events),
    clock: clock(),
    adapter: {
      complete: async () => {
        events.push({ step: "call" });
        throw error;
      },
    },
  };
}

function stubMeter(options: MeterStubOptions = {}): MeterStub {
  return createMeterStub({ now: clock().now, owners: { [OWNER]: { plan: "builders_hub" } }, ...options });
}

const INPUTS = { idea: "HydroTrail, a hydration app for hikers" };

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("runTextGateway: reserve → settle", () => {
  it("runs spec, reserve, markSent, call, validate and settle in that order", async () => {
    const h = harness();
    const outcome = await runTextGateway(h.deps, { spec: spec(), inputs: INPUTS, caller });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.output).toEqual({ headline: "fixture", bullets: [] });
    expect(outcome.promptRef).toBe("crew-landing-headline@1");
    expect(steps(h.events)).toEqual(["reserve", "markSent", "call", "settle"]);

    const [attempt] = outcome.attempts;
    expect(outcome.attempts).toHaveLength(1);
    expect(attempt).toMatchObject({ attempt: 1, attemptKey: `${JOB_KEY}:1`, reask: false, status: "settled" });
    expect(attempt.overrun).toBeUndefined();

    const row = h.meter.row(attempt.usageId);
    expect(row).toMatchObject({
      status: "settled",
      promptRef: "crew-landing-headline@1",
      provider: "anthropic",
      model: TIER_MODELS.draft,
      tier: "draft",
      feature: "ai",
      estimated: false,
      stopReason: "end_turn",
    });
    expect(row?.sentAt).toBeDefined();
    expect(row?.costMicroUsd).toBeGreaterThan(0);
    expect(row?.costMicroUsd).toBeLessThanOrEqual(attempt.reservedMicroUsd);
    expect(attempt.chargedMicroUsd).toBe(row?.costMicroUsd);
    expect(row?.inputTokens).toBeGreaterThan(0);
    expect(row?.cacheWriteTokens).toBeGreaterThan(0);

    // The reservation is released and the true cost is booked.
    expect(h.meter.budgets(OWNER)).toMatchObject({ reservedMicroUsd: 0, daySpentMicroUsd: row?.costMicroUsd });
    expect(h.meter.global("paid", DAY)).toEqual({ spentMicroUsd: row?.costMicroUsd, inFlightMicroUsd: 0 });
    expect(h.meter.finalizeCalls(attempt.usageId)).toBe(1);
  });

  it("sizes the reservation from the request's byte bound, the spec's max tokens and the rate card", async () => {
    const h = harness();
    const outcome = await runTextGateway(h.deps, { spec: spec(), inputs: INPUTS, caller });
    const reserve = h.events.find((event) => event.step === "reserve")?.detail as { reservedMicroUsd: number };
    const request = h.events.find((event) => event.step === "call")?.detail as TextRequest;

    const expected = anthropicWorstCaseMicroUsd({
      model: TIER_MODELS.draft,
      inputTokens: inputTokenUpperBound(request),
      maxTokens: 2_000,
      maxInputTokens: 60_000,
    });
    expect(reserve.reservedMicroUsd).toBe(expected);
    expect(outcome.attempts[0].reservedMicroUsd).toBe(expected);
    expect(request).toMatchObject({
      model: TIER_MODELS.draft,
      effort: "low",
      thinking: { type: "between_tools" },
      maxTokens: 2_000,
      outputSchema: outputJsonSchema(headlineSchema),
    });
    expect(request.outputSchema).not.toHaveProperty("$schema");
    expect(request.system).toEqual([{ text: spec().system, cacheBreakpoint: true }]);
  });

  it("puts the business block after the system block when the layout is per_business", async () => {
    const h = harness();
    const perBusiness = spec({ cacheLayout: { system: "stable", business: "per_business", ttl: "5m" } });
    const outcome = await runTextGateway(h.deps, {
      spec: perBusiness,
      inputs: INPUTS,
      caller,
      businessContext: "Business: HydroTrail. Tone: calm.",
    });
    expect(outcome.ok).toBe(true);
    const request = h.events.find((event) => event.step === "call")?.detail as TextRequest;
    expect(request.system).toEqual([
      { text: perBusiness.system, cacheBreakpoint: true },
      { text: "Business: HydroTrail. Tone: calm.", cacheBreakpoint: true },
    ]);

    const missing = await runTextGateway(harness().deps, { spec: perBusiness, inputs: INPUTS, caller });
    expect(missing).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
  });
});

// ---------------------------------------------------------------------------
// Re-ask (D23: at most one)
// ---------------------------------------------------------------------------

describe("runTextGateway: one re-ask on schema failure", () => {
  it("re-asks once with a new reservation and a second usage row, then succeeds", async () => {
    const h = harness((call) => (call === 1 ? { json: { headline: "" } } : undefined));
    const outcome = await runTextGateway(h.deps, { spec: spec(), inputs: INPUTS, caller });

    expect(outcome.ok).toBe(true);
    expect(steps(h.events)).toEqual(["reserve", "markSent", "call", "fail", "reserve", "markSent", "call", "settle"]);
    expect(outcome.attempts).toHaveLength(2);
    const [first, second] = outcome.attempts;
    expect(first.usageId).not.toBe(second.usageId);
    expect(first).toMatchObject({
      attemptKey: `${JOB_KEY}:1`,
      reask: false,
      status: "failed",
      billed: "actual",
      errorClass: "schema_invalid",
    });
    expect(second).toMatchObject({ attemptKey: `${JOB_KEY}:2`, reask: true, status: "settled" });

    // The first attempt is charged its actual cost, not the reservation.
    const firstRow = h.meter.row(first.usageId);
    expect(firstRow?.status).toBe("failed");
    expect(firstRow?.costMicroUsd).toBeGreaterThan(0);
    expect(firstRow?.costMicroUsd).toBeLessThan(first.reservedMicroUsd);
    expect(h.meter.row(second.usageId)).toMatchObject({ status: "settled", reask: true });

    // The re-ask names the failed paths and never echoes the model's reply.
    const reasked = h.events.filter((event) => event.step === "call")[1].detail as TextRequest;
    expect(reasked.user).toContain("<reask>");
    expect(reasked.user).toContain("headline: too_small");
    expect(reasked.user).toContain("bullets: invalid_type");
    expect(reasked.user.startsWith("Write the landing headline for: HydroTrail")).toBe(true);
    expect(h.meter.budgets(OWNER)?.reservedMicroUsd).toBe(0);
  });

  it("fails the run after a second schema failure, with no third call", async () => {
    const h = harness(() => ({ json: { nope: true } }));
    const outcome = await runTextGateway(h.deps, { spec: spec(), inputs: INPUTS, caller });

    expect(outcome).toMatchObject({ ok: false, failure: { kind: "schema_invalid" } });
    expect(h.params).toHaveLength(2);
    expect(steps(h.events)).toEqual(["reserve", "markSent", "call", "fail", "reserve", "markSent", "call", "fail"]);
    expect(outcome.attempts.map((a) => [a.status, a.errorClass, a.reask])).toEqual([
      ["failed", "schema_invalid", false],
      ["failed", "schema_invalid", true],
    ]);
    expect(h.meter.rows()).toHaveLength(2);
  });

  it("treats a non-JSON or truncated reply as a schema failure and re-asks once", async () => {
    const h = harness((call) => (call === 1 ? { text: "not json", stopReason: "max_tokens" } : undefined));
    const outcome = await runTextGateway(h.deps, { spec: spec(), inputs: INPUTS, caller });
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts.map((a) => a.status)).toEqual(["failed", "settled"]);
    expect(outcome.attempts[0]).toMatchObject({ errorClass: "schema_invalid", billed: "actual", stopReason: "max_tokens" });
  });

  it("counts an escalation once: the re-ask is not a second escalation", async () => {
    const escalation = spec({
      id: "crew-landing-escalation",
      tier: "deep",
      thinking: { type: "adaptive" },
      purpose: "escalation",
    });
    const h = harness((call) => (call === 1 ? { json: {} } : undefined));
    const outcome = await runTextGateway(h.deps, { spec: escalation, inputs: INPUTS, caller });
    expect(outcome.ok).toBe(true);
    const reserves = h.events.filter((event) => event.step === "reserve").map((event) => event.detail);
    expect(reserves).toMatchObject([{ escalation: true, tier: "deep" }, { reask: true, tier: "deep" }]);
    expect(reserves[1]).not.toHaveProperty("escalation");
    expect(h.meter.budgets(OWNER)?.dayEscalations).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Refusal, billed states, tool stops
// ---------------------------------------------------------------------------

describe("runTextGateway: refusals and errors", () => {
  it("settles a refusal as failed at its actual cost, with no re-ask", async () => {
    const h = harness(() => ({ refusal: { category: "cyber", explanation: "declined" } }));
    const outcome = await runTextGateway(h.deps, { spec: spec(), inputs: INPUTS, caller });

    expect(outcome).toMatchObject({
      ok: false,
      failure: { kind: "refusal", provider: "anthropic", category: "cyber", explanation: "declined" },
    });
    expect(h.params).toHaveLength(1);
    expect(outcome.attempts).toHaveLength(1);
    const [attempt] = outcome.attempts;
    expect(attempt).toMatchObject({ status: "failed", billed: "actual", errorClass: "refusal", stopReason: "refusal" });
    const row = h.meter.row(attempt.usageId);
    expect(row).toMatchObject({ status: "failed", billed: "actual", errorClass: "refusal" });
    expect(row?.costMicroUsd).toBeGreaterThan(0);
    expect(row?.costMicroUsd).toBeLessThan(attempt.reservedMicroUsd);
  });

  it("charges 0 when the provider did not bill (billed none)", async () => {
    const meter = stubMeter();
    const events: Event[] = [];
    const outcome = await runTextGateway(
      throwingDeps(new ProviderError("anthropic", "rate_limit", "Anthropic returned 429", { status: 429 }), meter, events),
      { spec: spec(), inputs: INPUTS, caller },
    );
    expect(outcome).toMatchObject({
      ok: false,
      failure: { kind: "provider", providerKind: "rate_limit", billed: "none", errorClass: "retryable", retryable: true },
    });
    expect(steps(events)).toEqual(["reserve", "markSent", "call", "fail"]);
    expect(events[3].detail).not.toHaveProperty("costMicroUsd");
    const row = rowOf(meter, outcome.attempts[0].usageId);
    expect(row).toMatchObject({ status: "failed", billed: "none", costMicroUsd: 0 });
    expect(meter.budgets(OWNER)).toMatchObject({ reservedMicroUsd: 0, daySpentMicroUsd: 0 });
  });

  it("charges the worst case (the reservation) when the provider may have billed", async () => {
    const meter = stubMeter();
    const events: Event[] = [];
    const outcome = await runTextGateway(
      throwingDeps(new ProviderError("anthropic", "server", "Anthropic returned 529", { status: 529 }), meter, events),
      { spec: spec(), inputs: INPUTS, caller },
    );
    const [attempt] = outcome.attempts;
    expect(attempt).toMatchObject({ billed: "possible", errorClass: "retryable" });
    expect(attempt.chargedMicroUsd).toBe(attempt.reservedMicroUsd);
    expect(rowOf(meter, attempt.usageId)).toMatchObject({ billed: "possible", costMicroUsd: attempt.reservedMicroUsd });
    expect(meter.budgets(OWNER)).toMatchObject({ reservedMicroUsd: 0, daySpentMicroUsd: attempt.reservedMicroUsd });
  });

  it("charges the known cost when the bill is actual", async () => {
    const meter = stubMeter();
    const events: Event[] = [];
    const error = new ProviderError("anthropic", "server", "billed then failed", { billed: "actual", cost: fakeCost(1_234) });
    const outcome = await runTextGateway(throwingDeps(error, meter, events), { spec: spec(), inputs: INPUTS, caller });
    const [attempt] = outcome.attempts;
    expect(events[3].detail).toMatchObject({ billed: "actual", costMicroUsd: 1_234 });
    expect(attempt.chargedMicroUsd).toBe(1_234);
    expect(rowOf(meter, attempt.usageId)).toMatchObject({ billed: "actual", costMicroUsd: 1_234 });
  });

  it("charges the worst case for a throw that is not an adapter error", async () => {
    const meter = stubMeter();
    const outcome = await runTextGateway(throwingDeps(new TypeError("socket hang up"), meter, []), {
      spec: spec(),
      inputs: INPUTS,
      caller,
    });
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "provider", providerKind: "unknown", billed: "possible" } });
    expect(outcome.attempts[0].chargedMicroUsd).toBe(outcome.attempts[0].reservedMicroUsd);
  });

  it.each(["tool_use", "pause_turn"] as const)("fails a %s stop at once, with no re-ask and no continuation (D23)", async (stopReason) => {
    const h1 = harness(() => ({ text: "{}", stopReason }));
    const outcome = await runTextGateway(h1.deps, { spec: spec(), inputs: INPUTS, caller });
    expect(outcome).toMatchObject({
      ok: false,
      failure: { kind: "provider", providerKind: "invalid_output", errorClass: "schema_invalid", billed: "actual" },
    });
    expect(h1.params).toHaveLength(1);
    expect(steps(h1.events)).toEqual(["reserve", "markSent", "call", "fail"]);
    expect(outcome.attempts[0]).toMatchObject({ stopReason, billed: "actual" });
    expect(outcome.attempts[0].chargedMicroUsd).toBeGreaterThan(0);
  });

  it("never sends tools, tool_choice or fallbacks, on the first call or the re-ask", async () => {
    const h1 = harness((call) => (call === 1 ? { json: {} } : undefined));
    await runTextGateway(h1.deps, { spec: spec(), inputs: INPUTS, caller });
    expect(h1.params).toHaveLength(2);
    for (const params of h1.params) {
      const body = params as unknown as Record<string, unknown>;
      expect(body.tools).toBeUndefined();
      expect(body.tool_choice).toBeUndefined();
      expect(body.fallbacks).toBeUndefined();
      expect(body.betas).toBeUndefined();
      expect(params.messages).toHaveLength(1);
      expect(params.messages[0].role).toBe("user");
    }
  });
});

function rowOf(meter: MeterStub, usageId: string) {
  return meter.row(usageId);
}

// ---------------------------------------------------------------------------
// The meter refuses: nothing is sent
// ---------------------------------------------------------------------------

describe("runTextGateway: a refused reservation", () => {
  it("never calls the adapter when the owner is over the daily ceiling", async () => {
    const h1 = harness(undefined, {
      owners: {
        [OWNER]: {
          plan: "free",
          budgets: {
            ownerId: OWNER,
            freeLifetimeSpentMicroUsd: 0,
            reservedMicroUsd: 0,
            freeReservedMicroUsd: 0,
            dayKey: DAY,
            daySpentMicroUsd: 999_990,
            dayEscalations: 0,
          },
        },
      },
    });
    const outcome = await runTextGateway(h1.deps, { spec: spec(), inputs: INPUTS, caller });
    expect(outcome).toMatchObject({
      ok: false,
      failure: { kind: "meter_refused", error: { code: "BUDGET_EXHAUSTED", scope: "owner_daily" } },
      attempts: [],
    });
    expect(steps(h1.events)).toEqual(["reserve"]);
    expect(h1.params).toHaveLength(0);
    expect(h1.meter.rows()).toHaveLength(0);
  });

  it("never calls the adapter when the AI kill switch is on", async () => {
    const h1 = harness(undefined, { killSwitches: { ai: true } });
    const outcome = await runTextGateway(h1.deps, { spec: spec(), inputs: INPUTS, caller });
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "meter_refused", error: { code: "AI_DISABLED", scope: "ai" } } });
    expect(h1.params).toHaveLength(0);
  });

  it("refuses before reserving when the input bound is over the lane ceiling", async () => {
    const h1 = harness();
    const fast = spec({ id: "crew-social-post", tier: "fast", thinking: { type: "disabled" }, maxTokens: 1_000 });
    const outcome = await runTextGateway(h1.deps, { spec: fast, inputs: { idea: "x".repeat(41_000) }, caller });
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
    expect(h1.events).toHaveLength(0);
  });

  it("refuses a batch spec (the Message Batches path is S5)", async () => {
    const h1 = harness();
    const batch = spec({ id: "crew-seed", tier: "deep", thinking: { type: "adaptive" }, mode: "batch" });
    const outcome = await runTextGateway(h1.deps, { spec: batch, inputs: INPUTS, caller });
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "config" } });
    expect(h1.events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Finalise exactly once
// ---------------------------------------------------------------------------

describe("runTextGateway: settle or fail at most once per row", () => {
  it("fails once at the known cost when validation throws after the adapter returned", async () => {
    const throwing = z.object({ headline: z.string(), bullets: z.array(z.string()) }).superRefine(() => {
      throw new Error("refinement crashed");
    });
    const h1 = harness();
    const outcome = await runTextGateway(h1.deps, {
      spec: spec({ outputSchema: throwing as unknown as z.ZodType<Headline> }),
      inputs: INPUTS,
      caller,
    });
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "internal", message: "refinement crashed" } });
    expect(steps(h1.events)).toEqual(["reserve", "markSent", "call", "fail"]);
    const [attempt] = outcome.attempts;
    expect(attempt).toMatchObject({ billed: "actual", status: "failed" });
    expect(attempt.chargedMicroUsd).toBeGreaterThan(0);
    expect(attempt.chargedMicroUsd).toBeLessThan(attempt.reservedMicroUsd);
    expect(h1.meter.finalizeCalls(attempt.usageId)).toBe(1);
  });

  it("does not call fail when settle throws", async () => {
    const meter = stubMeter();
    const events: Event[] = [];
    const base = recordingMeter(meter, events);
    const brokenSettle: MeterPort = {
      ...base,
      settle: async (args) => {
        events.push({ step: "settle", detail: args });
        throw new Error("mutation timed out");
      },
    };
    const run = runTextGateway(
      { meter: brokenSettle, clock: clock(), adapter: createAnthropicAdapter({ env: {} }) },
      { spec: spec(), inputs: INPUTS, caller },
    );
    await expect(run).rejects.toThrow("mutation timed out");
    expect(steps(events)).toEqual(["reserve", "markSent", "settle"]);
    // The row is left for the sweep: sent, so it will fail billed `possible`.
    const [row] = meter.rows();
    expect(row).toMatchObject({ status: "reserved" });
    expect(row.sentAt).toBeDefined();
    expect(meter.sweep(row.expiresAt)).toHaveLength(1);
  });

  it("fails billed none and never calls the adapter when markSent throws", async () => {
    const meter = stubMeter();
    const events: Event[] = [];
    const base = recordingMeter(meter, events);
    const adapterCall = vi.fn();
    const outcome = await runTextGateway(
      {
        meter: { ...base, markSent: async () => Promise.reject(new Error("markSent lost")) },
        clock: clock(),
        adapter: { complete: adapterCall },
      },
      { spec: spec(), inputs: INPUTS, caller },
    );
    expect(adapterCall).not.toHaveBeenCalled();
    expect(steps(events)).toEqual(["reserve", "fail"]);
    expect(outcome.attempts[0]).toMatchObject({ billed: "none", chargedMicroUsd: 0 });
    expect(meter.finalizeCalls(outcome.attempts[0].usageId)).toBe(1);
  });

  it("leaves an existing row alone and sends nothing for a replayed attempt key", async () => {
    const h1 = harness();
    const first = await runTextGateway(h1.deps, { spec: spec(), inputs: INPUTS, caller });
    const replay = await runTextGateway(h1.deps, { spec: spec(), inputs: INPUTS, caller });
    expect(replay).toMatchObject({
      ok: false,
      failure: { kind: "duplicate_attempt", attemptKey: `${JOB_KEY}:1`, usageId: first.attempts[0].usageId },
      attempts: [],
    });
    expect(h1.params).toHaveLength(1);
    expect(h1.meter.finalizeCalls(first.attempts[0].usageId)).toBe(1);
  });

  it("starts at the caller's attempt number", async () => {
    const h1 = harness();
    const outcome = await runTextGateway(h1.deps, { spec: spec(), inputs: INPUTS, caller: { ...caller, attempt: 3 } });
    expect(outcome.attempts[0].attemptKey).toBe(`${JOB_KEY}:3`);
  });
});

// ---------------------------------------------------------------------------
// Overruns
// ---------------------------------------------------------------------------

describe("overruns", () => {
  const imageCaller: GatewayCaller = { ...caller, attemptKey: (n) => jobAttemptKey("crew:project_1:hero-image", n) };
  const heroRequest = { prompt: "A calm trail at dawn", size: "1536x1024", quality: "medium", timeoutMs: 5_000 } as const;

  it("settles gpt-image-2 token usage above the table price at the true cost and flags it", async () => {
    const meter = stubMeter();
    const events: Event[] = [];
    const overruns: OverrunSignal[] = [];
    const adapter = createOpenAiImagesAdapter({
      env: {},
      fixtureResponder: () => ({
        body: { data: [{ b64_json: FIXTURE_PNG_BASE64 }], usage: { input_tokens: 40, output_tokens: 4_000 } },
      }),
    });
    const outcome = await runImageGateway(
      { meter: recordingMeter(meter, events), clock: clock(), onOverrun: (signal) => void overruns.push(signal) },
      { job: { provider: "openai_images", request: heroRequest, adapter }, promptRef: "media-hero@1", caller: imageCaller },
    );

    const reserved = openAiImageReservationMicroUsd(heroRequest);
    const actual = openAiImageSettleMicroUsd({ quality: "medium", size: "1536x1024", inputTokens: 40, outputTokens: 4_000 });
    expect(actual).toBeGreaterThan(reserved);

    expect(outcome.ok).toBe(true);
    expect(steps(events)).toEqual(["reserve", "markSent", "settle"]);
    const [attempt] = outcome.attempts;
    expect(attempt.overrun).toEqual({ reservedMicroUsd: reserved, actualMicroUsd: actual });
    expect(attempt.chargedMicroUsd).toBe(actual);
    expect(events[2].detail).toMatchObject({ costMicroUsd: actual, estimated: false, images: 1, inputTokens: 40, outputTokens: 4_000 });
    expect(meter.row(attempt.usageId)).toMatchObject({
      status: "settled",
      provider: "openai_images",
      tier: "image",
      reservedMicroUsd: reserved,
      costMicroUsd: actual,
    });
    expect(overruns).toEqual([
      {
        usageId: attempt.usageId,
        attemptKey: "crew:project_1:hero-image:1",
        promptRef: "media-hero@1",
        provider: "openai_images",
        model: "gpt-image-2",
        reservedMicroUsd: reserved,
        actualMicroUsd: actual,
      },
    ]);
    // The true cost is booked and the reservation is released.
    expect(meter.budgets(OWNER)).toMatchObject({ reservedMicroUsd: 0, daySpentMicroUsd: actual });
  });

  it("does not flag a settle within the reservation, and a throwing hook changes nothing", async () => {
    const meter = stubMeter();
    const hook = vi.fn(() => {
      throw new Error("hook broke");
    });
    const adapter = createOpenAiImagesAdapter({ env: {} });
    const outcome = await runImageGateway(
      { meter, clock: clock(), onOverrun: hook },
      { job: { provider: "openai_images", request: heroRequest, adapter }, promptRef: "media-hero@1", caller: imageCaller },
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts[0].overrun).toBeUndefined();
    expect(hook).not.toHaveBeenCalled();

    const over = createOpenAiImagesAdapter({
      env: {},
      fixtureResponder: () => ({ body: { data: [{ b64_json: FIXTURE_PNG_BASE64 }], usage: { input_tokens: 0, output_tokens: 9_000 } } }),
    });
    const flagged = await runImageGateway(
      { meter, clock: clock(), onOverrun: hook },
      {
        job: { provider: "openai_images", request: heroRequest, adapter: over },
        promptRef: "media-hero@1",
        caller: { ...imageCaller, attempt: 2 },
      },
    );
    expect(flagged.ok).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(meter.finalizeCalls(flagged.attempts[0].usageId)).toBe(1);
  });

  it("flags a text overrun too, and still settles at the true cost", async () => {
    const result: TextResult = {
      provider: "anthropic",
      model: TIER_MODELS.draft,
      messageId: "msg_fake",
      stopReason: "end_turn",
      text: JSON.stringify({ headline: "Drink up", bullets: [] }),
      json: { headline: "Drink up", bullets: [] },
      usage: { inputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 10 },
      cost: fakeCost(5_000_000),
    };
    const meter = stubMeter();
    const overruns: OverrunSignal[] = [];
    const outcome = await runTextGateway(
      { meter, clock: clock(), adapter: { complete: async () => result }, onOverrun: (s) => void overruns.push(s) },
      { spec: spec(), inputs: INPUTS, caller },
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts[0].overrun?.actualMicroUsd).toBe(5_000_000);
    expect(meter.row(outcome.attempts[0].usageId)?.costMicroUsd).toBe(5_000_000);
    expect(overruns).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Images: billed states and Recraft
// ---------------------------------------------------------------------------

describe("runImageGateway", () => {
  const logoCaller: GatewayCaller = { ...caller, attemptKey: (n) => jobAttemptKey("crew:project_1:logo", n) };

  it("settles a Recraft render at the flat list price, marked estimated", async () => {
    const meter = stubMeter();
    const outcome = await runImageGateway(
      { meter, clock: clock() },
      {
        job: {
          provider: "recraft",
          request: { prompt: "A water drop mark", size: "1024x1024", timeoutMs: 5_000 },
          adapter: createRecraftAdapter({ env: {} }),
        },
        promptRef: "brand-logo-mark@1",
        caller: logoCaller,
      },
    );
    expect(outcome.ok).toBe(true);
    expect(meter.row(outcome.attempts[0].usageId)).toMatchObject({
      status: "settled",
      provider: "recraft",
      model: "recraftv4_1",
      costMicroUsd: 35_000,
      reservedMicroUsd: 35_000,
      estimated: true,
      images: 1,
    });
  });

  it("charges 0 for a moderation refusal (an HTTP 400, billed none)", async () => {
    const meter = stubMeter();
    const adapter = createOpenAiImagesAdapter({
      env: {},
      fixtureResponder: () => ({ status: 400, body: { error: { code: "moderation_blocked", message: "blocked" } } }),
    });
    const outcome = await runImageGateway(
      { meter, clock: clock() },
      {
        job: {
          provider: "openai_images",
          request: { prompt: "something blocked", size: "1024x1024", quality: "medium", timeoutMs: 5_000 },
          adapter,
        },
        promptRef: "media-post@1",
        caller: logoCaller,
      },
    );
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "refusal", provider: "openai_images" } });
    expect(outcome.attempts[0]).toMatchObject({ billed: "none", errorClass: "refusal", chargedMicroUsd: 0 });
  });

  it("refuses an unpriced size before reserving anything", async () => {
    const meter = stubMeter();
    const outcome = await runImageGateway(
      { meter, clock: clock() },
      {
        job: {
          provider: "recraft",
          request: { prompt: "wide", size: "1536x1024" as "1024x1024", timeoutMs: 5_000 },
          adapter: createRecraftAdapter({ env: {} }),
        },
        promptRef: "brand-logo-mark@1",
        caller: logoCaller,
      },
    );
    expect(outcome).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
    expect(meter.rows()).toHaveLength(0);
  });
});

describe("textReservationMicroUsd", () => {
  it("is bounded by the meter's per-reservation limit", () => {
    const request: TextRequest = {
      model: TIER_MODELS.draft,
      effort: "low",
      thinking: { type: "between_tools" },
      maxTokens: 12_288,
      system: [{ text: "x" }],
      user: "y",
      timeoutMs: 1_000,
    };
    expect(textReservationMicroUsd({ model: TIER_MODELS.draft, maxInputTokens: 60_000, request })).toBeLessThan(2_000_000);
  });
});
