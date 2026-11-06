/// <reference types="vite/client" />
/**
 * WP71-S2 follow-up. The gateway action against the REAL C-METER (WP70
 * `convex/ai/metering.ts`), the real ledger (WP73 `debitTask`,
 * `refundFailedTask`) and the real registry spec `internal-registry-probe@2`,
 * in convex-test.
 *
 * The probe is an internal spec, so the registered `runPrompt` refuses it on
 * the job path (tested below) and runs it only on the ownerless eval path.
 * The job-path tests call the action's body, `runPromptWithMeter`, with
 * `allowInternal` (a test-only dependency the registered action never sets)
 * and a context whose `runMutation` runs the real meter mutations.
 *
 * Provider access is fixture mode throughout, except the kill-switch proof:
 * there `AI_PROVIDER_MODE=live` with a fake key and a stubbed global `fetch`,
 * so the test can show that no request is even attempted while the switch is
 * on (and, as a positive control, that the stub does see the live path when
 * the switch is off). No test reaches the network.
 */
import { convexTest, type TestConvex } from "convex-test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ActionCtx } from "@/convex/_generated/server";
import schema from "@/convex/schema";
import { readGlobalBudget } from "@/convex/ai/budgets";
import { runPromptWithMeter, type RunPromptArgs, type RunPromptDeps } from "@/convex/ai/gatewayActions";
import type { TextAdapterPort } from "@/convex/ai/gateway";
import { ANTHROPIC_BASE_URL, createAnthropicAdapter, defaultAnthropicClientFactory } from "@/convex/ai/providers/anthropic";
import type { AnthropicFixtureReply } from "@/convex/ai/providers/fixtures";
import { ProviderError } from "@/convex/ai/providers/types";
import { utcDayKey } from "@/lib/workspace/contracts/metering";
import { TIER_MODELS } from "@/lib/workspace/contracts/prompts";

const modules = import.meta.glob("/convex/**/*.ts");

const PROBE = "internal-registry-probe@2";

/**
 * A test-only, NON-internal spec: the probe's prompt under its own ref. Only
 * this file's mocked registry knows it; the real registry, the lock and
 * `check-prompt-versions` never see it. It lets the wizard key tests reach the
 * key checks on the registered action, which refuses the internal probe first.
 */
const WIZARD_FIXTURE = "test-wizard-key-fixture@1";

vi.mock("@/convex/ai/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/convex/ai/registry")>();
  const { promptEntry } = await import("@/convex/ai/prompts/entry");
  const { registryProbeSpec } = await import("@/convex/ai/prompts/registryProbe");
  const { definePromptSpec } = await import("@/lib/workspace/contracts/prompts");
  const spec = definePromptSpec({
    ...registryProbeSpec,
    id: "test-wizard-key-fixture",
    version: 1,
    evalSuite: "test-wizard-key-fixture",
  });
  const entry = promptEntry(spec, {
    module: "tests/platform/ai-gateway-action.test.ts",
    sampleInputs: { label: "sample" },
    internal: false,
  });
  return {
    ...actual,
    getEntry: (ref: string) => (ref === WIZARD_FIXTURE ? entry : actual.getEntry(ref)),
  };
});
const FIXED_NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

type T = TestConvex<typeof schema>;

function gatewayTest(): T {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  return t;
}

type Business = {
  readonly ownerId: Id<"users">;
  readonly projectId: Id<"projects">;
  readonly taskId: Id<"tasks">;
  readonly opsId: Id<"ops_settings">;
};

/** A test business: owner, ops switch on, a wizard-made workspace project and a queued task. */
async function seedBusiness(t: T, label: string, options: { aiKillSwitch?: boolean } = {}): Promise<Business> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: `${label}-admin@example.test` });
    const ownerId = await ctx.db.insert("users", { email: `${label}-owner@example.test` });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: true,
      cohortMode: "open",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n,
      paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: {
        ai: options.aiKillSwitch ?? false,
        studioVideo: true, publish: true, email: true, social: true, ads: true,
      },
      updatedAt: 1,
    });
    const wizardSessionId = await ctx.db.insert("wizard_sessions", {
      ownerId, step: "idea", answers: {}, startedAt: 1, updatedAt: 1,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      source: "own_idea",
      title: `${label} business`,
      status: "draft",
      idempotencyKey: `${label}-business`,
      workspace: {
        version: 1, name: `${label} business`, slug: label, ownIdeaText: "A hydration app for hikers",
        platform: "web", commercialModel: "free", goal: "waitlist",
        partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
      },
      createdAt: 1, updatedAt: 1,
    });
    const taskId = await ctx.db.insert("tasks", {
      ownerId, projectId, type: "crew_brand_kit", status: "queued", title: `${label} task`,
      idempotencyKey: `task-${label}`, createdAt: 2, updatedAt: 2,
    });
    return { ownerId, projectId, taskId, opsId };
  });
}

/** Starter credits, then the task's debit, through the real ledger. Returns the debit's id. */
async function debit(t: T, business: Business): Promise<Id<"credit_ledger">> {
  await t.mutation(internal.platform.billing.grants.grantStarter, {
    ownerId: business.ownerId, projectId: business.projectId,
  });
  const result = await t.mutation(internal.platform.billing.ledger.debitTask, {
    taskId: business.taskId, projectId: business.projectId, credits: 1n,
  });
  expect(result.duplicate).toBe(false);
  return result.ledgerId;
}

