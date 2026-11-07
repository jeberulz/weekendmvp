/// <reference types="vite/client" />
/**
 * L1 launch sweep (WP75 Needs from Codex 18): `internal.crew.launch.recoverStalledLaunches`
 * in convex-test, with `@convex-dev/workpool/test` registered. Fixture mode with the REAL
 * registry, C-METER, ledger, approvals and limiter; no provider is ever called.
 *
 * "The work is gone" is simulated by dropping a `crewWorkpool.enqueueAction` call (the
 * marker is written, no work exists), or produced for real by making `stepDone`'s re-enqueue
 * throw; "the work is only late" by leaving enqueued work pending on the fake clock while
 * the sweep runs. `sweep` runs one page and then the owner jobs it scheduled, directly.
 */
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import type { WorkId } from "@convex-dev/workpool";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { hydrotrailWizardAnswers } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import type { AnthropicFixtureReply } from "../ai/providers/fixtures";
import { ProviderError } from "../ai/providers/types";
import { RUN_LEASE_MS } from "./jobs";
import {
  LAUNCH_SWEEP_PAGE_MAX,
  LAUNCH_SWEEP_REQUEUES_MAX,
  LEFTOVER_MARKER_MS,
  OWNER_CREW_CAP,
  STRANDED_MARKER_MS,
} from "./launch";
import type { CrewStepOutcome } from "./runner";
import { crewWorkpool } from "./workpool";

type Plan = {
  /** Runs just before the gateway call. */
  readonly before?: () => Promise<void>;
  /** The fixture reply for this call's gateway run (throw a `ProviderError` for a provider failure). */
  readonly reply?: () => AnthropicFixtureReply | undefined;
};

const hooks = vi.hoisted(() => ({
  plan: (() => ({})) as (call: { type: string; n: number }) => Plan,
  calls: [] as { taskId: string; type: string; markerId: string | undefined }[],
  outcomes: [] as CrewStepOutcome[],
  readType: (async () => "unknown") as (taskId: string) => Promise<string>,
}));

vi.mock("./generators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./generators")>();
  const { internalAction } = await import("../_generated/server");
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
        hooks.calls.push({ taskId: args.taskId, type, markerId: args.markerId });
        const plan = hooks.plan({ type, n: hooks.calls.length });
        const adapter = createAnthropicAdapter({ env: {}, fixtureResponder: () => plan.reply?.() });
        const outcome = await actual.runCrewGeneratorStepWith(ctx, args, {
          runPrompt: async (promptArgs) => {
            await plan.before?.();
            return await runPromptWithMeter(ctx, promptArgs, { adapter });
          },
        });
        hooks.outcomes.push(outcome);
        return outcome;
      },
    }),
  };
});

/** Each module loads once, so every pool call stays on the mocked `./generators` (see `launch.test.ts`). */
function onceEach(glob: Record<string, () => Promise<unknown>>): Record<string, () => Promise<unknown>> {
  return Object.fromEntries(Object.entries(glob).map(([key, load]) => {
    let loaded: Promise<unknown> | null = null;
    return [key, () => (loaded ??= load())];
  }));
}

const modules = onceEach(import.meta.glob("/convex/**/*.ts"));

type T = TestConvex<typeof schema>;

/** Every `crewWorkpool.enqueueAction` call; `drop` loses the work (the marker stays), `fail` throws. */
const pool = {
  log: [] as { taskId: string; markerId: string | undefined; dropped: boolean }[],
  drop: (() => false) as (taskId: string) => boolean,
  fail: (() => false) as (taskId: string) => boolean,
};

beforeEach(() => {
  vi.useFakeTimers();
  hooks.plan = () => ({});
  hooks.calls = [];
  hooks.outcomes = [];
  pool.log = [];
  pool.drop = () => false;
  pool.fail = () => false;
  const real = crewWorkpool.enqueueAction.bind(crewWorkpool);
  vi.spyOn(crewWorkpool, "enqueueAction").mockImplementation((async (ctx, fn, fnArgs, options) => {
    const { taskId, markerId } = fnArgs as unknown as { taskId: string; markerId?: string };
    if (pool.fail(taskId)) throw new Error("scripted enqueue failure");
    const dropped = pool.drop(taskId);
    pool.log.push({ taskId, markerId, dropped });
    if (dropped) return "lost-work" as WorkId;
    return await real(ctx, fn, fnArgs, options);
  }) as typeof crewWorkpool.enqueueAction);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type Person = { readonly userId: Id<"users">; readonly sessionId: Id<"authSessions"> };
type World = {
  readonly t: T;
  readonly owners: Person[];
  readonly opsId: Id<"ops_settings">;
  /** `projectIds[o][b]`: owner o's business b. */
  readonly projectIds: Id<"projects">[][];
};

async function world(owners = 1, businesses = 1): Promise<World> {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  registerWorkpool(t, "crewWorkpool");
  hooks.readType = async (taskId) =>
    (await t.run(async (ctx) => await ctx.db.get("tasks", taskId as Id<"tasks">)))?.type ?? "missing";
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true }, updatedAt: 1,
    });
    const people: Person[] = [];
    const projectIds: Id<"projects">[][] = [];
    for (let o = 0; o < owners; o += 1) {
      const userId = await ctx.db.insert("users", { email: `owner${o}@example.test`, emailVerificationTime: 1 });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
      people.push({ userId, sessionId });
      const own: Id<"projects">[] = [];
      for (let b = 0; b < businesses; b += 1) {
        const slug = `hydrotrail-${o}-${b}`;
        const wizardSessionId = await ctx.db.insert("wizard_sessions", {
          ownerId: userId, ideaSlug: "hydrotrail", step: "partner_name", answers: hydrotrailWizardAnswers,
          startedAt: 1, updatedAt: 1, completedAt: 2,
        });
        const projectId = await ctx.db.insert("projects", {
          ownerId: userId, source: "repository_idea", title: "HydroTrail", status: "draft", idempotencyKey: `business:${slug}`,
          workspace: {
            version: 1, name: "HydroTrail", slug, ideaSlug: "hydrotrail", platform: "web", commercialModel: "free", goal: "waitlist",
            partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
          },
          createdAt: 1 + b, updatedAt: 1 + b,
        });
        await ctx.db.patch("wizard_sessions", wizardSessionId, { projectId });
        own.push(projectId);
      }
      projectIds.push(own);
    }
    return { owners: people, opsId, projectIds };
  });
  return { t, ...ids };
}

const person = (w: World, o: number): Person => {
  const found = w.owners[o];
  if (found === undefined) throw new Error(`no owner ${o}`);
  return found;
};

