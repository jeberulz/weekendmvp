/// <reference types="vite/client" />
/**
 * WP75-S2b. The launch DAG on `crewWorkpool` in convex-test, with
 * `@convex-dev/workpool/test` registered: the founder's `startLaunch` /
 * `retryLaunch` / `resumeLaunch`, the pool running each step, and `stepDone`
 * re-invoking, settling, parking and filling slots. Fixture mode with the
 * REAL registry, C-METER, ledger, approvals and limiter; no provider is ever
 * called. The pool's action (`runCrewGeneratorStep`) is the real generator
 * step with a fixture adapter; a test can script one call (a reply, a change
 * just before the gateway call, or an action that dies mid-run).
 */
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import type { AnthropicFixtureReply } from "../ai/providers/fixtures";
import { ProviderError } from "../ai/providers/types";
import { hydrotrailWizardAnswers } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import type { WizardAnswers } from "../../lib/workspace/contracts/wizard";
import { RUN_LEASE_MS, abandonCrewTask, ensureLaunchStepTasks } from "./jobs";
import { FAILED_STEP_INTERRUPTED_REASON } from "../../lib/workspace/crew/retry";
import {
  BRIEF_CHANGED_REASON,
  LAUNCH_STUCK_REASON,
  OWNER_CREW_CAP,
  STEP_FAILED_REASON,
  WAITING_FOR_SLOT_REASON,
} from "./launch";
import type { CrewStepOutcome } from "./runner";
import { LAUNCH_STEPS, launchStepPosition, type LaunchStep } from "./steps";

/** What one pool call of `runCrewGeneratorStep` does (the default is the real step with the fixture gateway). */
type Plan = {
  /** Runs first, before the step starts. */
  readonly prelude?: () => Promise<void>;
  /** The fixture reply for this call's gateway run. */
  readonly reply?: () => AnthropicFixtureReply | undefined;
  /** Runs just before the gateway call (between prepare and finish). */
  readonly before?: () => Promise<void>;
  /** The action opens its run and then dies (throws): the workpool reports a failure. */
  readonly die?: boolean;
  /** The action dies before it opens a run (an unpaid step's task is still `queued`). */
  readonly dieEarly?: boolean;
  /** The action returns this without running the step. */
  readonly outcome?: CrewStepOutcome;
};

type PlanFor = (call: { taskId: string; type: string; resume: boolean; n: number }) => Plan;

const hooks = vi.hoisted(() => ({
  plan: (() => ({})) as PlanFor,
  calls: [] as { taskId: string; type: string; resume: boolean; at: number }[],
  /** What each call returned (undefined for an action that died). */
  outcomes: [] as (CrewStepOutcome | undefined)[],
  readType: (async () => "unknown") as (taskId: string) => Promise<string>,
}));

vi.mock("./generators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./generators")>();
  const { internalAction } = await import("../_generated/server");
  const { internal: refs } = await import("../_generated/api");
  const runner = await import("./runner");
  const { runPromptWithMeter } = await import("../ai/gatewayActions");
  const { createAnthropicAdapter } = await import("../ai/providers/anthropic");
  return {
    ...actual,
    runCrewGeneratorStep: internalAction({
      args: actual.runCrewGeneratorStepArgs,
      returns: runner.crewStepOutcomeValidator,
      handler: async (ctx, args): Promise<CrewStepOutcome> => {
        const type = await hooks.readType(args.taskId);
        const resume = args.resume === true;
        hooks.calls.push({ taskId: args.taskId, type, resume, at: Date.now() });
        const plan = hooks.plan({ taskId: args.taskId, type, resume, n: hooks.calls.length });
        await plan.prelude?.();
        if (plan.outcome !== undefined) return plan.outcome;
        if (plan.dieEarly === true) throw new Error("the action died before it opened a run");
        if (plan.die === true) {
          await ctx.runMutation(refs.crew.jobs.startCrewRun, { taskId: args.taskId, ...(resume ? { resume: true } : {}) });
          throw new Error("the action died mid-run");
        }
        const adapter = createAnthropicAdapter({ env: {}, fixtureResponder: () => plan.reply?.() });
        const outcome = await actual.runCrewGeneratorStepWith(ctx, args, {
          runPrompt: async (promptArgs) => {
            await plan.before?.();
            return await runPromptWithMeter(ctx, promptArgs, { adapter });
          },
        });
        hooks.outcomes[hooks.calls.length - 1] = outcome;
        return outcome;
      },
    }),
  };
});

const modules = import.meta.glob("/convex/**/*.ts");

type T = TestConvex<typeof schema>;

beforeEach(() => {
  vi.useFakeTimers();
  hooks.plan = () => ({});
  hooks.calls = [];
  hooks.outcomes = [];
});
afterEach(() => {
  vi.useRealTimers();
});

type Person = { readonly userId: Id<"users">; readonly sessionId: Id<"authSessions"> };
type World = { readonly t: T; readonly owner: Person; readonly opsId: Id<"ops_settings">; readonly projectIds: Id<"projects">[] };