function runArgs(business: Business, debitId: Id<"credit_ledger"> | undefined, attempt?: number): RunPromptArgs {
  return {
    promptRef: PROBE,
    inputs: { label: "HydroTrail" },
    ownerId: business.ownerId,
    projectId: business.projectId,
    taskId: business.taskId,
    ...(debitId === undefined ? {} : { creditDebitId: debitId }),
    attemptKey: { kind: "job", jobKey: `crew:${business.projectId}:probe` },
    ...(attempt === undefined ? {} : { attempt }),
  };
}

async function usageRows(t: T) {
  return await t.run(async (ctx) => await ctx.db.query("ai_usage").collect());
}

async function ownerBudget(t: T, ownerId: Id<"users">) {
  return await t.run(async (ctx) =>
    await ctx.db.query("ai_budgets").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique());
}

async function globalPool(t: T, pool: "free" | "paid") {
  return await t.run((ctx) => readGlobalBudget(ctx, pool, utcDayKey(Date.now())));
}

/** The real Claude adapter in fixture mode, with scripted replies and a call count. */
function scriptedAdapter(reply: (call: number) => AnthropicFixtureReply | undefined = () => undefined) {
  let calls = 0;
  const adapter = createAnthropicAdapter({
    env: {},
    fixtureResponder: () => reply(++calls),
  });
  return { adapter, calls: () => calls };
}

/** An adapter that must never be reached. */
function forbiddenAdapter() {
  let calls = 0;
  const adapter: TextAdapterPort = {
    complete: async () => {
      calls += 1;
      throw new Error("the provider must not be called");
    },
  };
  return { adapter, calls: () => calls };
}

/** An action-context stand-in whose `runMutation` runs the real meter mutations in convex-test. */
function meterCtx(t: T, after?: (name: string) => Promise<void>): Pick<ActionCtx, "runMutation"> {
  // The binding only passes `internal.ai.metering.*` references; convex-test's
  // `t.mutation` takes the classic `FunctionReference` form, hence the cast.
  const run = async (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>): Promise<unknown> => {
    const result: unknown = await t.mutation(ref, args);
    await after?.(getFunctionName(ref));
    return result;
  };
  return { runMutation: run as ActionCtx["runMutation"] };
}

/** The action's body on the job path: the real meter, the internal probe allowed (tests only). */
async function runJob(t: T, args: RunPromptArgs, deps: RunPromptDeps = {}, ctx = meterCtx(t)) {
  return await runPromptWithMeter(ctx, args, { allowInternal: true, ...deps });
}