const project = (w: World, o = 0, b = 0): Id<"projects"> => {
  const found = w.projectIds[o]?.[b];
  if (found === undefined) throw new Error(`no business ${o}/${b}`);
  return found;
};

const as = (w: World, o: number) => {
  const { userId, sessionId } = person(w, o);
  return w.t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
};

const start = async (w: World, o = 0, b = 0) => await as(w, o).mutation(api.crew.roster.startLaunch, { projectId: project(w, o, b) });

type SweepTotals = {
  businesses: number;
  owners: number;
  isDone: boolean;
  gatedOwners: number;
  /** Owner jobs that threw (each rolls back alone; in production a failed scheduled function). */
  failedOwners: number;
  requeued: number;
  reinvoked: number;
  abandoned: number;
  settled: number;
  enqueued: number;
  /** Owner jobs whose `advanceOwner` subtransaction threw. */
  advanceFailed: number;
};

/** Pending scheduled jobs whose name includes `name`, cancelled, with their args. */
async function takeScheduled<A>(w: World, name: string): Promise<A[]> {
  return await w.t.run(async (ctx) => {
    const pending = (await ctx.db.system.query("_scheduled_functions").collect())
      .filter((job) => job.state.kind === "pending" && job.name.includes(name));
    for (const job of pending) await ctx.scheduler.cancel(job._id);
    return pending.map((job) => job.args[0] as A);
  });
}

/**
 * One sweep page, then the `recoverStalledOwner` jobs it scheduled, run here one by one (and cancelled on the
 * scheduler, so a later drain does not run them again). A continuation page stays scheduled.
 */
async function sweep(w: World, args: { cursor?: string | null; limit?: number } = {}): Promise<SweepTotals> {
  const page = await w.t.mutation(internal.crew.launch.recoverStalledLaunches, args);
  const totals: SweepTotals = {
    ...page, gatedOwners: 0, failedOwners: 0, requeued: 0, reinvoked: 0, abandoned: 0, settled: 0, enqueued: 0, advanceFailed: 0,
  };
  for (const job of await takeScheduled<{ ownerId: Id<"users"> }>(w, "recoverStalledOwner")) {
    try {
      const out = await w.t.mutation(internal.crew.launch.recoverStalledOwner, job);
      if (out.gated) totals.gatedOwners += 1;
      if (out.advanceFailed) totals.advanceFailed += 1;
      totals.requeued += out.requeued;
      totals.reinvoked += out.reinvoked;
      totals.abandoned += out.abandoned;
      totals.settled += out.settled;
      totals.enqueued += out.enqueued;
    } catch {
      totals.failedOwners += 1;
    }
  }
  return totals;
}

const drain = async (w: World) => await w.t.finishAllScheduledFunctions(vi.runAllTimers);

/** Moves the clock without running anything scheduled. */
const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

const crewJobLimiter = new RateLimiter(components.rateLimiter, { crewJob: { kind: "fixed window", rate: 10, period: HOUR } });

const limiterState = async (w: World, o = 0) =>
  await w.t.run(async (ctx) => await crewJobLimiter.getValue(ctx, "crewJob", { key: person(w, o).userId }));

type Rows = {
  tasks: Doc<"tasks">[];
  steps: Doc<"task_steps">[];
  runs: Doc<"workflow_runs">[];
  documents: Doc<"documents">[];
  usage: Doc<"ai_usage">[];
  ledger: Doc<"credit_ledger">[];
};

async function rows(w: World): Promise<Rows> {
  return await w.t.run(async (ctx) => ({
    tasks: await ctx.db.query("tasks").collect(),
    steps: await ctx.db.query("task_steps").collect(),
    runs: await ctx.db.query("workflow_runs").collect(),
    documents: await ctx.db.query("documents").collect(),
    usage: await ctx.db.query("ai_usage").collect(),
    ledger: await ctx.db.query("credit_ledger").collect(),
  }));
}

const ofType = (r: Rows, type: Doc<"tasks">["type"], projectId?: Id<"projects">) =>
  r.tasks.filter((row) => row.type === type && (projectId === undefined || row.projectId === projectId));

const markersOf = (r: Rows, taskId: Id<"tasks"> | undefined) =>
  r.steps.filter((row) => row.taskId === taskId).sort((a, b) => a._creationTime - b._creationTime).map((row) => row.status);

function only<V>(values: readonly V[]): V {
  if (values.length !== 1) throw new Error(`expected one row, got ${values.length}`);
  return values[0] as V;
}

/** Crew tasks in flight: running, or queued with a running marker. */
function inFlight(r: Rows): number {
  const onPool = new Set(r.steps.filter((row) => row.status === "running").map((row) => row.taskId));
  return r.tasks.filter((row) => row.type !== "crew_roster" && row.archivedAt === undefined &&
    (row.status === "running" || (row.status === "queued" && onPool.has(row._id)))).length;
}

async function setOps(w: World, patch: { ai?: boolean; workspace?: boolean; cohort?: "open" | "allowlist" }): Promise<void> {
  await w.t.run(async (ctx) => {
    const ops = await ctx.db.get("ops_settings", w.opsId);
    if (ops === null) throw new Error("no ops");
    await ctx.db.patch("ops_settings", w.opsId, {
      ...(patch.ai === undefined ? {} : { killSwitches: { ...ops.killSwitches, ai: !patch.ai } }),
      ...(patch.workspace === undefined ? {} : { workspaceEnabled: patch.workspace }),
      ...(patch.cohort === undefined ? {} : { cohortMode: patch.cohort }),
    });
  });
}

const LAUNCH_CALLS = ["crew_blueprint", "crew_brand_kit", "crew_email_sequence", "crew_social_pack"];

/** The whole launch finished, every step once: one run and one document per step, no ledger rows. */
function expectLaunchDone(r: Rows, projectId: Id<"projects">): void {
  for (const type of ["crew_blueprint", "crew_roster", "crew_brand_kit", "crew_email_sequence", "crew_social_pack"] as const) {
    expect(ofType(r, type, projectId)).toEqual([expect.objectContaining({ status: "succeeded" })]);
  }
  for (const type of ["crew_blueprint", "crew_brand_kit", "crew_email_sequence", "crew_social_pack"] as const) {
    const task = only(ofType(r, type, projectId));
    expect(r.runs.filter((run) => run.taskId === task._id)).toEqual([expect.objectContaining({ status: "succeeded" })]);
  }
  expect(r.documents.filter((doc) => doc.projectId === projectId).map((doc) => doc.kind).sort())
    .toEqual(["blueprint", "brand_kit", "email_sequence", "roster_plan", "social_pack"]);
  expect(r.ledger).toEqual([]);
}