/** A signed-in owner with `businesses` finished wizards and the businesses `createBusiness` made from them. */
async function world(businesses = 1, answers: WizardAnswers = hydrotrailWizardAnswers): Promise<World> {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  registerWorkpool(t, "crewWorkpool");
  hooks.readType = async (taskId) =>
    (await t.run(async (ctx) => await ctx.db.get("tasks", taskId as Id<"tasks">)))?.type ?? "missing";
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const userId = await ctx.db.insert("users", { email: "owner@example.test", emailVerificationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true }, updatedAt: 1,
    });
    const projectIds: Id<"projects">[] = [];
    for (let i = 0; i < businesses; i += 1) {
      const slug = i === 0 ? "hydrotrail" : `hydrotrail-${i}`;
      const wizardSessionId = await ctx.db.insert("wizard_sessions", {
        ownerId: userId, ideaSlug: "hydrotrail", step: "partner_name", answers, startedAt: 1, updatedAt: 1, completedAt: 2,
      });
      const projectId = await ctx.db.insert("projects", {
        ownerId: userId, source: "repository_idea", title: "HydroTrail", status: "draft", idempotencyKey: `business:${slug}`,
        workspace: {
          version: 1, name: "HydroTrail", slug, ideaSlug: "hydrotrail", platform: "web", commercialModel: "free", goal: "waitlist",
          partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
        },
        createdAt: 1 + i, updatedAt: 1 + i,
      });
      await ctx.db.patch("wizard_sessions", wizardSessionId, { projectId });
      projectIds.push(projectId);
    }
    return { owner: { userId, sessionId }, opsId, projectIds };
  });
  return { t, ...ids };
}

const as = (w: World) => w.t.withIdentity({ subject: `${w.owner.userId}|${w.owner.sessionId}`, issuer: "https://local.test" });

const crewJobLimiter = new RateLimiter(components.rateLimiter, { crewJob: { kind: "fixed window", rate: 10, period: HOUR } });

async function tokensSpent(w: World): Promise<number> {
  return 10 - (await w.t.run(async (ctx) => await crewJobLimiter.getValue(ctx, "crewJob", { key: w.owner.userId }))).value;
}

/** The owner's `crewJob` limiter state as stored (any spend rewrites it). */
async function limiterState(w: World) {
  return await w.t.run(async (ctx) => await crewJobLimiter.getValue(ctx, "crewJob", { key: w.owner.userId }));
}

/** Runs the pool (and everything it schedules) to the end. */
async function drain(w: World): Promise<void> {
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
}

type Rows = { tasks: Doc<"tasks">[]; steps: Doc<"task_steps">[]; documents: Doc<"documents">[]; runs: Doc<"workflow_runs">[] };

async function rows(w: World): Promise<Rows> {
  return await w.t.run(async (ctx) => ({
    tasks: await ctx.db.query("tasks").collect(),
    steps: await ctx.db.query("task_steps").collect(),
    documents: await ctx.db.query("documents").collect(),
    runs: await ctx.db.query("workflow_runs").collect(),
  }));
}

const ofType = (r: Rows, type: Doc<"tasks">["type"], projectId?: Id<"projects">) =>
  r.tasks.filter((row) => row.type === type && (projectId === undefined || row.projectId === projectId));

/** Crew tasks the owner has in flight: running, or queued with a running marker. */
function inFlight(r: Rows): number {
  const onPool = new Set(r.steps.filter((row) => row.status === "running").map((row) => row.taskId));
  return r.tasks.filter((row) => row.type !== "crew_roster" &&
    (row.status === "running" || (row.status === "queued" && onPool.has(row._id)))).length;
}

const progress = async (w: World, projectId = w.projectIds[0] as Id<"projects">) =>
  await as(w).query(api.crew.launch.launchProgress, { projectId });

const start = async (w: World, projectId = w.projectIds[0] as Id<"projects">) =>
  await as(w).mutation(api.crew.roster.startLaunch, { projectId });

async function setAi(w: World, on: boolean): Promise<void> {
  await w.t.run(async (ctx) => {
    const ops = await ctx.db.get("ops_settings", w.opsId);
    if (ops === null) throw new Error("no ops");
    await ctx.db.patch("ops_settings", w.opsId, { killSwitches: { ...ops.killSwitches, ai: !on } });
  });
}

// ---------------------------------------------------------------------------

describe("WP75-S2b HydroTrail launch through the pool", () => {
  test("blueprint → roster → brand kit text → email sequence, in order; pending steps skipped with a reason; one token", async () => {
    const w = await world();
    expect(await start(w)).toEqual({ state: "assembling" });
    const atStart = await limiterState(w);
    await drain(w);
    // The pool's own steps spent nothing: the limiter's state is exactly what the launch left (a later spend
    // would rewrite it, even after the fake clock passes the hour).
    expect(await limiterState(w)).toEqual(atStart);

    const r = await rows(w);
    const [blueprint] = ofType(r, "crew_blueprint");
    const [kit] = ofType(r, "crew_brand_kit");
    const [email] = ofType(r, "crew_email_sequence");
    expect(blueprint).toMatchObject({ status: "succeeded" });
    expect(ofType(r, "crew_roster")[0]).toMatchObject({ status: "succeeded" });
    expect(kit).toMatchObject({ status: "succeeded", employeeKey: "brand", changeRound: 0n, creditCost: 0n });
    expect(email).toMatchObject({ status: "succeeded", employeeKey: "email", changeRound: 0n, creditCost: 0n });
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_brand_kit", "crew_email_sequence"]);
    // In order: the kit's run opened after the blueprint (and with it the roster) was stored; the email's after the kit.
    const blueprintDoc = r.documents.find((doc) => doc.kind === "blueprint");
    const kitDoc = r.documents.find((doc) => doc.kind === "brand_kit");
    const kitRun = r.runs.find((run) => run.taskId === kit?._id);
    const emailRun = r.runs.find((run) => run.taskId === email?._id);
    expect(kitRun?.startedAt).toBeGreaterThanOrEqual(blueprintDoc?.createdAt ?? Infinity);
    expect(emailRun?.startedAt).toBeGreaterThanOrEqual(kitDoc?.createdAt ?? Infinity);
    expect(r.documents.map((doc) => doc.kind).sort()).toEqual(["blueprint", "brand_kit", "email_sequence", "roster_plan"]);
    // Every marker settled with its task.
    expect(r.steps.map((row) => [row.type, row.status, row.position])).toEqual([
      ["crew_blueprint", "succeeded", 0n],
      ["crew_brand_kit", "succeeded", 2n],
      ["crew_email_sequence", "succeeded", 8n],
    ]);
    // Only hired employees' built steps get a task: no slot, no skipped role, ever has one.
    expect(r.tasks.map((row) => row.type).sort()).toEqual(["crew_blueprint", "crew_brand_kit", "crew_email_sequence", "crew_roster"]);
    expect(await tokensSpent(w)).toBe(1);

    const view = await progress(w);
    expect(view.started).toBe(true);
    expect(view.steps.map((step) => [step.key, step.state])).toEqual([
      ["blueprint", "succeeded"],
      ["roster", "succeeded"],
      ["brand_kit", "succeeded"],
      ["logo_marks", "skipped"],
      ["landing_spec", "skipped"],
      ["build_pack", "skipped"],
      ["launch_plan", "skipped"],
      ["seo_pack", "skipped"],
      ["email_sequence", "succeeded"],
      ["social_pack", "skipped"],
      ["ads_drafts", "skipped"],
    ]);
    expect(view.steps.find((step) => step.key === "logo_marks")?.reason).toBe("Logo marks is not built yet, so nothing was written for it yet.");
    expect(view.steps.find((step) => step.key === "seo_pack")?.reason).toBe("SEO pack is coming in a later update, so nothing was written for it yet.");
    expect(view.steps.filter((step) => step.state === "skipped").every((step) => (step.reason ?? "").length > 0)).toBe(true);
  });
});