const fixedClock = () => {
  let now = FIXED_NOW;
  return { now: () => (now += 10) };
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubFixtureEnv() {
  vi.stubEnv("AI_PROVIDER_MODE", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
}

// ---------------------------------------------------------------------------
// a. G1: a credit-funded job settles once through the real meter
// ---------------------------------------------------------------------------

describe("gateway action: settled through the real meter", () => {
  test("reserve → sent → settled, billed and counted once; the same attempt key is a no-op", async () => {
    stubFixtureEnv();
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    const t = gatewayTest();
    const business = await seedBusiness(t, "g1");
    const debitId = await debit(t, business);

    const result = await runJob(t, runArgs(business, debitId));
    expect(result).toMatchObject({ ok: true, promptRef: PROBE, stopReason: "end_turn", nextAttempt: 2 });
    if (!result.ok) throw new Error("expected a settled run");
    expect(JSON.parse(result.outputJson)).toEqual({ echo: "fixture" });
    expect(result.attempts).toHaveLength(1);
    const [attempt] = result.attempts;
    expect(attempt).toMatchObject({ attempt: 1, reask: false, status: "settled", alreadyFinal: false });
    expect(attempt.chargedMicroUsd).toBeGreaterThan(0);
    expect(attempt.chargedMicroUsd).toBeLessThanOrEqual(attempt.reservedMicroUsd);

    const rows = await usageRows(t);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toMatchObject({
      _id: attempt.usageId,
      attemptKey: `crew:${business.projectId}:probe:1`,
      promptRef: PROBE,
      provider: "anthropic",
      model: TIER_MODELS.fast,
      tier: "fast",
      status: "settled",
      billed: "actual",
      creditFunded: true,
      creditDebitId: debitId,
      globalPool: "paid",
      ownerId: business.ownerId,
      projectId: business.projectId,
      taskId: business.taskId,
      costMicroUsd: BigInt(attempt.chargedMicroUsd),
      reservedMicroUsd: BigInt(attempt.reservedMicroUsd),
    });
    expect(row.sentAt).toBeTypeOf("number");
    expect(row.settledAt).toBeTypeOf("number");
    expect(row.outputTokens).toBeGreaterThan(0n);

    // Owner budget and the paid global pool hold the spend, nothing in flight.
    expect(await ownerBudget(t, business.ownerId)).toMatchObject({
      reservedMicroUsd: 0n,
      daySpentMicroUsd: BigInt(attempt.chargedMicroUsd),
    });
    expect(await globalPool(t, "paid")).toEqual({ spentTodayMicroUsd: attempt.chargedMicroUsd, inFlightMicroUsd: 0 });
    expect(await globalPool(t, "free")).toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 0 });

    // The same attempt key again: the meter returns the existing row, nothing is sent or charged.
    const replay = await runJob(t, runArgs(business, debitId));
    expect(replay).toMatchObject({
      ok: false,
      failure: { kind: "duplicate_attempt", attemptKey: `crew:${business.projectId}:probe:1`, usageId: attempt.usageId },
      attempts: [],
    });
    const forbidden = forbiddenAdapter();
    const direct = await runJob(t, runArgs(business, debitId), { adapter: forbidden.adapter });
    expect(direct).toMatchObject({ ok: false, failure: { kind: "duplicate_attempt", usageId: attempt.usageId } });
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toEqual(rows);
    expect(await ownerBudget(t, business.ownerId)).toMatchObject({ daySpentMicroUsd: BigInt(attempt.chargedMicroUsd) });
    expect(await globalPool(t, "paid")).toEqual({ spentTodayMicroUsd: attempt.chargedMicroUsd, inFlightMicroUsd: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("an ownerless eval run (CI graders) settles in the free pool with no owner budget", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    await seedBusiness(t, "eval");
    const result = await t.action(internal.ai.gatewayActions.runPrompt, {
      promptRef: PROBE,
      inputs: { label: "grader case" },
      attemptKey: { kind: "eval", runId: "run_1", caseId: "case_1" },
    });
    expect(result).toMatchObject({ ok: true, attempts: [{ attemptKey: "eval:run_1:case_1:1", status: "settled" }] });
    expect(await t.run(async (ctx) => await ctx.db.query("ai_budgets").collect())).toHaveLength(0);
    const charged = result.attempts[0].chargedMicroUsd;
    expect(await globalPool(t, "free")).toEqual({ spentTodayMicroUsd: charged, inFlightMicroUsd: 0 });
  });

  test("takes a promptRef only: an unknown ref or a bad key form fails before anything is reserved", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const business = await seedBusiness(t, "refs");
    const unknown = await t.action(internal.ai.gatewayActions.runPrompt, { ...runArgs(business, undefined), promptRef: "crew-nope@1" });
    expect(unknown).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
    const badKey = await t.action(internal.ai.gatewayActions.runPrompt, {
      ...runArgs(business, undefined),
      attemptKey: { kind: "job", jobKey: "not-a-job-key" },
    });
    expect(badKey).toMatchObject({ ok: false, failure: { kind: "config" } });
    expect(await usageRows(t)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// a2. Review fixes: internal specs, key forms, retries and terminal replays
// ---------------------------------------------------------------------------

describe("gateway action: what runs where", () => {
  test("the registered action refuses the internal probe on the job and chat paths, before any reserve", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const business = await seedBusiness(t, "internal");
    const debitId = await debit(t, business);

    const job = await t.action(internal.ai.gatewayActions.runPrompt, runArgs(business, debitId));
    expect(job).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [], nextAttempt: 1 });
    if (job.ok || job.failure.kind !== "config") throw new Error("expected a config refusal");
    expect(job.failure.message).toContain("internal spec");
    const chat = await t.action(internal.ai.gatewayActions.runPrompt, {
      ...runArgs(business, undefined),
      taskId: undefined,
      attemptKey: { kind: "chat", chatMessageId: "msg_1" },
    });
    expect(chat).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });

    expect(await usageRows(t)).toHaveLength(0);
    expect(await ownerBudget(t, business.ownerId)).toBeNull();
    expect(await globalPool(t, "paid")).toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 0 });
    expect(await globalPool(t, "free")).toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 0 });
  });

  test("the registered action runs the internal probe on the ownerless eval path", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    await seedBusiness(t, "internal-eval");
    const result = await t.action(internal.ai.gatewayActions.runPrompt, {
      promptRef: PROBE,
      inputs: { label: "grader case" },
      attemptKey: { kind: "eval", runId: "run_2", caseId: "case_1" },
    });
    expect(result).toMatchObject({ ok: true, nextAttempt: 2, attempts: [{ attemptKey: "eval:run_2:case_1:1" }] });
    const rows = await usageRows(t);
    expect(rows).toMatchObject([{ promptRef: PROBE, creditFunded: false, status: "settled" }]);
    expect([rows[0].ownerId, rows[0].taskId, rows[0].creditDebitId]).toEqual([undefined, undefined, undefined]);
  });

  test("an eval key with an owner, business, task or debit is refused before any reserve", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const business = await seedBusiness(t, "eval-owned");
    const debitId = await debit(t, business);
    const evalKey = { kind: "eval" as const, runId: "run_3", caseId: "case_1" };
    const base = { promptRef: PROBE, inputs: { label: "grader case" }, attemptKey: evalKey };
    const forbidden = forbiddenAdapter();
    for (const ids of [
      { ownerId: business.ownerId },
      { projectId: business.projectId },
      { taskId: business.taskId },
      { creditDebitId: debitId },
    ]) {
      // `allowInternal` is on, so the refusal is the key form's, not the internal flag's.
      const result = await runJob(t, { ...base, ...ids }, { adapter: forbidden.adapter });
      expect(result).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
      if (result.ok || result.failure.kind !== "config") throw new Error("expected a config refusal");
      expect(result.failure.message).toContain("ownerless");
      // The registered action refuses it too.
      const registered = await t.action(internal.ai.gatewayActions.runPrompt, { ...base, ...ids });
      expect(registered).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
    }
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(0);
  });

  test("a job key without its task or its owner is refused before any reserve", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const business = await seedBusiness(t, "job-unowned");
    const forbidden = forbiddenAdapter();
    const noTask = await runJob(t, { ...runArgs(business, undefined), taskId: undefined }, { adapter: forbidden.adapter });
    expect(noTask).toMatchObject({ ok: false, failure: { kind: "config", message: expect.stringContaining("taskId") }, attempts: [] });
    const noOwner = await runJob(t, { ...runArgs(business, undefined), ownerId: undefined }, { adapter: forbidden.adapter });
    expect(noOwner).toMatchObject({ ok: false, failure: { kind: "config", message: expect.stringContaining("ownerId") }, attempts: [] });
    const neither = await runJob(
      t,
      { ...runArgs(business, undefined), ownerId: undefined, projectId: undefined, taskId: undefined },
      { adapter: forbidden.adapter },
    );
    expect(neither).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
    const ownerlessChat = await runJob(
      t,
      { ...runArgs(business, undefined), ownerId: undefined, taskId: undefined, attemptKey: { kind: "chat", chatMessageId: "msg_1" } },
      { adapter: forbidden.adapter },
    );
    expect(ownerlessChat).toMatchObject({ ok: false, failure: { kind: "config", message: expect.stringContaining("ownerId") }, attempts: [] });
    const badAttempt = await runJob(t, runArgs(business, undefined, 0), { adapter: forbidden.adapter });
    expect(badAttempt).toMatchObject({ ok: false, failure: { kind: "config" }, attempts: [] });
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(0);
  });

  test("after a re-ask, nextAttempt is 3: a retry on 2 is a duplicate with nothing sent, a retry on 3 runs", async () => {
    const t = gatewayTest();
    const business = await seedBusiness(t, "retry");
    const debitId = await debit(t, business);
    const bad = scriptedAdapter(() => ({ json: { wrong: true } }));
    const first = await runJob(t, runArgs(business, debitId, 1), { adapter: bad.adapter, clock: fixedClock() });
    expect(first).toMatchObject({ ok: false, failure: { kind: "schema_invalid" }, nextAttempt: 3 });
    expect(first.attempts.map((a) => [a.attempt, a.reask])).toEqual([[1, false], [2, true]]);
    const rowsAfterFirst = await usageRows(t);
    expect(rowsAfterFirst).toHaveLength(2);

    // A caller computing `attempt + 1` lands on the re-ask row: the meter says
    // "attemptKey reused for a different call", reported as a duplicate.
    const forbidden = forbiddenAdapter();
    const collided = await runJob(t, runArgs(business, debitId, 2), { adapter: forbidden.adapter });
    expect(collided).toMatchObject({
      ok: false,
      failure: { kind: "duplicate_attempt", attemptKey: `crew:${business.projectId}:probe:2` },
      attempts: [],
    });
    if (collided.ok || collided.failure.kind !== "duplicate_attempt") throw new Error("expected a duplicate");
    expect(collided.failure.usageId).toBeUndefined();
    expect(collided.failure.reason).toBe("key_reused_for_different_call");
    expect(collided.failure.message).toContain("attemptKey reused for a different call");
    expect(collided.nextAttempt).toBe(3);
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toEqual(rowsAfterFirst);

    // The retry on nextAttempt proceeds and settles.
    const good = scriptedAdapter();
    const retried = await runJob(t, runArgs(business, debitId, first.nextAttempt), { adapter: good.adapter, clock: fixedClock() });
    expect(retried).toMatchObject({
      ok: true,
      attempts: [{ attempt: 3, attemptKey: `crew:${business.projectId}:probe:3`, status: "settled" }],
      nextAttempt: 4,
    });
    expect(good.calls()).toBe(1);
    expect(await usageRows(t)).toHaveLength(3);
  });

  test("two tasks sharing one jobKey: the second is a duplicate that names the reuse, and nothing is sent", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const business = await seedBusiness(t, "shared-key");
    const otherTaskId = await t.run(async (ctx) => await ctx.db.insert("tasks", {
      ownerId: business.ownerId, projectId: business.projectId, type: "crew_brand_kit", status: "queued",
      title: "shared-key other task", idempotencyKey: "task-shared-key-other", createdAt: 3, updatedAt: 3,
    }));
    const first = await runJob(t, runArgs(business, undefined));
    expect(first).toMatchObject({ ok: true });
    const forbidden = forbiddenAdapter();
    const second = await runJob(t, { ...runArgs(business, undefined), taskId: otherTaskId }, { adapter: forbidden.adapter });
    expect(second).toMatchObject({
      ok: false,
      failure: {
        kind: "duplicate_attempt",
        attemptKey: `crew:${business.projectId}:probe:1`,
        reason: "key_reused_for_different_call",
        message: expect.stringContaining("attemptKey reused for a different call"),
      },
      attempts: [],
    });
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(1);
  });

  test("a replay after the task has finished is refused by the meter, not deduped, and nothing is sent", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const business = await seedBusiness(t, "terminal");
    const debitId = await debit(t, business);
    const settled = await runJob(t, runArgs(business, debitId));
    expect(settled).toMatchObject({ ok: true });
    const rows = await usageRows(t);

    // The real reserve checks the task (and the debit) before the attempt key,
    // so the same key on a finished task is a refusal, not `duplicate_attempt`.
    await t.run(async (ctx) => await ctx.db.patch("tasks", business.taskId, { status: "succeeded" }));
    const forbidden = forbiddenAdapter();
    const replay = await runJob(t, runArgs(business, debitId), { adapter: forbidden.adapter });
    expect(replay).toMatchObject({
      ok: false,
      failure: { kind: "meter_refused", error: { code: "RESOURCE_NOT_FOUND" } },
      attempts: [],
      nextAttempt: 1,
    });
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toEqual(rows);
    // Nothing was refunded: the refusal alone is no reason to refund.
    const refunds = await t.run(async (ctx) =>
      (await ctx.db.query("credit_ledger").collect()).filter((entry) => entry.reason === "task_refund"));
    expect(refunds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// b. Failure: fail settles, the job is refunded once, the refunded debit is refused
// ---------------------------------------------------------------------------

describe("gateway action: failures through the real meter and ledger", () => {
  test("two schema failures (one re-ask) fail correctly; refund once; the refunded debit is refused", async () => {
    const t = gatewayTest();
    const business = await seedBusiness(t, "schema");
    const debitId = await debit(t, business);
    const scripted = scriptedAdapter(() => ({ json: { wrong: true } }));

    const result = await runJob(t, runArgs(business, debitId), {
      adapter: scripted.adapter,
      clock: fixedClock(),
    });
    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "schema_invalid", issues: ["echo: invalid_type"] },
      attempts: [
        { attempt: 1, reask: false, status: "failed", billed: "actual", errorClass: "schema_invalid" },
        { attempt: 2, reask: true, status: "failed", billed: "actual", errorClass: "schema_invalid" },
      ],
      nextAttempt: 3,
    });
    expect(scripted.calls()).toBe(2);
    const charged = result.attempts.reduce((sum, a) => sum + a.chargedMicroUsd, 0);
    expect(charged).toBeGreaterThan(0);

    const rows = await usageRows(t);
    expect(rows.map((row) => [row.attemptKey, row.status, row.billed, row.reask ?? false])).toEqual([
      [`crew:${business.projectId}:probe:1`, "failed", "actual", false],
      [`crew:${business.projectId}:probe:2`, "failed", "actual", true],
    ]);
    expect(rows.every((row) => row.sentAt !== undefined && row.finalizedAt !== undefined)).toBe(true);
    expect(await ownerBudget(t, business.ownerId)).toMatchObject({ reservedMicroUsd: 0n, daySpentMicroUsd: BigInt(charged) });
    expect(await globalPool(t, "paid")).toEqual({ spentTodayMicroUsd: charged, inFlightMicroUsd: 0 });

    // The job fails, and its credits come back exactly once.
    await t.run(async (ctx) => await ctx.db.patch("tasks", business.taskId, { status: "failed" }));
    const refund = await t.mutation(internal.platform.billing.ledger.refundFailedTask, {
      taskId: business.taskId, projectId: business.projectId,
    });
    const again = await t.mutation(internal.platform.billing.ledger.refundFailedTask, {
      taskId: business.taskId, projectId: business.projectId,
    });
    expect(refund.duplicate).toBe(false);
    expect(again).toMatchObject({ duplicate: true, ledgerId: refund.ledgerId });
    const refunds = await t.run(async (ctx) =>
      (await ctx.db.query("credit_ledger").collect()).filter((entry) => entry.reason === "task_refund"));
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ delta: 1n, idempotencyKey: `task-refund:${debitId}` });

    // A further attempt against the refunded debit is refused by the meter: nothing is sent.
    const forbidden = forbiddenAdapter();
    const refused = await runJob(t, runArgs(business, debitId, 3), { adapter: forbidden.adapter });
    expect(refused).toMatchObject({ ok: false, failure: { kind: "meter_refused", error: { code: "RESOURCE_NOT_FOUND" } }, attempts: [] });
    // Even with the task live again, the refund alone blocks the debit.
    await t.run(async (ctx) => await ctx.db.patch("tasks", business.taskId, { status: "running" }));
    const stillRefused = await runJob(t, runArgs(business, debitId, 3), { adapter: forbidden.adapter });
    expect(stillRefused).toMatchObject({ ok: false, failure: { kind: "meter_refused", error: { code: "RESOURCE_NOT_FOUND" } } });
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(2);
  });

  test("a provider failure that may have billed charges the reservation, with no re-ask", async () => {
    const t = gatewayTest();
    const business = await seedBusiness(t, "provider");
    const debitId = await debit(t, business);
    let calls = 0;
    const adapter: TextAdapterPort = {
      complete: async () => {
        calls += 1;
        throw new ProviderError("anthropic", "server", "Anthropic returned 529", { status: 529 });
      },
    };
    const result = await runJob(t, runArgs(business, debitId), { adapter, clock: fixedClock() });
    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "provider", providerKind: "server", billed: "possible", retryable: true },
      attempts: [{ status: "failed", billed: "possible", errorClass: "retryable" }],
    });
    expect(calls).toBe(1);
    const [attempt] = result.attempts;
    expect(attempt.chargedMicroUsd).toBe(attempt.reservedMicroUsd);
    expect(await usageRows(t)).toMatchObject([
      { status: "failed", billed: "possible", costMicroUsd: BigInt(attempt.reservedMicroUsd) },
    ]);
    expect(await globalPool(t, "paid")).toEqual({ spentTodayMicroUsd: attempt.reservedMicroUsd, inFlightMicroUsd: 0 });
  });

  test("a refusal fails the job at its actual cost, with no re-ask", async () => {
    const t = gatewayTest();
    const business = await seedBusiness(t, "refusal");
    const debitId = await debit(t, business);
    const scripted = scriptedAdapter(() => ({ refusal: { category: "cyber", explanation: "declined" } }));
    const result = await runJob(t, runArgs(business, debitId), { adapter: scripted.adapter });
    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "refusal", provider: "anthropic", category: "cyber" },
      attempts: [{ status: "failed", billed: "actual", errorClass: "refusal" }],
    });
    expect(scripted.calls()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// c. The kill switch: no live call is possible while it is on
// ---------------------------------------------------------------------------

describe("gateway action: the kill switch", () => {
  test("switch on: refused, no fetch even in live mode with a key, no ai_usage row", async () => {
    vi.stubEnv("AI_PROVIDER_MODE", "live");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-a-real-key");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    const t = gatewayTest();
    const business = await seedBusiness(t, "killed", { aiKillSwitch: true });

    const result = await runJob(t, runArgs(business, undefined));
    expect(result).toMatchObject({ ok: false, failure: { kind: "meter_refused", error: { code: "AI_DISABLED" } }, attempts: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await usageRows(t)).toHaveLength(0);
    expect(await globalPool(t, "free")).toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 0 });

    // The workspace switch off is refused the same way.
    await t.run(async (ctx) => await ctx.db.patch("ops_settings", business.opsId, {
      workspaceEnabled: false,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
    }));
    const workspaceOff = await runJob(t, runArgs(business, undefined));
    expect(workspaceOff).toMatchObject({ ok: false, failure: { kind: "meter_refused", error: { code: "AI_DISABLED" } } });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await usageRows(t)).toHaveLength(0);
  });

  test("positive control: with the switch off the same live setup does reach the stubbed fetch", async () => {
    vi.stubEnv("AI_PROVIDER_MODE", "live");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-a-real-key");
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
      { status: 401, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchSpy);
    const t = gatewayTest();
    const business = await seedBusiness(t, "control");

    const result = await runJob(t, runArgs(business, undefined));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as unknown as [unknown];
    expect(String(url).startsWith(ANTHROPIC_BASE_URL)).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "provider", providerKind: "auth", billed: "none" },
      attempts: [{ status: "failed", billed: "none", chargedMicroUsd: 0 }],
    });
  });

  test("switch flipped between reserve and markSent: the row fails unbilled and nothing is sent", async () => {
    const t = gatewayTest();
    const business = await seedBusiness(t, "flip");
    const debitId = await debit(t, business);
    const reserveName = getFunctionName(internal.ai.metering.reserve);
    const ctx = meterCtx(t, async (name) => {
      if (name !== reserveName) return;
      await t.run(async (db) => await db.db.patch("ops_settings", business.opsId, {
        killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      }));
    });
    const forbidden = forbiddenAdapter();
    const result = await runJob(t, runArgs(business, debitId), { adapter: forbidden.adapter }, ctx);
    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "meter_refused", error: { code: "AI_DISABLED" } },
      attempts: [{ status: "failed", billed: "none", chargedMicroUsd: 0, errorClass: "permanent" }],
    });
    expect(forbidden.calls()).toBe(0);
    const rows = await usageRows(t);
    expect(rows).toMatchObject([{ status: "failed", billed: "none", costMicroUsd: 0n }]);
    expect(rows[0].sentAt).toBeUndefined();
    expect(rows.filter((row) => row.status === "reserved")).toHaveLength(0);
    expect(await ownerBudget(t, business.ownerId)).toMatchObject({ reservedMicroUsd: 0n, daySpentMicroUsd: 0n });
    expect(await globalPool(t, "paid")).toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 0 });
  });
});