/**
 * The blueprint as `settleCrewRun` leaves it in return mode after a retryable failure: task `running`, its run
 * closed `failed` with the retry class, the marker `running`, and no work on the pool (the re-invoke never came).
 * One closed run per error code, oldest first.
 */
async function betweenExecutions(
  w: World,
  errorCodes: readonly string[] = ["retryable_unbilled"],
  o = 0,
  b = 0,
): Promise<Doc<"tasks">> {
  pool.drop = () => true;
  await start(w, o, b);
  pool.drop = () => false;
  const blueprint = only(ofType(await rows(w), "crew_blueprint", project(w, o, b)));
  await w.t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.patch("tasks", blueprint._id, { status: "running", updatedAt: now });
    for (const [i, errorCode] of errorCodes.entries()) {
      await ctx.db.insert("workflow_runs", {
        ownerId: blueprint.ownerId, projectId: blueprint.projectId, taskId: blueprint._id, type: "crew_blueprint",
        status: "failed", errorCode, idempotencyKey: `run:${blueprint._id}:${i + 1}`, attempt: BigInt(2 * i + 1),
        createdAt: now, updatedAt: now, startedAt: now, completedAt: now,
      });
    }
  });
  return blueprint;
}

// ---------------------------------------------------------------------------

describe("L1 launch sweep: a stranded marker", () => {
  test("lost work past the threshold is requeued once, the launch completes, and nothing is duplicated", async () => {
    // A clean launch, for the metering rows one launch writes.
    const clean = await world();
    await start(clean);
    await drain(clean);
    const cleanUsage = (await rows(clean)).usage.length;
    expect(cleanUsage).toBeGreaterThan(0);
    pool.log = [];
    hooks.calls = [];

    const w = await world();
    pool.drop = () => pool.log.length === 0;
    await start(w);
    const atStart = await limiterState(w);
    let r = await rows(w);
    const blueprint = only(ofType(r, "crew_blueprint"));
    expect(blueprint.status).toBe("queued");
    expect(markersOf(r, blueprint._id)).toEqual(["running"]);
    expect(pool.log).toEqual([expect.objectContaining({ dropped: true })]);

    // Within the lease, and past it but under the threshold: untouched.
    for (const step of [0, RUN_LEASE_MS + 1]) {
      later(step);
      expect(await sweep(w)).toMatchObject({ owners: 1, requeued: 0, abandoned: 0, enqueued: 0, isDone: true });
      expect((await rows(w)).steps).toEqual(r.steps);
    }
    expect(pool.log).toHaveLength(1);

    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ owners: 1, gatedOwners: 0, failedOwners: 0, requeued: 1, abandoned: 0, enqueued: 1 });
    r = await rows(w);
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "running"]);
    expect(only(ofType(r, "crew_blueprint")).status).toBe("queued");
    expect(pool.log).toHaveLength(2);
    // The new work runs under the new marker.
    const fresh = r.steps.find((row) => row.taskId === blueprint._id && row.status === "running");
    expect(pool.log[1]).toEqual({ taskId: blueprint._id, markerId: fresh?._id, dropped: false });

    // A second sweep right away finds the new marker fresh: no task, marker or enqueue is added.
    expect(await sweep(w)).toMatchObject({ requeued: 0, abandoned: 0, enqueued: 0 });
    expect((await rows(w)).steps).toEqual(r.steps);
    expect(pool.log).toHaveLength(2);

    await drain(w);
    r = await rows(w);
    expectLaunchDone(r, project(w));
    expect(hooks.calls.map((call) => call.type)).toEqual(LAUNCH_CALLS);
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "succeeded"]);
    expect(r.usage).toHaveLength(cleanUsage);
    // The sweep spent no token: the limiter is exactly as the launch left it.
    expect(await limiterState(w)).toEqual(atStart);
    expect(inFlight(r)).toBe(0);
  });

  test("late work (a pool backlog) the sweep superseded never runs the step: one run, one document", async () => {
    const w = await world();
    await start(w);
    const first = only(pool.log);
    expect(first.dropped).toBe(false);
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 1, enqueued: 1 });
    expect(pool.log).toHaveLength(2);
    expect(pool.log[1]?.markerId).not.toBe(first.markerId);

    await drain(w);
    const r = await rows(w);
    expectLaunchDone(r, project(w));
    const blueprint = only(ofType(r, "crew_blueprint"));
    // Both pieces of work ran; the one under the settled marker stopped at its start.
    expect(hooks.calls.filter((call) => call.type === "crew_blueprint").map((call) => call.markerId))
      .toEqual([first.markerId, pool.log[1]?.markerId]);
    expect(hooks.outcomes.filter((outcome) => outcome.kind === "skipped")).toEqual([{ kind: "skipped", reason: "superseded" }]);
    expect(r.runs.filter((run) => run.taskId === blueprint._id)).toHaveLength(1);
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "succeeded"]);
    expect(r.tasks).toHaveLength(5);
  });

  test("a late stepDone for superseded work does nothing: no re-enqueue, no settle, no abandon", async () => {
    const w = await world();
    await start(w);
    const first = only(pool.log);
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 1, enqueued: 1 });
    const before = await rows(w);
    const blueprint = only(ofType(before, "crew_blueprint"));
    // The old work's completion arrives: an action failure (which re-enqueues on a live marker), then the last
    // failure before an abandon. Neither may act: the new marker's work owns the step.
    for (const actionFailures of [0, 2]) {
      await w.t.mutation(internal.crew.launch.stepDone, {
        workId: "old-work" as WorkId,
        context: { taskId: blueprint._id, step: "blueprint", actionFailures, markerId: first.markerId as Id<"task_steps"> },
        result: { kind: "failed", error: "the action died" },
      });
    }
    expect(await rows(w)).toEqual(before);
    expect(pool.log).toHaveLength(2);
    await drain(w);
    const r = await rows(w);
    expectLaunchDone(r, project(w));
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", ...LAUNCH_CALLS]);
  });

  test("a backlog past the threshold, again and again: never failed, and the step runs exactly once", async () => {
    const w = await world();
    await start(w);
    // The pool never gets to the work: each sweep supersedes it and enqueues the step at the back again.
    const rounds = LAUNCH_SWEEP_REQUEUES_MAX + 3;
    for (let i = 0; i < rounds; i += 1) {
      later(STRANDED_MARKER_MS);
      expect(await sweep(w)).toMatchObject({ requeued: 1, reinvoked: 0, abandoned: 0, enqueued: 1 });
    }
    let r = await rows(w);
    const blueprint = only(ofType(r, "crew_blueprint"));
    expect(blueprint.status).toBe("queued");
    expect(markersOf(r, blueprint._id)).toEqual([...Array(rounds).fill("failed"), "running"]);
    expect(pool.log).toHaveLength(1 + rounds);
    expect(pool.log.every((call) => !call.dropped)).toBe(true);

    // The backlog clears: every superseded piece of work stops at its start, the newest runs the step once.
    await drain(w);
    r = await rows(w);
    expectLaunchDone(r, project(w));
    expect(hooks.outcomes.filter((outcome) => outcome.kind === "skipped"))
      .toEqual(Array(rounds).fill({ kind: "skipped", reason: "superseded" }));
    expect(hooks.calls.filter((call) => call.type === "crew_blueprint").map((call) => call.markerId))
      .toEqual(pool.log.filter((call) => call.taskId === blueprint._id).map((call) => call.markerId));
    expect(r.runs.filter((run) => run.taskId === blueprint._id)).toHaveLength(1);
    expect(markersOf(r, blueprint._id)).toEqual([...Array(rounds).fill("failed"), "succeeded"]);
    expect(inFlight(r)).toBe(0);
  });
});