describe("WP75-S2b the per-owner cap", () => {
  test(`no owner ever has more than ${OWNER_CREW_CAP} crew tasks in flight; the fourth launch waits and is never stranded`, async () => {
    // Plans allow 3 businesses (02 §4.3); four are seeded directly so the cap, not the plan, is what holds.
    const w = await world(4);
    let maxSeen = 0;
    hooks.plan = () => ({ before: async () => void (maxSeen = Math.max(maxSeen, inFlight(await rows(w)))) });
    for (const projectId of w.projectIds) await start(w, projectId);

    let r = await rows(w);
    expect(inFlight(r)).toBe(OWNER_CREW_CAP);
    const waiting = ofType(r, "crew_blueprint", w.projectIds[3]);
    expect(waiting).toEqual([expect.objectContaining({ status: "queued" })]);
    expect(r.steps.filter((row) => row.taskId === waiting[0]?._id)).toHaveLength(0);
    expect((await progress(w, w.projectIds[3])).steps[0]).toMatchObject({ key: "blueprint", state: "queued" });
    expect(await tokensSpent(w)).toBe(4);

    const atStart = await limiterState(w);
    await drain(w);
    expect(await limiterState(w)).toEqual(atStart);
    r = await rows(w);
    expect(maxSeen).toBeGreaterThan(0);
    expect(maxSeen).toBeLessThanOrEqual(OWNER_CREW_CAP);
    expect(ofType(r, "crew_blueprint").map((row) => row.status)).toEqual(Array(4).fill("succeeded"));
    expect(ofType(r, "crew_brand_kit").map((row) => row.status)).toEqual(Array(4).fill("succeeded"));
    expect(inFlight(r)).toBe(0);
    // The DAG's own steps spent nothing: one token per launch.
    expect(await tokensSpent(w)).toBe(4);
  });
});

describe("WP75-S2b the child rule", () => {
  test("a failed parent leaves its children queued and never run", async () => {
    // A registry where the build pack is built under the brand kit (S3d registers it under the roster today).
    const steps = LAUNCH_STEPS as unknown as LaunchStep[];
    const index = launchStepPosition("build_pack");
    const original = steps[index] as LaunchStep;
    steps[index] = { ...original, status: "built", runner: "generator", parents: ["brand_kit"] };
    try {
      const w = await world();
      hooks.plan = ({ type }) => (type === "crew_brand_kit" ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
      await start(w);
      await drain(w);
      const r = await rows(w);
      expect(ofType(r, "crew_brand_kit")[0]).toMatchObject({ status: "failed" });
      const [pack] = ofType(r, "crew_build_pack");
      expect(pack).toMatchObject({ status: "queued", employeeKey: "engineering" });
      expect(r.steps.filter((row) => row.taskId === pack?._id)).toHaveLength(0);
      expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_brand_kit"]);
      const view = await progress(w);
      expect(view.steps.find((step) => step.key === "brand_kit")?.state).toBe("failed");
      expect(view.steps.find((step) => step.key === "build_pack")?.state).toBe("waiting");
      // A slot under the failed kit waits on it (S2b review nit), not "skipped".
      expect(view.steps.find((step) => step.key === "logo_marks")).toMatchObject({ state: "waiting", reason: "Waiting on the brand kit." });
    } finally {
      steps[index] = original;
    }
  });
});

describe("WP75-S2b a parked step", () => {
  test("parks, holds the launch, and resumes on resumeLaunch for one token", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1 ? { before: async () => await setAi(w, false) } : {});
    await start(w);
    await drain(w);
    let r = await rows(w);
    expect(ofType(r, "crew_blueprint")[0]).toMatchObject({ status: "blocked" });
    expect(ofType(r, "crew_brand_kit")).toHaveLength(0);
    expect(inFlight(r)).toBe(0);
    expect(await tokensSpent(w)).toBe(1);

    await setAi(w, true);
    expect((await progress(w)).steps[0]).toMatchObject({ key: "blueprint", state: "paused" });
    // Draining may move the fake clock past the limiter's hour: count the resume in a fresh window.
    await w.t.run(async (ctx) => await crewJobLimiter.reset(ctx, "crewJob", { key: w.owner.userId }));
    expect(await as(w).mutation(api.crew.launch.resumeLaunch, { projectId: w.projectIds[0] as Id<"projects"> }))
      .toEqual({ resumed: 1, paused: 0, waitingForSlot: false });
    expect(await tokensSpent(w)).toBe(1);
    await drain(w);

    r = await rows(w);
    expect(ofType(r, "crew_blueprint")[0]).toMatchObject({ status: "succeeded" });
    expect(ofType(r, "crew_brand_kit")[0]).toMatchObject({ status: "succeeded" });
    expect(hooks.calls.map((call) => [call.type, call.resume])).toEqual([
      ["crew_blueprint", false],
      ["crew_blueprint", true],
      ["crew_brand_kit", false],
      ["crew_email_sequence", false],
    ]);
    // One marker for the blueprint across the park: the resume reused it.
    expect(r.steps.filter((row) => row.type === "crew_blueprint")).toEqual([expect.objectContaining({ status: "succeeded" })]);
    // Nothing parked: resuming again spends nothing.
    await w.t.run(async (ctx) => await crewJobLimiter.reset(ctx, "crewJob", { key: w.owner.userId }));
    expect(await as(w).mutation(api.crew.launch.resumeLaunch, { projectId: w.projectIds[0] as Id<"projects"> }))
      .toEqual({ resumed: 0, paused: 0, waitingForSlot: false });
    expect(await tokensSpent(w)).toBe(0);
  });
});