// ---------------------------------------------------------------------------
// d. The live SDK client reads no env beyond the key it is given
// ---------------------------------------------------------------------------

describe("live Claude client: SDK env", () => {
  test("ignores ANTHROPIC_LOG, ANTHROPIC_BASE_URL and OpenTelemetry env, and strips ANTHROPIC_CUSTOM_HEADERS", async () => {
    vi.stubEnv("ANTHROPIC_LOG", "debug");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://proxy.example.test");
    vi.stubEnv("ANTHROPIC_CUSTOM_HEADERS", "X-Injected: yes\nanthropic-beta: injected-beta\ntraceparent: 00-injected");
    vi.stubEnv("ANTHROPIC_WEBHOOK_SIGNING_KEY", "whsec-not-a-real-key");
    vi.stubEnv("ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE", "content");
    const consoleSpies = (["log", "debug", "info", "warn", "error"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined));
    const seen: { url: string; headers: Headers }[] = [];
    const fetchSpy = vi.fn(async (url: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), headers: new Headers(init?.headers) });
      return new Response(
        JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = defaultAnthropicClientFactory("test-key-not-a-real-key");
    await expect(client.messages.create({
      model: TIER_MODELS.fast,
      max_tokens: 16,
      messages: [{ role: "user", content: "probe" }],
    })).rejects.toThrow();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [{ url, headers }] = seen;
    expect(url.startsWith(`${ANTHROPIC_BASE_URL}/`)).toBe(true);
    expect(headers.get("x-injected")).toBeNull();
    expect(headers.get("anthropic-beta")).toBeNull();
    expect(headers.get("traceparent")).toBeNull();
    expect(headers.get("anthropic-version")).not.toBeNull();
    expect(headers.get("x-api-key") ?? headers.get("authorization")).toContain("test-key-not-a-real-key");
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
    for (const spy of consoleSpies) spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// f. The wizard key form: owner spend before the business exists (2026-11-06)
//
// These tests use `WIZARD_FIXTURE`, a NON-internal copy of the probe that the
// mocked registry adds (top of file). The internal probe would be refused by
// the internal-spec rule before any key check runs, so it could not show that
// the wizard checks themselves refuse.
// ---------------------------------------------------------------------------

type WizardOwner = {
  readonly ownerId: Id<"users">;
  readonly wizardSessionId: Id<"wizard_sessions">;
  readonly opsId: Id<"ops_settings">;
};

/**
 * An owner with a wizard session and no business. Reuses the `ops_settings`
 * singleton when one exists; otherwise creates it (`allowlist` leaves the
 * owner out of the cohort).
 */
async function seedWizardOwner(
  t: T,
  label: string,
  options: { cohort?: "open" | "allowlist"; budget?: { lifetime: bigint; day: bigint } } = {},
): Promise<WizardOwner> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: `${label}-admin@example.test` });
    const ownerId = await ctx.db.insert("users", { email: `${label}-owner@example.test` });
    const existing = await ctx.db.query("ops_settings").first();
    const opsId = existing !== null ? existing._id : await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: true,
      cohortMode: options.cohort ?? "open",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n,
      paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    const wizardSessionId = await ctx.db.insert("wizard_sessions", {
      ownerId, step: "blueprint", answers: {}, startedAt: 1, updatedAt: 1,
    });
    if (options.budget !== undefined) {
      await ctx.db.insert("ai_budgets", {
        ownerId,
        freeLifetimeSpentMicroUsd: options.budget.lifetime,
        reservedMicroUsd: 0n,
        freeReservedMicroUsd: 0n,
        dayKey: utcDayKey(Date.now()),
        daySpentMicroUsd: options.budget.day,
        dayEscalations: 0n,
        updatedAt: 1,
      });
    }
    return { ownerId, wizardSessionId, opsId };
  });
}