describe("L1 launch sweep: a running task between executions (a retry whose stepDone threw or whose re-invoke was lost)", () => {
  test("recovered exactly once, under a new marker, keeping its slot; the launch then completes", async () => {
    const w = await world();
    const blueprint = await betweenExecutions(w);
    // Within the lease, and under the threshold: untouched.
    for (const step of [0, RUN_LEASE_MS + 1]) {
      later(step);
      const before = await rows(w);
      expect(await sweep(w)).toMatchObject({ requeued: 0, reinvoked: 0, abandoned: 0, enqueued: 0 });
      expect(await rows(w)).toEqual(before);
    }
    later(STRANDED_MARKER_MS);
    const atStart = await limiterState(w);
    expect(await sweep(w)).toMatchObject({ requeued: 0, reinvoked: 1, abandoned: 0, enqueued: 0 });
    let r = await rows(w);
    expect(only(ofType(r, "crew_blueprint")).status).toBe("running");
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "running"]);
    expect(inFlight(r)).toBe(1);
    const fresh = r.steps.find((row) => row.taskId === blueprint._id && row.status === "running");
    expect(pool.log.slice(1)).toEqual([{ taskId: blueprint._id, markerId: fresh?._id, dropped: false }]);
    // Again right away: nothing.
    expect(await sweep(w)).toMatchObject({ requeued: 0, reinvoked: 0, abandoned: 0, enqueued: 0 });
    expect((await rows(w)).steps).toEqual(r.steps);
    expect(pool.log).toHaveLength(2);

    await drain(w);
    r = await rows(w);
    expect(only(ofType(r, "crew_blueprint"))).toMatchObject({ status: "succeeded" });
    expect(r.runs.filter((run) => run.taskId === blueprint._id).map((run) => run.status).sort()).toEqual(["failed", "succeeded"]);
    expect(hooks.calls.map((call) => call.type)).toEqual(LAUNCH_CALLS);
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "succeeded"]);
    expect(r.ledger).toEqual([]);
    expect(await limiterState(w)).toEqual(atStart);
  });

  test("a running task with an open run is left to recoverStaleCrewRuns, however old", async () => {
    const w = await world();
    const blueprint = await betweenExecutions(w);
    await w.t.run(async (ctx) => {
      await ctx.db.insert("workflow_runs", {
        ownerId: blueprint.ownerId, projectId: blueprint.projectId, taskId: blueprint._id, type: "crew_blueprint",
        status: "running", idempotencyKey: `run:${blueprint._id}:2`, attempt: 3n, createdAt: Date.now(), updatedAt: Date.now(),
        startedAt: Date.now(),
      });
    });
    const before = await rows(w);
    later(10 * STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 0, reinvoked: 0, abandoned: 0, enqueued: 0 });
    expect(await rows(w)).toEqual(before);
    expect(pool.log).toHaveLength(1);
  });

  test("a late stepDone (new or legacy) for the lost re-invoke does nothing after the recovery", async () => {
    const w = await world();
    const blueprint = await betweenExecutions(w);
    const lostMarker = only(pool.log).markerId as Id<"task_steps">;
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ reinvoked: 1 });
    const before = await rows(w);
    const retry = { kind: "success" as const, returnValue: { kind: "retry" as const, retryClass: "retryable_unbilled" as const, delayMs: 5_000, scheduled: false } };
    for (const context of [
      { taskId: blueprint._id, step: "blueprint" as const, actionFailures: 0, markerId: lostMarker },
      { taskId: blueprint._id, step: "blueprint" as const, actionFailures: 0 },
    ]) {
      await w.t.mutation(internal.crew.launch.stepDone, { workId: "late-work" as WorkId, context, result: retry });
      await w.t.mutation(internal.crew.launch.stepDone, {
        workId: "late-work" as WorkId, context: { ...context, actionFailures: 2 }, result: { kind: "failed", error: "the action died" },
      });
    }
    // The lost re-invoke itself, arriving late with its old marker: stops at its start.
    expect(await w.t.mutation(internal.crew.jobs.startCrewRun, { taskId: blueprint._id, markerId: lostMarker }))
      .toEqual({ kind: "skip", reason: "superseded" });
    expect(await rows(w)).toEqual(before);
    expect(pool.log).toHaveLength(2);
    await drain(w);
    const r = await rows(w);
    expect(only(ofType(r, "crew_blueprint"))).toMatchObject({ status: "succeeded" });
    expect(r.runs.filter((run) => run.taskId === blueprint._id && run.status === "succeeded")).toHaveLength(1);
    expect(hooks.calls.filter((call) => call.type === "crew_blueprint")).toHaveLength(1);
  });

  test("re-invokes that keep stranding: at most twice, then the task fails as interrupted with no refund", async () => {
    const w = await world();
    const blueprint = await betweenExecutions(w);
    pool.drop = () => true;
    for (let i = 0; i < LAUNCH_SWEEP_REQUEUES_MAX; i += 1) {
      later(STRANDED_MARKER_MS);
      expect(await sweep(w)).toMatchObject({ reinvoked: 1, abandoned: 0 });
    }
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 0, reinvoked: 0, abandoned: 1, enqueued: 0 });
    const r = await rows(w);
    expect(only(ofType(r, "crew_blueprint")).status).toBe("failed");
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "failed", "failed"]);
    expect(r.ledger).toEqual([]);
    expect(r.runs.filter((run) => run.taskId === blueprint._id)).toHaveLength(1);
    expect(inFlight(r)).toBe(0);
    // Settled: the next sweep has nothing to do.
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ owners: 1, requeued: 0, reinvoked: 0, abandoned: 0, settled: 0, enqueued: 0 });
    expect(pool.log).toHaveLength(1 + LAUNCH_SWEEP_REQUEUES_MAX);
  });

  test("a real strand: stepDone's re-enqueue throws after a retryable failure; the sweep re-invokes it once", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1
      ? { reply: () => { throw new ProviderError("anthropic", "rate_limit", "scripted rate_limit"); } }
      : {});
    await start(w);
    const blueprintId = only(ofType(await rows(w), "crew_blueprint"))._id;
    // Every later enqueue of the blueprint throws, so `stepDone` (inline, then its scheduled retry) rolls back.
    pool.fail = (taskId) => taskId === blueprintId;
    await drain(w);
    let r = await rows(w);
    expect(only(ofType(r, "crew_blueprint")).status).toBe("running");
    expect(r.runs.filter((run) => run.taskId === blueprintId)).toEqual([expect.objectContaining({ status: "failed" })]);
    expect(markersOf(r, blueprintId)).toEqual(["running"]);
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint"]);

    pool.fail = () => false;
    // Draining moved the fake clock on; measure from the strand's last activity.
    const task = only(ofType(r, "crew_blueprint"));
    const run = only(r.runs.filter((row) => row.taskId === blueprintId));
    const marker = only(r.steps.filter((row) => row.taskId === blueprintId));
    const last = Math.max(task.updatedAt, marker.updatedAt, run.updatedAt, run.completedAt ?? 0);
    vi.setSystemTime(last + STRANDED_MARKER_MS - 1);
    expect(await sweep(w)).toMatchObject({ reinvoked: 0 });
    later(1);
    expect(await sweep(w)).toMatchObject({ requeued: 0, reinvoked: 1, abandoned: 0, enqueued: 0 });
    await drain(w);
    r = await rows(w);
    expect(only(ofType(r, "crew_blueprint"))).toMatchObject({ status: "succeeded" });
    expect(r.runs.filter((run) => run.taskId === blueprintId).map((run) => run.status).sort()).toEqual(["failed", "succeeded"]);
    expect(markersOf(r, blueprintId)).toEqual(["failed", "succeeded"]);
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", ...LAUNCH_CALLS]);
    expect(r.ledger).toEqual([]);
    expect(inFlight(r)).toBe(0);
  });

  test("a spent retry budget: the re-invoke fails the task closed at its start, with no gateway call or charge", async () => {
    const w = await world();
    const blueprint = await betweenExecutions(w, ["retryable_unbilled", "retryable_unbilled", "indeterminate", "retryable_unbilled"]);
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ reinvoked: 1 });
    await drain(w);
    const r = await rows(w);
    expect(only(ofType(r, "crew_blueprint"))).toMatchObject({ status: "failed" });
    expect(hooks.outcomes).toEqual([{ kind: "skipped", reason: "exhausted" }]);
    expect(r.runs.filter((run) => run.taskId === blueprint._id)).toHaveLength(4);
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "failed"]);
    expect(r.usage).toEqual([]);
    expect(r.ledger).toEqual([]);
    expect(inFlight(r)).toBe(0);
  });
});