describe("WP75-S2b idempotency and tokens", () => {
  test("replaying startLaunch creates nothing new, before and after the pool runs", async () => {
    const w = await world();
    await start(w);
    const before = await rows(w);
    await start(w);
    await start(w);
    let after = await rows(w);
    expect(after.tasks).toEqual(before.tasks);
    expect(after.steps).toEqual(before.steps);
    await drain(w);
    const done = await rows(w);
    await start(w);
    await drain(w);
    after = await rows(w);
    expect(after.tasks).toEqual(done.tasks);
    expect(after.steps).toEqual(done.steps);
    expect(after.documents).toEqual(done.documents);
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_brand_kit", "crew_email_sequence"]);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("a retry spends one token and the DAG carries on from the new draft", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1 ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
    await start(w);
    expect(await tokensSpent(w)).toBe(1);
    await drain(w);
    expect(await as(w).query(api.crew.roster.launchStatus, { projectId: w.projectIds[0] as Id<"projects"> }))
      .toEqual({ state: "failed", paused: false, retryable: true });
    // Draining the pool moved the fake clock past the limiter's hour, so start a fresh window to count this action.
    await w.t.run(async (ctx) => await crewJobLimiter.reset(ctx, "crewJob", { key: w.owner.userId }));
    expect(await as(w).mutation(api.crew.roster.retryLaunch, { projectId: w.projectIds[0] as Id<"projects"> })).toEqual({ state: "assembling" });
    expect(await tokensSpent(w)).toBe(1);
    await drain(w);
    const r = await rows(w);
    expect(ofType(r, "crew_blueprint").map((row) => row.status).sort()).toEqual(["failed", "succeeded"]);
    expect(ofType(r, "crew_brand_kit")[0]).toMatchObject({ status: "succeeded" });
  });
});