function wizardArgs(owner: WizardOwner, attempt?: number): RunPromptArgs {
  return {
    promptRef: WIZARD_FIXTURE,
    inputs: { label: "A packing list that adapts to the forecast" },
    ownerId: owner.ownerId,
    attemptKey: { kind: "wizard", wizardSessionId: owner.wizardSessionId, step: "blueprint" },
    ...(attempt === undefined ? {} : { attempt }),
  };
}

/** The action's body exactly as the registered action runs it (no `allowInternal`), with an injected adapter. */
async function runBody(t: T, args: RunPromptArgs, deps: RunPromptDeps = {}) {
  return await runPromptWithMeter(meterCtx(t), args, deps);
}

/** The registered `runPrompt` action, in fixture mode. */
async function runRegistered(t: T, args: RunPromptArgs) {
  return await t.action(internal.ai.gatewayActions.runPrompt, args);
}

describe("gateway action: the wizard key form (pre-business owner spend)", () => {
  test("end to end: the registered action settles a non-internal spec on a wizard key, inside the owner's Free budget", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const owner = await seedWizardOwner(t, "wizard-ok");
    const result = await runRegistered(t, wizardArgs(owner));
    expect(result).toMatchObject({ ok: true, promptRef: WIZARD_FIXTURE, nextAttempt: 2 });
    if (!result.ok) throw new Error("expected a settled run");
    expect(JSON.parse(result.outputJson)).toEqual({ echo: "fixture" });
    const [attempt] = result.attempts;
    expect(attempt).toMatchObject({ attemptKey: `wizard:${owner.wizardSessionId}:blueprint:1`, status: "settled" });

    const rows = await usageRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      attemptKey: `wizard:${owner.wizardSessionId}:blueprint:1`,
      promptRef: WIZARD_FIXTURE,
      ownerId: owner.ownerId,
      plan: "free",
      globalPool: "free",
      creditFunded: false,
      status: "settled",
    });
    expect(rows[0].projectId).toBeUndefined();
    expect(rows[0].taskId).toBeUndefined();
    // Counted against the owner like any other Free spend.
    expect(await ownerBudget(t, owner.ownerId)).toMatchObject({
      freeLifetimeSpentMicroUsd: BigInt(attempt.chargedMicroUsd),
      daySpentMicroUsd: BigInt(attempt.chargedMicroUsd),
      reservedMicroUsd: 0n,
    });
    expect(await globalPool(t, "free")).toEqual({ spentTodayMicroUsd: attempt.chargedMicroUsd, inFlightMicroUsd: 0 });
  });

  test("a project, task, credit debit or business context is refused by the wizard check, before any reserve", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    // The business seeds the ops singleton; the wizard owner reuses it.
    const business = await seedBusiness(t, "wizard-forbidden-business");
    const owner = await seedWizardOwner(t, "wizard-forbidden");
    const debitId = await debit(t, business);
    const forbidden = forbiddenAdapter();
    for (const [name, extra] of [
      ["projectId", { projectId: business.projectId }],
      ["taskId", { taskId: business.taskId }],
      ["creditDebitId", { creditDebitId: debitId }],
      ["businessContext", { businessContext: "Another business's context" }],
    ] as const) {
      const expected = {
        ok: false,
        failure: { kind: "config", message: `a wizard attempt key is pre-business; got ${name}` },
        attempts: [],
        nextAttempt: 1,
      };
      expect(await runBody(t, { ...wizardArgs(owner), ...extra }, { adapter: forbidden.adapter })).toMatchObject(expected);
      expect(await runRegistered(t, { ...wizardArgs(owner), ...extra })).toMatchObject(expected);
    }
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(0);
  });

  test("no owner is refused by the wizard check: a wizard key never reserves ownerless", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const owner = await seedWizardOwner(t, "wizard-ownerless");
    const forbidden = forbiddenAdapter();
    const expected = {
      ok: false,
      failure: { kind: "config", message: "a wizard attempt key needs the run's ownerId" },
      attempts: [],
    };
    expect(await runBody(t, { ...wizardArgs(owner), ownerId: undefined }, { adapter: forbidden.adapter })).toMatchObject(expected);
    expect(await runRegistered(t, { ...wizardArgs(owner), ownerId: undefined })).toMatchObject(expected);
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(0);
  });

  test("a malformed session id or a step outside C-WIZARD is refused by the key builder, before any reserve", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const owner = await seedWizardOwner(t, "wizard-malformed");
    const forbidden = forbiddenAdapter();
    const badId = { ok: false, failure: { kind: "config", message: "wizardSessionId must be a wizard_sessions id" }, attempts: [] };
    for (const wizardSessionId of ["not:an:id", "", "UPPER_case_id_000000", "short"]) {
      const key = { kind: "wizard" as const, wizardSessionId: wizardSessionId as Id<"wizard_sessions">, step: "blueprint" };
      expect(await runBody(t, { ...wizardArgs(owner), attemptKey: key }, { adapter: forbidden.adapter })).toMatchObject(badId);
    }
    // The registered action's validator also refuses an id that is not a wizard_sessions id.
    await expect(runRegistered(t, {
      ...wizardArgs(owner),
      attemptKey: { kind: "wizard", wizardSessionId: "not:an:id" as Id<"wizard_sessions">, step: "blueprint" },
    })).rejects.toThrow();

    const badStep = { ok: false, failure: { kind: "config", message: "step must be a C-WIZARD step" }, attempts: [] };
    for (const step of ["checkout", "", "blueprint:1", "Blueprint", "phone"]) {
      const key = { kind: "wizard" as const, wizardSessionId: owner.wizardSessionId, step };
      expect(await runBody(t, { ...wizardArgs(owner), attemptKey: key }, { adapter: forbidden.adapter })).toMatchObject(badStep);
      expect(await runRegistered(t, { ...wizardArgs(owner), attemptKey: key })).toMatchObject(badStep);
    }
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(0);
  });

  test("the owner gates apply with no project: Free ceiling, daily cap, cohort and the AI switch", async () => {
    stubFixtureEnv();
    // One convex-test instance per gate: `ops_settings` is a singleton.
    const instances: T[] = [];
    const fresh = () => {
      const instance = gatewayTest();
      instances.push(instance);
      return instance;
    };

    let t = fresh();
    const atCeiling = await seedWizardOwner(t, "wizard-ceiling", { budget: { lifetime: 1_499_999n, day: 0n } });
    expect(await runRegistered(t, wizardArgs(atCeiling))).toMatchObject({
      ok: false,
      failure: { kind: "meter_refused", error: { code: "BUDGET_EXHAUSTED", scope: "owner_free_lifetime" } },
      attempts: [],
    });

    t = fresh();
    const atDailyCap = await seedWizardOwner(t, "wizard-daily", { budget: { lifetime: 0n, day: 999_999n } });
    expect(await runRegistered(t, wizardArgs(atDailyCap))).toMatchObject({
      ok: false,
      failure: { kind: "meter_refused", error: { code: "BUDGET_EXHAUSTED", scope: "owner_daily" } },
      attempts: [],
    });

    t = fresh();
    const outsideCohort = await seedWizardOwner(t, "wizard-cohort", { cohort: "allowlist" });
    expect(await runRegistered(t, wizardArgs(outsideCohort))).toMatchObject({
      ok: false,
      failure: { kind: "meter_refused", error: { code: "RESOURCE_NOT_FOUND" } },
      attempts: [],
    });

    t = fresh();
    const switchedOff = await seedWizardOwner(t, "wizard-ai-off");
    await t.run(async (ctx) => {
      const ops = await ctx.db.get("ops_settings", switchedOff.opsId);
      if (ops === null) throw new Error("ops_settings missing");
      await ctx.db.patch("ops_settings", switchedOff.opsId, { killSwitches: { ...ops.killSwitches, ai: true } });
    });
    expect(await runRegistered(t, wizardArgs(switchedOff))).toMatchObject({
      ok: false,
      failure: { kind: "meter_refused", error: { code: "AI_DISABLED" } },
      attempts: [],
    });

    for (const instance of instances) expect(await usageRows(instance)).toHaveLength(0);
  });

  test("the same key again is a duplicate with nothing sent; nextAttempt moves past it", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const owner = await seedWizardOwner(t, "wizard-duplicate");
    const first = await runRegistered(t, wizardArgs(owner));
    expect(first).toMatchObject({ ok: true, nextAttempt: 2 });
    if (!first.ok) throw new Error("expected a settled run");
    const charged = first.attempts[0].chargedMicroUsd;

    // A redraft that starts again at attempt 1 is the duplicate the wizard must avoid.
    const forbidden = forbiddenAdapter();
    const replay = await runBody(t, wizardArgs(owner), { adapter: forbidden.adapter });
    expect(replay).toMatchObject({
      ok: false,
      failure: {
        kind: "duplicate_attempt",
        attemptKey: `wizard:${owner.wizardSessionId}:blueprint:1`,
        usageId: first.attempts[0].usageId,
      },
      attempts: [],
      nextAttempt: 2,
    });
    expect(forbidden.calls()).toBe(0);
    expect(await usageRows(t)).toHaveLength(1);
    expect(await ownerBudget(t, owner.ownerId)).toMatchObject({ freeLifetimeSpentMicroUsd: BigInt(charged) });

    const retried = await runRegistered(t, wizardArgs(owner, replay.nextAttempt));
    expect(retried).toMatchObject({
      ok: true,
      nextAttempt: 3,
      attempts: [{ attemptKey: `wizard:${owner.wizardSessionId}:blueprint:2`, status: "settled" }],
    });
  });

  test("a wizard key never takes the ownerless eval path: the registered action refuses an internal spec", async () => {
    stubFixtureEnv();
    const t = gatewayTest();
    const owner = await seedWizardOwner(t, "wizard-internal");
    const registered = await runRegistered(t, { ...wizardArgs(owner), promptRef: PROBE });
    expect(registered).toMatchObject({
      ok: false,
      failure: { kind: "config", message: expect.stringContaining("ownerless eval path") },
      attempts: [],
    });
    expect(await usageRows(t)).toHaveLength(0);
    expect(await t.run(async (ctx) => await ctx.db.query("ai_budgets").collect())).toHaveLength(0);
  });
});