describe("L1 launch sweep: rollout (work and callbacks enqueued before the deploy carry no markerId)", () => {
  /** A stepDone delivery as the workpool sends it, with the context of work enqueued before the deploy. */
  const legacyStepDone = async (w: World, taskId: Id<"tasks">, actionFailures: number, result: { kind: "failed"; error: string } | { kind: "canceled" }) =>
    await w.t.mutation(internal.crew.launch.stepDone, {
      workId: "legacy-work" as WorkId,
      context: { taskId, step: "blueprint", actionFailures },
      result,
    });

  test("before any replacement, a legacy callback still acts on its own marker (re-enqueues the step)", async () => {
    const w = await world();
    pool.drop = () => true;
    await start(w);
    const blueprint = only(ofType(await rows(w), "crew_blueprint"));
    pool.drop = () => false;
    await legacyStepDone(w, blueprint._id, 0, { kind: "failed", error: "the action died" });
    expect(pool.log).toHaveLength(2);
    // Upgraded: the re-enqueue carries the marker it holds.
    const r = await rows(w);
    expect(markersOf(r, blueprint._id)).toEqual(["running"]);
    expect(pool.log[1]?.markerId).toBe(only(r.steps)._id);
  });

  test("after a sweep replacement, a legacy callback never re-enqueues, settles or abandons; legacy work never runs", async () => {
    const w = await world();
    pool.drop = () => true;
    await start(w);
    pool.drop = () => false;
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 1, enqueued: 1 });
    const before = await rows(w);
    const blueprint = only(ofType(before, "crew_blueprint"));
    expect(markersOf(before, blueprint._id)).toEqual(["failed", "running"]);

    // Re-enqueue, abandon (the last action failure) and cancel deliveries: none may touch the new marker or task.
    await legacyStepDone(w, blueprint._id, 0, { kind: "failed", error: "the action died" });
    await legacyStepDone(w, blueprint._id, 2, { kind: "failed", error: "the action died" });
    await legacyStepDone(w, blueprint._id, 0, { kind: "canceled" });
    // Legacy work itself (args with no markerId) stops at its start.
    expect(await w.t.mutation(internal.crew.jobs.startCrewRun, { taskId: blueprint._id })).toEqual({ kind: "skip", reason: "superseded" });
    expect(await rows(w)).toEqual(before);
    expect(pool.log).toHaveLength(2);

    await drain(w);
    const r = await rows(w);
    expectLaunchDone(r, project(w));
    expect(hooks.calls.map((call) => call.type)).toEqual(LAUNCH_CALLS);
    expect(markersOf(r, blueprint._id)).toEqual(["failed", "succeeded"]);
  });

  test("a sweep that settled the marker while the cap is full: a legacy callback leaves the waiting step alone", async () => {
    const w = await world(1, 4);
    pool.drop = () => true;
    for (let b = 0; b < 4; b += 1) await start(w, 0, b);
    pool.drop = () => false;
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: OWNER_CREW_CAP, enqueued: OWNER_CREW_CAP });
    const before = await rows(w);
    // The one blueprint the cap left waiting: its single marker is the settled one, and nothing is on the pool.
    const waiting = only(ofType(before, "crew_blueprint").filter((row) => markersOf(before, row._id).join() === "failed"));
    await legacyStepDone(w, waiting._id, 0, { kind: "failed", error: "the action died" });
    await legacyStepDone(w, waiting._id, 2, { kind: "failed", error: "the action died" });
    expect(await rows(w)).toEqual(before);
    expect(pool.log.filter((call) => !call.dropped)).toHaveLength(OWNER_CREW_CAP);
  });

  test("not DAG work: a task with no marker starts as before without a markerId", async () => {
    const w = await world();
    pool.drop = () => true;
    await start(w);
    const blueprint = only(ofType(await rows(w), "crew_blueprint"));
    await w.t.run(async (ctx) => {
      for (const row of await ctx.db.query("task_steps").collect()) await ctx.db.delete("task_steps", row._id);
    });
    expect(await w.t.mutation(internal.crew.jobs.startCrewRun, { taskId: blueprint._id })).toMatchObject({ kind: "run" });
  });
});