describe("WP75-S2b stepDone re-enqueues", () => {
  test("retry: a retryable gateway failure runs the step again after the runner's delay", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1
      ? { reply: () => { throw new ProviderError("anthropic", "rate_limit", "scripted rate_limit"); } }
      : {});
    await start(w);
    await drain(w);
    const r = await rows(w);
    const [blueprint] = ofType(r, "crew_blueprint");
    expect(blueprint).toMatchObject({ status: "succeeded" });
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_blueprint", "crew_brand_kit", "crew_email_sequence"]);
    expect(r.runs.filter((run) => run.taskId === blueprint?._id).map((run) => run.status).sort()).toEqual(["failed", "succeeded"]);
    // Again after the runner's own backoff (not the lease): the gap is the delay the runner handed back.
    const retry = hooks.outcomes[0];
    if (retry?.kind !== "retry") throw new Error(`expected a retry, got ${JSON.stringify(retry)}`);
    expect(retry.scheduled).toBe(false);
    const [first, second] = hooks.calls;
    expect((second?.at ?? 0) - (first?.at ?? 0)).toBeGreaterThanOrEqual(retry.delayMs);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("in_flight: a step another execution still holds runs again after RUN_LEASE_MS", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1 ? { outcome: { kind: "skipped", reason: "in_flight" } } : {});
    await start(w);
    await drain(w);
    const r = await rows(w);
    expect(ofType(r, "crew_blueprint")[0]).toMatchObject({ status: "succeeded" });
    const [first, second] = hooks.calls;
    expect(second?.type).toBe("crew_blueprint");
    expect((second?.at ?? 0) - (first?.at ?? 0)).toBeGreaterThanOrEqual(RUN_LEASE_MS);
    expect(ofType(r, "crew_brand_kit")[0]).toMatchObject({ status: "succeeded" });
  });

  test("action failure: an action that died mid-run runs again after RUN_LEASE_MS, closing the abandoned run", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1 ? { die: true } : {});
    await start(w);
    await drain(w);
    const r = await rows(w);
    const [blueprint] = ofType(r, "crew_blueprint");
    expect(blueprint).toMatchObject({ status: "succeeded" });
    const [first, second] = hooks.calls;
    expect((second?.at ?? 0) - (first?.at ?? 0)).toBeGreaterThanOrEqual(RUN_LEASE_MS);
    const runs = r.runs.filter((run) => run.taskId === blueprint?._id).sort((a, b) => a._creationTime - b._creationTime);
    expect(runs.map((run) => [run.status, run.errorCode])).toEqual([["failed", "indeterminate"], ["succeeded", undefined]]);
    expect(ofType(r, "crew_brand_kit")[0]).toMatchObject({ status: "succeeded" });
  });

  test("an action that keeps dying fails the step as interrupted after three tries; its children never start", async () => {
    const w = await world();
    hooks.plan = ({ type }) => (type === "crew_blueprint" ? { die: true } : {});
    await start(w);
    await drain(w);
    const r = await rows(w);
    expect(ofType(r, "crew_blueprint")[0]).toMatchObject({ status: "failed" });
    expect(hooks.calls.filter((call) => call.type === "crew_blueprint")).toHaveLength(3);
    expect(r.steps.filter((row) => row.type === "crew_blueprint")).toEqual([expect.objectContaining({ status: "failed" })]);
    expect(r.runs.filter((run) => run.status === "running")).toHaveLength(0);
    expect(ofType(r, "crew_brand_kit")).toHaveLength(0);
    expect(await as(w).query(api.crew.roster.launchStatus, { projectId: w.projectIds[0] as Id<"projects"> }))
      .toEqual({ state: "failed", paused: false, retryable: true });
  });

  test("recovery got there first: a step whose task recoverStaleCrewRuns already failed settles as failed", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => {
      if (type !== "crew_blueprint") return {};
      if (n === 1) return { die: true };
      // The re-invoke after the lease: the cron's recovery runs first and fails the task as interrupted.
      return { prelude: async () => void (await w.t.mutation(internal.crew.jobs.recoverStaleCrewRuns, {})) };
    };
    await start(w);
    await drain(w);
    const r = await rows(w);
    expect(ofType(r, "crew_blueprint")[0]).toMatchObject({ status: "failed" });
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_blueprint"]);
    expect(r.steps.filter((row) => row.type === "crew_blueprint")).toEqual([expect.objectContaining({ status: "failed" })]);
    expect(inFlight(r)).toBe(0);
    expect(ofType(r, "crew_brand_kit")).toHaveLength(0);
  });
});

describe("WP75-S2b refusals", () => {
  test("resumeLaunch and launchProgress refuse a signed-out caller, the workspace off, AI off; resumeLaunch refuses before a launch", async () => {
    const w = await world();
    const projectId = w.projectIds[0] as Id<"projects">;
    await expect(as(w).mutation(api.crew.launch.resumeLaunch, { projectId })).rejects.toThrow("LAUNCH_NOT_STARTED");
    expect(await progress(w)).toEqual({ started: false, retryable: false, steps: [] });
    await expect(w.t.mutation(api.crew.launch.resumeLaunch, { projectId })).rejects.toThrow();
    await expect(w.t.query(api.crew.launch.launchProgress, { projectId })).rejects.toThrow();
    await setAi(w, false);
    await expect(as(w).mutation(api.crew.launch.resumeLaunch, { projectId })).rejects.toThrow("AI_DISABLED");
    await expect(progress(w)).rejects.toThrow("AI_DISABLED");
    await w.t.run(async (ctx) => await ctx.db.patch("ops_settings", w.opsId, { workspaceEnabled: false }));
    await expect(as(w).mutation(api.crew.launch.resumeLaunch, { projectId })).rejects.toThrow();
    expect(await tokensSpent(w)).toBe(0);
  });

  test("another owner's business: resumeLaunch and launchProgress refuse", async () => {
    const w = await world();
    const other = await w.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "other@example.test", emailVerificationTime: 1 });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
      return { userId, sessionId };
    });
    const stranger = w.t.withIdentity({ subject: `${other.userId}|${other.sessionId}`, issuer: "https://local.test" });
    const projectId = w.projectIds[0] as Id<"projects">;
    await start(w);
    await expect(stranger.mutation(api.crew.launch.resumeLaunch, { projectId })).rejects.toThrow();
    await expect(stranger.query(api.crew.launch.launchProgress, { projectId })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// S2b review fixes
// ---------------------------------------------------------------------------

const retry = async (w: World, projectId = w.projectIds[0] as Id<"projects">) =>
  await as(w).mutation(api.crew.roster.retryLaunch, { projectId });

const resume = async (w: World, projectId = w.projectIds[0] as Id<"projects">) =>
  await as(w).mutation(api.crew.launch.resumeLaunch, { projectId });

/** Draining may move the fake clock past the limiter's hour: count the next action in a fresh window. */
async function freshTokens(w: World): Promise<void> {
  await w.t.run(async (ctx) => await crewJobLimiter.reset(ctx, "crewJob", { key: w.owner.userId }));
}

/** The first brand-kit call is refused, so the kit fails after the roster is written. */
const kitFailsOnce: PlanFor = ({ type }) =>
  type === "crew_brand_kit" && hooks.calls.filter((call) => call.type === "crew_brand_kit").length === 1
    ? { reply: () => ({ refusal: { category: "cyber" } }) }
    : {};

/** The launch's blueprint document and its newest review card. */
async function blueprintCard(w: World): Promise<{ document: Doc<"documents">; card: Doc<"approvals"> }> {
  return await w.t.run(async (ctx) => {
    const document = (await ctx.db.query("documents").collect()).find((row) => row.kind === "blueprint");
    if (document === undefined) throw new Error("no blueprint document");
    const cards = (await ctx.db.query("approvals").collect()).filter((row) => row.subjectId === document._id);
    const card = cards.sort((a, b) => b._creationTime - a._creationTime)[0];
    if (card === undefined) throw new Error("no blueprint card");
    return { document, card };
  });
}

describe("WP75-S2b review M1: Try again after the roster", () => {
  test("a failed brand kit is retried once for one token and runs; a second click spends nothing", async () => {
    const w = await world();
    hooks.plan = kitFailsOnce;
    await start(w);
    await drain(w);
    let r = await rows(w);
    expect(ofType(r, "crew_brand_kit")).toEqual([expect.objectContaining({ status: "failed" })]);
    let view = await progress(w);
    expect(view.retryable).toBe(true);
    expect(view.steps.find((step) => step.key === "brand_kit")).toMatchObject({ state: "failed", retryable: true, reason: STEP_FAILED_REASON });

    await freshTokens(w);
    await retry(w);
    expect(await tokensSpent(w)).toBe(1);
    await drain(w);
    r = await rows(w);
    expect(ofType(r, "crew_brand_kit").map((row) => row.status).sort()).toEqual(["failed", "succeeded"]);
    // The email sequence waits under the failed kit and runs once the retried kit succeeds.
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_brand_kit", "crew_brand_kit", "crew_email_sequence"]);
    // A new first draft on the same key, with its own marker.
    const kits = ofType(r, "crew_brand_kit");
    expect(new Set(kits.map((row) => row.jobKey)).size).toBe(1);
    expect(new Set(kits.map((row) => row.idempotencyKey)).size).toBe(2);
    expect(r.steps.filter((row) => row.type === "crew_brand_kit").map((row) => row.status).sort()).toEqual(["failed", "succeeded"]);
    view = await progress(w);
    expect(view.retryable).toBe(false);
    expect(view.steps.find((step) => step.key === "brand_kit")).toMatchObject({ state: "succeeded" });

    // Nothing failed any more: another click writes and spends nothing.
    await freshTokens(w);
    const before = await rows(w);
    await retry(w);
    expect(await tokensSpent(w)).toBe(0);
    expect((await rows(w)).tasks).toEqual(before.tasks);
  });

  test("a blueprint with changes requested, or changed since its card: the kit is not retryable, says why, and spends nothing", async () => {
    const w = await world();
    hooks.plan = kitFailsOnce;
    await start(w);
    await drain(w);
    const { document, card } = await blueprintCard(w);

    for (const change of ["changes_requested", "edited"] as const) {
      await w.t.run(async (ctx) => {
        if (change === "changes_requested") await ctx.db.patch("approvals", card._id, { status: "changes_requested" });
        else {
          await ctx.db.patch("approvals", card._id, { status: card.status });
          await ctx.db.patch("documents", document._id, { updatedAt: card.createdAt + 1 });
        }
      });
      const view = await progress(w);
      expect(view.retryable).toBe(false);
      expect(view.steps.find((step) => step.key === "brand_kit")).toMatchObject({ state: "failed", retryable: false, reason: BRIEF_CHANGED_REASON });
      await freshTokens(w);
      const before = await rows(w);
      await retry(w);
      expect(await tokensSpent(w)).toBe(0);
      expect((await rows(w)).tasks).toEqual(before.tasks);
    }
    expect(hooks.calls.filter((call) => call.type === "crew_brand_kit")).toHaveLength(1);
  });

  test("a retry while the step is queued on the pool, or running, does nothing", async () => {
    const w = await world();
    const seen: { tasks: number; same: boolean }[] = [];
    const click = async () => {
      const state = await limiterState(w);
      const count = (await rows(w)).tasks.length;
      await retry(w);
      seen.push({ tasks: (await rows(w)).tasks.length - count, same: JSON.stringify(await limiterState(w)) === JSON.stringify(state) });
    };
    // `prelude`: the kit is queued with its marker running; `before`: its run is open and the task running.
    hooks.plan = ({ type }) => (type === "crew_brand_kit" ? { prelude: click, before: click } : {});
    await start(w);
    await drain(w);
    expect(seen).toEqual([{ tasks: 0, same: true }, { tasks: 0, same: true }]);
    const r = await rows(w);
    expect(ofType(r, "crew_brand_kit")).toEqual([expect.objectContaining({ status: "succeeded" })]);
    expect(hooks.calls.filter((call) => call.type === "crew_brand_kit")).toHaveLength(1);
  });
});

describe("WP75-S2b review minor 1: an action that dies before it opens a run", () => {
  test("three times: the task and its marker fail, the interrupted note shows, and nothing is refunded (unpaid)", async () => {
    const w = await world();
    hooks.plan = ({ type }) => (type === "crew_brand_kit" ? { dieEarly: true } : {});
    await start(w);
    await drain(w);
    const r = await rows(w);
    const [kit] = ofType(r, "crew_brand_kit");
    expect(kit).toMatchObject({ status: "failed", creditCost: 0n });
    // The abandon threshold, exactly: three calls, then no more.
    expect(hooks.calls.filter((call) => call.type === "crew_brand_kit")).toHaveLength(3);
    expect(r.steps.filter((row) => row.taskId === kit?._id)).toEqual([expect.objectContaining({ status: "failed" })]);
    expect(r.runs.filter((run) => run.taskId === kit?._id)).toHaveLength(0);
    const note = await w.t.run(async (ctx) => {
      const member = (await ctx.db.query("crew_members").collect()).find((row) => row.roleKey === "brand");
      if (member === undefined) return null;
      return (await ctx.db.query("workstreams").collect()).find((row) => row.employeeId === member._id) ?? null;
    });
    expect(note).toMatchObject({ status: "failed", blocker: FAILED_STEP_INTERRUPTED_REASON });
    expect(await w.t.run(async (ctx) => (await ctx.db.query("credit_ledger").collect()).filter((row) => row.reason === "task_refund"))).toEqual([]);
    expect(await w.t.run(async (ctx) => (await ctx.db.query("credit_ledger").collect()).length)).toBe(0);
    // The founder can try it again.
    expect((await progress(w)).steps.find((step) => step.key === "brand_kit")).toMatchObject({ state: "failed", retryable: true });
  });
});

describe("WP75-S2b review minor 2: the hired filter and the paused-launch skip", () => {
  test("ensureLaunchStepTasks inserts only hired employees' steps, once", async () => {
    const w = await world();
    const projectId = w.projectIds[0] as Id<"projects">;
    const counts = await w.t.run(async (ctx) => {
      const project = await ctx.db.get("projects", projectId);
      if (project === null) throw new Error("no project");
      const lead = await ensureLaunchStepTasks(ctx, project, new Set(["lead"]));
      const brand = await ensureLaunchStepTasks(ctx, project, new Set(["lead", "brand"]));
      const again = await ensureLaunchStepTasks(ctx, project, new Set(["lead", "brand"]));
      return { lead, brand, again };
    });
    expect(counts).toEqual({ lead: 0, brand: 1, again: 0 });
    expect(ofType(await rows(w), "crew_brand_kit")).toEqual([expect.objectContaining({ status: "queued", employeeKey: "brand" })]);
  });

  test("advanceOwner skips a launch with a paused step, then carries on once nothing is paused", async () => {
    const w = await world();
    await start(w);
    await drain(w);
    const steps = LAUNCH_STEPS as unknown as LaunchStep[];
    const index = launchStepPosition("build_pack");
    const original = steps[index] as LaunchStep;
    steps[index] = { ...original, status: "built", runner: "generator", parents: ["roster"] };
    try {
      const [kit] = ofType(await rows(w), "crew_brand_kit");
      if (kit === undefined) throw new Error("no kit");
      await w.t.run(async (ctx) => await ctx.db.patch("tasks", kit._id, { status: "blocked" }));
      await w.t.mutation(internal.crew.launch.advanceAfterRevision, { ownerId: w.owner.userId });
      let r = await rows(w);
      const [pack] = ofType(r, "crew_build_pack");
      expect(pack).toMatchObject({ status: "queued", employeeKey: "engineering" });
      expect(r.steps.filter((row) => row.taskId === pack?._id)).toHaveLength(0);

      await w.t.run(async (ctx) => await ctx.db.patch("tasks", kit._id, { status: "succeeded" }));
      await w.t.mutation(internal.crew.launch.advanceAfterRevision, { ownerId: w.owner.userId });
      r = await rows(w);
      expect(r.steps.filter((row) => row.taskId === pack?._id)).toEqual([expect.objectContaining({ status: "running" })]);
    } finally {
      steps[index] = original;
    }
  });
});

describe("WP75-S2b review minor 3: revisions free their slot", () => {
  test("a revision that leaves running fills the slot it held", async () => {
    const w = await world(2);
    const [first, second] = w.projectIds as [Id<"projects">, Id<"projects">];
    await start(w, first);
    await drain(w);
    const [kit] = ofType(await rows(w), "crew_brand_kit", first);
    if (kit === undefined) throw new Error("no kit");
    // Three running revisions fill the owner's cap.
    const revisions = await w.t.run(async (ctx) => {
      const ids: Id<"tasks">[] = [];
      for (let i = 0; i < OWNER_CREW_CAP; i += 1) {
        ids.push(await ctx.db.insert("tasks", {
          ownerId: kit.ownerId, projectId: kit.projectId, type: "crew_brand_kit", status: "running", title: "Revision",
          employeeKey: "brand", changeRound: 1n, revisionOfTaskId: kit._id, idempotencyKey: `revision-${i}`, createdAt: 1, updatedAt: 1,
        }));
      }
      return ids;
    });
    await start(w, second);
    let r = await rows(w);
    const [waiting] = ofType(r, "crew_blueprint", second);
    expect(waiting).toMatchObject({ status: "queued" });
    expect(r.steps.filter((row) => row.taskId === waiting?._id)).toHaveLength(0);

    await w.t.run(async (ctx) => void (await abandonCrewTask(ctx, revisions[0] as Id<"tasks">, Date.now())));
    await drain(w);
    r = await rows(w);
    expect(ofType(r, "crew_blueprint", second)).toEqual([expect.objectContaining({ status: "succeeded" })]);
  });
});

describe("WP75-S2b review minor 5: the cap is full", () => {
  test("resumeLaunch says it is waiting for a free slot and spends nothing; launchProgress shows it paused, not failed", async () => {
    const w = await world(4);
    const [first, ...others] = w.projectIds as Id<"projects">[];
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1 ? { before: async () => await setAi(w, false) } : {});
    await start(w, first);
    await drain(w);
    await setAi(w, true);
    hooks.plan = () => ({});
    for (const projectId of others) await start(w, projectId);
    expect(inFlight(await rows(w))).toBe(OWNER_CREW_CAP);

    await freshTokens(w);
    expect(await resume(w, first)).toEqual({ resumed: 0, paused: 1, waitingForSlot: true });
    expect(await tokensSpent(w)).toBe(0);
    expect((await progress(w, first)).steps[0]).toMatchObject({ key: "blueprint", state: "paused" });
    // Try again resumes a paused blueprint, so progress offers it as launchStatus does.
    expect((await progress(w, first)).retryable).toBe(true);
    expect(await as(w).query(api.crew.roster.launchStatus, { projectId: first })).toMatchObject({ paused: true, retryable: true });
  });

  test("a retry while the cap is full inserts the step, which reads waiting for a free slot, and runs once a slot frees", async () => {
    const w = await world(4);
    const [first, ...others] = w.projectIds as Id<"projects">[];
    hooks.plan = kitFailsOnce;
    await start(w, first);
    await drain(w);
    for (const projectId of others) await start(w, projectId);
    expect(inFlight(await rows(w))).toBe(OWNER_CREW_CAP);

    await freshTokens(w);
    await retry(w, first);
    expect(await tokensSpent(w)).toBe(1);
    const kit = (await progress(w, first)).steps.find((step) => step.key === "brand_kit");
    expect(kit).toMatchObject({ state: "queued", reason: WAITING_FOR_SLOT_REASON });
    expect(kit?.retryable).toBeUndefined();

    await drain(w);
    expect(ofType(await rows(w), "crew_brand_kit", first).map((row) => row.status).sort()).toEqual(["failed", "succeeded"]);
  });
});