describe("L1 launch sweep: what it leaves alone", () => {
  test("a marker with an open run is untouched, however old", async () => {
    const w = await world();
    pool.drop = () => true;
    await start(w);
    const blueprint = only(ofType(await rows(w), "crew_blueprint"));
    await w.t.run(async (ctx) => {
      await ctx.db.insert("workflow_runs", {
        ownerId: blueprint.ownerId, projectId: blueprint.projectId, taskId: blueprint._id, type: "crew_blueprint",
        status: "running", idempotencyKey: `run:${blueprint._id}:1`, attempt: 1n, createdAt: Date.now(), updatedAt: Date.now(),
        startedAt: Date.now(),
      });
    });
    const before = await rows(w);
    later(10 * STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 0, abandoned: 0, enqueued: 0 });
    expect(await rows(w)).toEqual(before);
  });

  test("a parked step keeps its marker and waits for resumeLaunch", async () => {
    const w = await world();
    hooks.plan = ({ type, n }) => (type === "crew_blueprint" && n === 1 ? { before: async () => await setOps(w, { ai: false }) } : {});
    await start(w);
    await drain(w);
    await setOps(w, { ai: true });
    const before = await rows(w);
    const blueprint = only(ofType(before, "crew_blueprint"));
    expect(blueprint.status).toBe("blocked");
    expect(markersOf(before, blueprint._id)).toEqual(["running"]);
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 0, abandoned: 0, enqueued: 0 });
    expect(await rows(w)).toEqual(before);
    expect(pool.log).toHaveLength(1);
  });

  test("a finished launch is untouched; a leftover running marker on a terminal task is settled once", async () => {
    const w = await world(2);
    await start(w, 0);
    await drain(w);
    const finished = (await rows(w)).steps;
    pool.drop = () => true;
    await start(w, 1);
    const failedId = only(ofType(await rows(w), "crew_blueprint", project(w, 1)))._id;
    const markerId = only(pool.log.filter((call) => call.taskId === failedId)).markerId as Id<"task_steps">;
    // Its stepDone threw, and the task ended anyway (recovery failed it, say).
    await w.t.run(async (ctx) => await ctx.db.patch("tasks", failedId, { status: "failed", updatedAt: Date.now() }));
    const before = await rows(w);
    later(LEFTOVER_MARKER_MS - 1);
    expect(await sweep(w)).toMatchObject({ requeued: 0, abandoned: 0, settled: 0, enqueued: 0 });
    expect(await rows(w)).toEqual(before);

    later(1);
    expect(await sweep(w)).toMatchObject({ requeued: 0, reinvoked: 0, abandoned: 0, settled: 1, enqueued: 0 });
    const r = await rows(w);
    expect(markersOf(r, failedId)).toEqual(["failed"]);
    expect(r.steps.filter((row) => row.status === "running")).toEqual([]);
    expect(r.steps.filter((row) => row.projectId === project(w, 0))).toEqual(finished.filter((row) => row.projectId === project(w, 0)));
    expect(inFlight(r)).toBe(0);
    // Its stepDone, arriving late (new or legacy): superseded, so nothing moves.
    for (const context of [
      { taskId: failedId, step: "blueprint" as const, actionFailures: 0, markerId },
      { taskId: failedId, step: "blueprint" as const, actionFailures: 0 },
    ]) {
      await w.t.mutation(internal.crew.launch.stepDone, { workId: "late-work" as WorkId, context, result: { kind: "failed", error: "the action died" } });
    }
    expect(await rows(w)).toEqual(r);
    expect(await sweep(w)).toMatchObject({ settled: 0, enqueued: 0 });
    expect(pool.log.filter((call) => call.taskId === failedId)).toHaveLength(1);
  });

  test("an archived business, and an archived task, are untouched", async () => {
    const w = await world(2);
    pool.drop = () => true;
    await start(w, 0);
    await start(w, 1);
    const r = await rows(w);
    await w.t.run(async (ctx) => {
      await ctx.db.patch("projects", project(w, 0), { archivedAt: 5 });
      await ctx.db.patch("tasks", only(ofType(r, "crew_blueprint", project(w, 1)))._id, { archivedAt: 5 });
    });
    const before = await rows(w);
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ requeued: 0, abandoned: 0, enqueued: 0 });
    expect(await rows(w)).toEqual(before);
    expect(pool.log).toHaveLength(2);
  });
});