describe("WP75-S2b review nits", () => {
  test("resumeLaunch and launchProgress refuse an archived business", async () => {
    const w = await world();
    const projectId = w.projectIds[0] as Id<"projects">;
    await start(w);
    await w.t.run(async (ctx) => await ctx.db.patch("projects", projectId, { archivedAt: 5 }));
    await expect(resume(w)).rejects.toThrow();
    await expect(progress(w)).rejects.toThrow();
  });

  test("an archived task's marker settles, and an archived task never counts toward the cap", async () => {
    const w = await world(2);
    const [first, second] = w.projectIds as [Id<"projects">, Id<"projects">];
    let archivedId: Id<"tasks"> | null = null;
    hooks.plan = ({ type, taskId }) => (type === "crew_brand_kit" && archivedId === null
      ? { prelude: async () => {
        archivedId = taskId as Id<"tasks">;
        await w.t.run(async (ctx) => await ctx.db.patch("tasks", taskId as Id<"tasks">, { archivedAt: 5 }));
      }, outcome: { kind: "skipped", reason: "in_flight" } }
      : {});
    await start(w, first);
    await drain(w);
    const r = await rows(w);
    expect(r.steps.filter((row) => row.taskId === archivedId)).toEqual([expect.objectContaining({ status: "failed" })]);
    expect(inFlight({ ...r, tasks: r.tasks.filter((row) => row.archivedAt === undefined) })).toBe(0);
    await start(w, second);
    await drain(w);
    expect(ofType(await rows(w), "crew_blueprint", second)).toEqual([expect.objectContaining({ status: "succeeded" })]);
  });
});

describe("WP75-S2b review (Codex P2): launchProgress and launchStatus agree before the team exists", () => {
  const status = async (w: World) =>
    await as(w).query(api.crew.roster.launchStatus, { projectId: w.projectIds[0] as Id<"projects"> });

  test("a failed first blueprint is retryable in both while the answers are usable, and in neither once they are not", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1 ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
    await start(w);
    await drain(w);

    expect(await status(w)).toEqual({ state: "failed", paused: false, retryable: true });
    const usable = await progress(w);
    expect(usable.retryable).toBe(true);
    expect(usable.steps[0]).toMatchObject({ key: "blueprint", state: "failed", retryable: true, reason: STEP_FAILED_REASON });

    const sessionId = await w.t.run(async (ctx) =>
      (await ctx.db.get("projects", w.projectIds[0] as Id<"projects">))?.workspace?.wizardSessionId);
    if (sessionId === undefined) throw new Error("no wizard session");
    await w.t.run(async (ctx) => await ctx.db.patch("wizard_sessions", sessionId, { answers: {} }));

    expect(await status(w)).toEqual({ state: "failed", paused: false, retryable: false });
    const unusable = await progress(w);
    expect(unusable.retryable).toBe(false);
    expect(unusable.steps[0]).toMatchObject({ key: "blueprint", state: "failed", retryable: false, reason: LAUNCH_STUCK_REASON });
  });

  test("a succeeded blueprint with no team: the roster step reads failed, retryable only while the team plans", async () => {
    const w = await world();
    await start(w);
    await drain(w);
    const r = await rows(w);
    const roster = ofType(r, "crew_roster")[0];
    const blueprintTask = ofType(r, "crew_blueprint")[0];
    const blueprintDoc = r.documents.find((row) => row.taskId === blueprintTask?._id);
    const teamDoc = r.documents.find((row) => row.taskId === roster?._id);
    if (roster === undefined || blueprintDoc === undefined || teamDoc === undefined) throw new Error("launch did not finish");
    // The team never got stored: the roster task is still open and has no document.
    await w.t.run(async (ctx) => {
      await ctx.db.patch("tasks", roster._id, { status: "queued" });
      await ctx.db.delete("documents", teamDoc._id);
    });

    expect(await status(w)).toEqual({ state: "failed", paused: false, retryable: true });
    const plans = await progress(w);
    expect(plans.retryable).toBe(true);
    expect(plans.steps.find((step) => step.key === "roster"))
      .toMatchObject({ state: "failed", retryable: true, reason: STEP_FAILED_REASON });

    await w.t.run(async (ctx) => await ctx.db.patch("documents", blueprintDoc._id, { body: "not a blueprint" }));
    expect(await status(w)).toEqual({ state: "failed", paused: false, retryable: false });
    const stuck = await progress(w);
    expect(stuck.retryable).toBe(false);
    expect(stuck.steps.find((step) => step.key === "roster"))
      .toMatchObject({ state: "failed", retryable: false, reason: LAUNCH_STUCK_REASON });
  });
});