describe("L1 launch sweep: gates before anything can spend", () => {
  test.each([
    ["AI off", { ai: false }],
    ["the workspace off", { workspace: false }],
  ] as const)("%s: nothing is touched or enqueued, the page still finishes; back on, it requeues", async (_label, off) => {
    const w = await world(2);
    pool.drop = () => true;
    await start(w, 0);
    await start(w, 1);
    await setOps(w, off);
    const before = await rows(w);
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ owners: 2, gatedOwners: 2, failedOwners: 0, requeued: 0, enqueued: 0, isDone: true });
    expect(await rows(w)).toEqual(before);
    expect(pool.log).toHaveLength(2);

    await setOps(w, { ai: true, workspace: true });
    expect(await sweep(w)).toMatchObject({ owners: 2, gatedOwners: 0, requeued: 2, enqueued: 2 });
  });

  test("an owner out of cohort is skipped, and the in-cohort owner on the same page is requeued", async () => {
    const w = await world(2);
    pool.drop = () => true;
    await start(w, 0);
    await start(w, 1);
    await w.t.run(async (ctx) => await ctx.db.insert("workspace_cohort", { ownerId: person(w, 1).userId, addedBy: person(w, 1).userId, addedAt: 1 }));
    await setOps(w, { cohort: "allowlist" });
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ owners: 2, gatedOwners: 1, failedOwners: 0, requeued: 1, enqueued: 1 });
    const r = await rows(w);
    expect(markersOf(r, only(ofType(r, "crew_blueprint", project(w, 0)))._id)).toEqual(["running"]);
    expect(markersOf(r, only(ofType(r, "crew_blueprint", project(w, 1)))._id)).toEqual(["failed", "running"]);
  });

  test("an owner job that throws rolls back alone; the other owner's job still requeues (real scheduler)", async () => {
    const w = await world(2);
    const brokenId = (await betweenExecutions(w, ["retryable_unbilled"], 0))._id;
    pool.drop = () => true;
    await start(w, 1);
    pool.drop = () => false;
    // Owner 0's re-invoke throws inside its job, before its advance.
    pool.fail = (taskId) => taskId === brokenId;
    later(STRANDED_MARKER_MS);
    expect(await w.t.mutation(internal.crew.launch.recoverStalledLaunches, {})).toEqual({ businesses: 2, owners: 2, isDone: true });
    vi.runOnlyPendingTimers();
    await w.t.finishInProgressScheduledFunctions();
    const jobs = (await w.t.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()))
      .filter((job) => job.name.includes("recoverStalledOwner"));
    const stateOf = (o: number) => jobs.find((job) => (job.args[0] as { ownerId: string }).ownerId === person(w, o).userId)?.state.kind;
    expect(stateOf(0)).toBe("failed");
    expect(stateOf(1)).toBe("success");
    const after = await rows(w);
    // Owner 0's marker settle rolled back with its failed re-invoke.
    expect(markersOf(after, brokenId)).toEqual(["running"]);
    expect(markersOf(after, only(ofType(after, "crew_blueprint", project(w, 1)))._id)).toEqual(["failed", "running"]);
  });

  test("a throwing advanceOwner rolls back alone: the settles and the re-invoke before it still commit", async () => {
    const w = await world(1, 2);
    const running = await betweenExecutions(w, ["retryable_unbilled"], 0, 0);
    pool.drop = () => true;
    await start(w, 0, 1);
    pool.drop = () => false;
    const queuedId = only(ofType(await rows(w), "crew_blueprint", project(w, 0, 1)))._id;
    // The advance (the only enqueuer of the requeued step) throws; the running task's re-invoke does not.
    pool.fail = (taskId) => taskId === queuedId;
    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ failedOwners: 0, advanceFailed: 1, requeued: 1, reinvoked: 1, enqueued: 0 });
    let r = await rows(w);
    expect(markersOf(r, running._id)).toEqual(["failed", "running"]);
    expect(markersOf(r, queuedId)).toEqual(["failed"]);
    expect(only(ofType(r, "crew_blueprint", project(w, 0, 1))).status).toBe("queued");

    // The next sweep advances the requeued step; then both launches complete.
    pool.fail = () => false;
    expect(await sweep(w)).toMatchObject({ advanceFailed: 0, requeued: 0, reinvoked: 0, enqueued: 1 });
    await drain(w);
    r = await rows(w);
    expectLaunchDone(r, project(w, 0, 1));
    expect(only(ofType(r, "crew_blueprint", project(w, 0, 0)))).toMatchObject({ status: "succeeded" });
    expect(markersOf(r, queuedId)).toEqual(["failed", "succeeded"]);
    expect(inFlight(r)).toBe(0);
  });
});

describe("L1 launch sweep: re-advancing a stalled owner", () => {
  test("a ready step with a free slot and no marker is enqueued, and the launch completes", async () => {
    const w = await world();
    pool.drop = () => true;
    await start(w);
    const blueprintId = only(ofType(await rows(w), "crew_blueprint"))._id;
    // As if the marker was settled but no advance followed: queued, nothing on the pool.
    await w.t.run(async (ctx) => {
      const marker = (await ctx.db.query("task_steps").collect())[0];
      if (marker === undefined) throw new Error("no marker");
      await ctx.db.patch("task_steps", marker._id, { status: "failed" });
    });
    pool.drop = () => false;
    expect(await sweep(w)).toMatchObject({ requeued: 0, enqueued: 1 });
    await drain(w);
    const r = await rows(w);
    expectLaunchDone(r, project(w));
    expect(markersOf(r, blueprintId)).toEqual(["failed", "succeeded"]);
  });

  test(`requeues and advances under the cap of ${OWNER_CREW_CAP}; the waiting launch runs once a slot frees`, async () => {
    const w = await world(1, 4);
    pool.drop = () => pool.log.length < OWNER_CREW_CAP;
    for (let b = 0; b < 4; b += 1) await start(w, 0, b);
    let r = await rows(w);
    expect(inFlight(r)).toBe(OWNER_CREW_CAP);
    const waiting = only(ofType(r, "crew_blueprint", project(w, 0, 3)));
    expect(markersOf(r, waiting._id)).toEqual([]);

    later(STRANDED_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ owners: 1, requeued: OWNER_CREW_CAP, enqueued: OWNER_CREW_CAP });
    r = await rows(w);
    expect(inFlight(r)).toBe(OWNER_CREW_CAP);
    // Three of the four blueprints are on the pool (the clock is frozen, so which three is the tie order); one waits.
    const blueprints = ofType(r, "crew_blueprint");
    expect(blueprints.filter((row) => markersOf(r, row._id).at(-1) === "running")).toHaveLength(OWNER_CREW_CAP);
    expect(blueprints.filter((row) => markersOf(r, row._id).at(-1) !== "running")).toHaveLength(1);
    expect(pool.log.filter((call) => !call.dropped)).toHaveLength(OWNER_CREW_CAP);

    let maxSeen = 0;
    hooks.plan = () => ({ before: async () => void (maxSeen = Math.max(maxSeen, inFlight(await rows(w)))) });
    await drain(w);
    r = await rows(w);
    for (let b = 0; b < 4; b += 1) expectLaunchDone(r, project(w, 0, b));
    expect(maxSeen).toBeLessThanOrEqual(OWNER_CREW_CAP);
    expect(r.tasks).toHaveLength(4 * 5);
  });
});

describe("L1 launch sweep: overlap with itself and with recoverStaleCrewRuns", () => {
  test("sweeps and recovery pages interleaved: no duplicate task, enqueue, run, metering, ledger row or token", async () => {
    const w = await world(1, 2);
    pool.drop = () => true;
    await start(w, 0, 0);
    await start(w, 0, 1);
    pool.drop = () => false;
    const r0 = await rows(w);
    const stranded = only(ofType(r0, "crew_blueprint", project(w, 0, 0)));
    const dying = only(ofType(r0, "crew_blueprint", project(w, 0, 1)));
    // Business 2: the action opened its run and died, and its stepDone never came.
    await w.t.run(async (ctx) => {
      await ctx.db.patch("tasks", dying._id, { status: "running", updatedAt: Date.now() });
      await ctx.db.insert("workflow_runs", {
        ownerId: dying.ownerId, projectId: dying.projectId, taskId: dying._id, type: "crew_blueprint",
        status: "running", idempotencyKey: `run:${dying._id}:1`, attempt: 1n, createdAt: Date.now(), updatedAt: Date.now(),
        startedAt: Date.now(),
      });
    });
    const atStart = await limiterState(w);
    later(STRANDED_MARKER_MS);

    expect(await sweep(w)).toMatchObject({ requeued: 1, enqueued: 1 });
    expect(await sweep(w)).toMatchObject({ requeued: 0, enqueued: 0 });
    expect(await w.t.mutation(internal.crew.jobs.recoverStaleCrewRuns, { limit: 1 })).toMatchObject({ recovered: 1, failedTasks: 1 });
    expect(await sweep(w)).toMatchObject({ requeued: 0, enqueued: 0 });
    expect(await w.t.mutation(internal.crew.jobs.recoverStaleCrewRuns, {})).toMatchObject({ recovered: 0, failedTasks: 0 });
    expect(await sweep(w)).toMatchObject({ requeued: 0, enqueued: 0 });

    const r = await rows(w);
    expect(r.tasks.map((row) => row._id).sort()).toEqual(r0.tasks.map((row) => row._id).sort());
    expect(markersOf(r, stranded._id)).toEqual(["failed", "running"]);
    // Recovery failed the dying task; the sweep left it (and its leftover marker) alone.
    expect(only(ofType(r, "crew_blueprint", project(w, 0, 1)))).toMatchObject({ status: "failed" });
    expect(markersOf(r, dying._id)).toEqual(["running"]);
    expect(r.runs).toEqual([expect.objectContaining({ taskId: dying._id, status: "failed", errorCode: "indeterminate" })]);
    expect(pool.log.filter((call) => !call.dropped)).toEqual([expect.objectContaining({ taskId: stranded._id })]);
    expect(r.usage).toEqual([]);
    expect(r.ledger).toEqual([]);
    expect(await limiterState(w)).toEqual(atStart);

    await drain(w);
    const done = await rows(w);
    expectLaunchDone(done, project(w, 0, 0));
    expect(ofType(done, "crew_blueprint", project(w, 0, 1))).toEqual([expect.objectContaining({ status: "failed" })]);
    expect(hooks.calls.filter((call) => call.type === "crew_blueprint")).toHaveLength(1);
    expect(done.ledger).toEqual([]);
    // Once still for LEFTOVER_MARKER_MS, the failed task's leftover marker is settled, once.
    later(LEFTOVER_MARKER_MS);
    expect(await sweep(w)).toMatchObject({ settled: 1, requeued: 0, enqueued: 0 });
    expect(await sweep(w)).toMatchObject({ settled: 0 });
    expect(markersOf(await rows(w), dying._id)).toEqual(["failed"]);
  });
});

describe("L1 launch sweep: pagination", () => {
  test("more businesses than one page: the page schedules exactly one continuation, which ends the chain", async () => {
    const w = await world(LAUNCH_SWEEP_PAGE_MAX + 1);
    const first = await sweep(w, { limit: 10 * LAUNCH_SWEEP_PAGE_MAX });
    // Every owner with a live workspace business gets a job (here none has a launch, so each does nothing).
    expect(first).toMatchObject({ businesses: LAUNCH_SWEEP_PAGE_MAX, owners: LAUNCH_SWEEP_PAGE_MAX, isDone: false, requeued: 0, enqueued: 0 });
    const scheduled = async () => (await w.t.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()))
      .filter((job) => job.name.includes("recoverStalledLaunches"));
    const pending = await scheduled();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.args[0]).toMatchObject({ limit: LAUNCH_SWEEP_PAGE_MAX, cursor: expect.any(String) });

    await drain(w);
    const all = await scheduled();
    expect(all).toHaveLength(1);
    expect(all[0]?.state.kind).toBe("success");
    // The continuation scheduled the last owner's job, which the scheduler ran.
    const ownerJobs = (await w.t.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()))
      .filter((job) => job.name.includes("recoverStalledOwner") && job.state.kind !== "canceled");
    expect(ownerJobs.map((job) => job.state.kind)).toEqual(["success"]);
  });

  test("a no-arg call reads one page; a small limit pages through owners with launches, each swept once", async () => {
    const w = await world(3);
    pool.drop = () => true;
    for (let o = 0; o < 3; o += 1) await start(w, o);
    pool.drop = () => false;
    later(STRANDED_MARKER_MS);
    expect(await sweep(w, { limit: 2 })).toMatchObject({ businesses: 2, owners: 2, requeued: 2, isDone: false });
    // The continuation sweeps the third owner; draining runs the requeued work too.
    await drain(w);
    const r = await rows(w);
    for (let o = 0; o < 3; o += 1) {
      expect(markersOf(r, only(ofType(r, "crew_blueprint", project(w, o)))._id)).toEqual(["failed", "succeeded"]);
    }
    expect(await sweep(w)).toMatchObject({ businesses: 3, owners: 3, requeued: 0, enqueued: 0, isDone: true });
  });

  test("an owner whose businesses span two pages is swept by each page's job, and recovered once", async () => {
    const w = await world(1, 2);
    pool.drop = () => true;
    await start(w, 0, 0);
    await start(w, 0, 1);
    pool.drop = () => false;
    later(STRANDED_MARKER_MS);
    expect(await sweep(w, { limit: 1 })).toMatchObject({ businesses: 1, owners: 1, requeued: 2, enqueued: 2, isDone: false });
    const [next] = await takeScheduled<{ cursor: string; limit: number }>(w, "recoverStalledLaunches");
    expect(next).toMatchObject({ limit: 1, cursor: expect.any(String) });
    const r = await rows(w);
    expect(await sweep(w, next)).toMatchObject({ businesses: 1, owners: 1, requeued: 0, reinvoked: 0, enqueued: 0 });
    expect(await rows(w)).toEqual(r);
    expect(pool.log.filter((call) => !call.dropped)).toHaveLength(2);
    await drain(w);
    const done = await rows(w);
    for (let b = 0; b < 2; b += 1) {
      expectLaunchDone(done, project(w, 0, b));
      expect(markersOf(done, only(ofType(done, "crew_blueprint", project(w, 0, b)))._id)).toEqual(["failed", "succeeded"]);
    }
  });
});
