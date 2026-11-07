/// <reference types="vite/client" />
/**
 * WP75-S1. The launch at Meet your co-founder: `startLaunch` / `retryLaunch` /
 * `launchStatus` as the founder calls them (signed in through convex-test's
 * identity), and the roster planned in the blueprint step's finish. Fixture
 * mode with the REAL registry, C-METER, ledger, approvals and limiter; the
 * blueprint step is run in the test with a fixture adapter (no provider is
 * ever called), the way `generators.test.ts` runs it.
 */
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import schema from "../schema";
import { runPromptWithMeter } from "../ai/gatewayActions";
import { createAnthropicAdapter } from "../ai/providers/anthropic";
import type { AnthropicFixtureReply } from "../ai/providers/fixtures";
import type { Blueprint } from "../../lib/workspace/contracts/artifacts";
import { hydrotrailBlueprint, hydrotrailWizardAnswers } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import { FIXTURE_TEAM_PROFILES } from "../../lib/workspace/contracts/fixtures/teamProfiles";
import { jobKey } from "../../lib/workspace/contracts/jobs";
import { rosterPlanSchema } from "../../lib/workspace/contracts/roster";
import { rosterInputFromWizard, type WizardAnswers } from "../../lib/workspace/contracts/wizard";
import { WORKSTREAM_TITLES } from "../../lib/workspace/crew/launch";
import { runCrewGeneratorStepWith, type CrewGeneratorCtx } from "./generators";
import { insertLaunchRosterTask, rosterPlanMatchesRow, writeLaunchRoster } from "./launchRoster";
import { ROSTER_RULES_VERSION, planRoster } from "./roles";
import type { CrewRunPrompt } from "./runner";

const modules = import.meta.glob("/convex/**/*.ts");

type T = TestConvex<typeof schema>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

type Person = { readonly userId: Id<"users">; readonly sessionId: Id<"authSessions"> };

type World = {
  readonly t: T;
  readonly owner: Person;
  readonly other: Person;
  readonly opsId: Id<"ops_settings">;
  readonly projectId: Id<"projects">;
  readonly wizardSessionId: Id<"wizard_sessions">;
};

const COURSE_SLUG = "trail-skills-course";

/** A signed-in owner with a finished wizard and the business `createBusiness` made from it. */
async function world(options: { ideaSlug?: string; answers?: WizardAnswers } = {}): Promise<World> {
  const ideaSlug = options.ideaSlug ?? "hydrotrail";
  const answers: WizardAnswers = options.answers ?? { ...hydrotrailWizardAnswers, idea: { source: "library", ideaSlug } };
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  registerWorkpool(t, "crewWorkpool");
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const person = async (email: string): Promise<Person> => {
      const userId = await ctx.db.insert("users", { email, emailVerificationTime: 1 });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
      return { userId, sessionId };
    };
    const owner = await person("owner@example.test");
    const other = await person("other@example.test");
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true }, updatedAt: 1,
    });
    const wizardSessionId = await ctx.db.insert("wizard_sessions", {
      ownerId: owner.userId, ideaSlug, step: "partner_name", answers, startedAt: 1, updatedAt: 1, completedAt: 2,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId: owner.userId,
      source: "repository_idea",
      title: "HydroTrail",
      status: "draft",
      idempotencyKey: `business:${ideaSlug}`,
      workspace: {
        version: 1, name: "HydroTrail", slug: ideaSlug, ideaSlug,
        platform: "web", commercialModel: "free", goal: "waitlist",
        partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
      },
      createdAt: 1, updatedAt: 1,
    });
    await ctx.db.patch("wizard_sessions", wizardSessionId, { projectId });
    return { owner, other, opsId, projectId, wizardSessionId };
  });
  return { t, ...ids };
}

const as = (w: World, person: Person) =>
  w.t.withIdentity({ subject: `${person.userId}|${person.sessionId}`, issuer: "https://local.test" });

function ctxFor(t: T): CrewGeneratorCtx {
  const runMutation = async (ref: Parameters<T["mutation"]>[0], args: Record<string, unknown>) => await t.mutation(ref, args);
  const runQuery = async (ref: Parameters<T["query"]>[0], args: Record<string, unknown>) => await t.query(ref, args);
  const runAction = async () => {
    throw new Error("tests inject runPrompt; no action is run");
  };
  return {
    runMutation: runMutation as ActionCtx["runMutation"],
    runQuery: runQuery as ActionCtx["runQuery"],
    runAction: runAction as ActionCtx["runAction"],
  };
}

/** The gateway body on the real meter with a fixture adapter (the fixture blueprint unless `reply` scripts one). */
function gateway(t: T, reply?: () => AnthropicFixtureReply | undefined): { runPrompt: CrewRunPrompt; calls: () => number } {
  let calls = 0;
  const adapter = createAnthropicAdapter({
    env: {},
    fixtureResponder: () => {
      calls += 1;
      return reply?.();
    },
  });
  const meter = ctxFor(t);
  return { runPrompt: async (args) => await runPromptWithMeter(meter, args, { adapter }), calls: () => calls };
}

/** Runs a blueprint step the way the pool's `runCrewGeneratorStep` would, with the fixture gateway (no `stepDone` follows). */
async function runBlueprint(w: World, taskId: Id<"tasks">, reply?: () => AnthropicFixtureReply | undefined) {
  return await runCrewGeneratorStepWith(ctxFor(w.t), { taskId }, { runPrompt: gateway(w.t, reply).runPrompt });
}

type Rows = {
  tasks: Doc<"tasks">[];
  rosterPlans: Doc<"roster_plans">[];
  members: Doc<"crew_members">[];
  workstreams: Doc<"workstreams">[];
  documents: Doc<"documents">[];
  approvals: Doc<"approvals">[];
  /** S2b enqueue markers: a running row is a step handed to `crewWorkpool`. */
  steps: Doc<"task_steps">[];
  scheduled: { name: string; args: unknown[] }[];
};

async function rows(w: World): Promise<Rows> {
  return await w.t.run(async (ctx) => ({
    tasks: await ctx.db.query("tasks").collect(),
    rosterPlans: await ctx.db.query("roster_plans").collect(),
    members: await ctx.db.query("crew_members").collect(),
    workstreams: await ctx.db.query("workstreams").collect(),
    documents: await ctx.db.query("documents").collect(),
    approvals: await ctx.db.query("approvals").collect(),
    steps: await ctx.db.query("task_steps").collect(),
    scheduled: (await ctx.db.system.query("_scheduled_functions").collect()).map((row) => ({ name: row.name, args: row.args })),
  }));
}

const blueprintTasks = (r: Rows) => r.tasks.filter((row) => row.type === "crew_blueprint");
/** Steps on `crewWorkpool` (S2b): the blueprint is enqueued there, not scheduled. */
const enqueued = (r: Rows) => r.steps.filter((row) => row.status === "running");

const crewJobLimiter = new RateLimiter(components.rateLimiter, { crewJob: { kind: "fixed window", rate: 10, period: HOUR } });

/** `crewJob` tokens the owner has spent this hour. */
async function tokensSpent(w: World): Promise<number> {
  const value = await w.t.run(async (ctx) => await crewJobLimiter.getValue(ctx, "crewJob", { key: w.owner.userId }));
  return 10 - value.value;
}

/**
 * The blueprint the fixture client returns for HydroTrail (roster per idea,
 * WP90): HydroTrail with the consumer-app team proposal. The model-facing
 * schema (version 2) requires a team, so a test reply carries one too.
 */
const FIXTURE_BLUEPRINT: Blueprint = { ...hydrotrailBlueprint, team: FIXTURE_TEAM_PROFILES.consumer_app.team.map((entry) => ({ ...entry })) };

function expectedPlan(blueprint: Blueprint, answers: WizardAnswers = hydrotrailWizardAnswers) {
  return planRoster(rosterInputFromWizard(answers, blueprint), { leadName: "Wren" });
}

/** Starts a launch and runs its blueprint to the roster. */
async function launchToRoster(w: World, reply?: () => AnthropicFixtureReply | undefined) {
  await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
  const [blueprint] = blueprintTasks(await rows(w));
  if (blueprint === undefined) throw new Error("no blueprint task");
  const outcome = await runBlueprint(w, blueprint._id, reply);
  return { blueprint, outcome };
}

// ---------------------------------------------------------------------------

describe("WP75-S1 startLaunch → blueprint → roster", () => {
  test("HydroTrail: 9 hired and 4 skipped with the lead's reasons, every row written once, no roster card", async () => {
    const w = await world();
    const started = await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    expect(started).toEqual({ state: "assembling" });

    let r = await rows(w);
    const roster = r.tasks.find((row) => row.type === "crew_roster");
    expect(roster).toMatchObject({ status: "queued", jobKey: jobKey(w.projectId, "crew_roster", "main", 0), creditCost: 0n });
    expect(blueprintTasks(r)).toHaveLength(1);
    expect(blueprintTasks(r)[0]).toMatchObject({ status: "queued", jobKey: jobKey(w.projectId, "crew_blueprint", "main", 0) });
    // S2b: the blueprint step is enqueued on crewWorkpool (its marker); `stepDone` re-invokes its retries.
    expect(enqueued(r)).toHaveLength(1);
    expect(enqueued(r)[0]).toMatchObject({ taskId: blueprintTasks(r)[0]?._id, type: "crew_blueprint", position: 0n });
    expect(r.rosterPlans).toHaveLength(0);
    expect(await tokensSpent(w)).toBe(1);

    const outcome = await runBlueprint(w, blueprintTasks(r)[0]?._id as Id<"tasks">);
    expect(outcome).toMatchObject({ kind: "finished" });

    const plan = expectedPlan(FIXTURE_BLUEPRINT);
    expect(plan.hired).toHaveLength(9);
    expect(plan.skipped).toHaveLength(4);
    const view = await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId });
    expect(view).toEqual({
      state: "ready",
      hired: plan.hired.map(({ roleKey, employeeName, roleLabel, reason }) => ({ roleKey, employeeName, roleLabel, reason })),
      skipped: plan.skipped.map(({ roleKey, roleLabel, reason }) => ({ roleKey, roleLabel, reason })),
    });
    if (view.state !== "ready") throw new Error("not ready");
    expect(view.hired.map((role) => role.roleKey)).toEqual(
      ["lead", "brand", "landing", "seo", "marketing", "email", "social", "engineering", "ads"],
    );
    expect(view.hired.find((role) => role.roleKey === "ads")?.reason).toBe("Goal has a paid push: $7/day test");
    expect(view.skipped).toEqual([
      { roleKey: "merch", roleLabel: "Merch", reason: plan.skipped[0]?.reason },
      { roleKey: "outbound", roleLabel: "Outbound", reason: plan.skipped[1]?.reason },
      // The lead's reason (the fixture team proposal), not the rule's "No course content".
      { roleKey: "curriculum", roleLabel: "Curriculum", reason: "Nothing to teach; the app does the work" },
      { roleKey: "community", roleLabel: "Community", reason: plan.skipped[3]?.reason },
    ]);

    r = await rows(w);
    expect(r.tasks.find((row) => row.type === "crew_roster")).toMatchObject({ status: "succeeded" });
    expect(r.rosterPlans).toEqual([expect.objectContaining({
      ownerId: w.owner.userId,
      projectId: w.projectId,
      rulesVersion: ROSTER_RULES_VERSION,
      hired: plan.hired.map((entry) => entry.roleKey),
      skipped: plan.skipped.map((entry) => ({ roleKey: entry.roleKey, reason: entry.reason })),
    })]);
    expect(r.members).toHaveLength(13);
    for (const entry of plan.hired) {
      expect(r.members.find((member) => member.roleKey === entry.roleKey)).toMatchObject({
        ownerId: w.owner.userId, displayName: entry.employeeName, status: "queued", hiredBy: "rule", autopilot: false,
      });
    }
    for (const entry of plan.skipped) {
      expect(r.members.find((member) => member.roleKey === entry.roleKey)).toMatchObject({ status: "skipped", hiredBy: "rule", autopilot: false });
    }
    // One workstream per hired specialist (the Crew Lead owns none).
    expect(r.workstreams).toHaveLength(8);
    const lead = r.members.find((member) => member.roleKey === "lead");
    expect(r.workstreams.some((stream) => stream.employeeId === lead?._id)).toBe(false);
    const brand = r.members.find((member) => member.roleKey === "brand");
    expect(r.workstreams.find((stream) => stream.employeeId === brand?._id)).toMatchObject({ title: WORKSTREAM_TITLES.brand, status: "queued" });

    const rosterDocs = r.documents.filter((doc) => doc.kind === "roster_plan");
    expect(rosterDocs).toHaveLength(1);
    expect(rosterDocs[0]).toMatchObject({ format: "json", schemaVersion: "1", taskId: roster?._id });
    expect(rosterPlanSchema.parse(JSON.parse(rosterDocs[0]?.body ?? "null"))).toEqual(plan);
    // Owner ruling Q13: the team just appears. The only card is the blueprint's.
    expect(r.approvals).toHaveLength(1);
    expect(r.approvals[0]).toMatchObject({ kind: "artifact_review", subjectId: r.documents.find((doc) => doc.kind === "blueprint")?._id });
    expect(await tokensSpent(w)).toBe(1);
  });

  test("a course idea gets a different team (curriculum and community hired)", async () => {
    const w = await world({ ideaSlug: COURSE_SLUG });
    if (hydrotrailBlueprint.source !== "library") throw new Error("fixture is a library blueprint");
    const course: Blueprint = {
      ...hydrotrailBlueprint,
      ideaSlug: COURSE_SLUG,
      profile: { ideaKind: "course", buyer: "consumer", deliveryFormat: "cohort", audiencePlural: "new hikers" },
      team: [],
    };
    const { outcome } = await launchToRoster(w, () => ({ json: course }));
    expect(outcome).toMatchObject({ kind: "finished" });
    const view = await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId });
    if (view.state !== "ready") throw new Error(`not ready: ${JSON.stringify(view)}`);
    const hired = view.hired.map((role) => role.roleKey);
    expect(hired).toContain("curriculum");
    expect(hired).toContain("community");
    expect(view.skipped.map((role) => role.roleKey)).not.toContain("curriculum");
    const answers: WizardAnswers = { ...hydrotrailWizardAnswers, idea: { source: "library", ideaSlug: COURSE_SLUG } };
    expect(view.hired.map((role) => role.reason)).toEqual(expectedPlan(course, answers).hired.map((entry) => entry.reason));
    const hydro = expectedPlan(FIXTURE_BLUEPRINT).hired.map((entry) => entry.roleKey);
    expect(hired).not.toEqual(hydro);
  });

  test("the Crew Lead is named for the founder's partner", async () => {
    const answers: WizardAnswers = { ...hydrotrailWizardAnswers, partnerName: { kind: "custom", name: "Captain" } };
    const w = await world({ answers });
    await launchToRoster(w);
    const view = await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId });
    if (view.state !== "ready") throw new Error("not ready");
    expect(view.hired[0]).toMatchObject({ roleKey: "lead", employeeName: "Captain" });
  });
});

describe("WP75-S1 idempotency and tokens", () => {
  test("startLaunch twice while the blueprint runs: one launch, one enqueued step, one token", async () => {
    const w = await world();
    const first = await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    const before = await rows(w);
    const second = await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    expect(second).toEqual(first);
    const after = await rows(w);
    expect(after.tasks).toEqual(before.tasks);
    expect(enqueued(after)).toHaveLength(1);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("replay after the team exists returns the same rows and writes nothing; a replayed finish writes no second roster", async () => {
    const w = await world();
    const { blueprint } = await launchToRoster(w);
    const before = await rows(w);
    const view = await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId });
    expect(await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId })).toEqual(view);
    expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual(view);

    // The same step delivered again (a duplicate schedule): the task is terminal, so nothing runs or writes.
    expect(await runBlueprint(w, blueprint._id)).toEqual({ kind: "skipped", reason: "terminal" });
    // The finish replayed for the closed run: stale, no writes.
    const run = await w.t.run(async (ctx) => await ctx.db.query("workflow_runs").withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", blueprint._id)).first());
    if (run === null) throw new Error("no run");
    const blueprintDoc = before.documents.find((doc) => doc.kind === "blueprint");
    const replay = await w.t.mutation(internal.crew.jobs.finishCrewStep, {
      runId: run._id, promptRef: blueprintDoc?.promptRef ?? "crew-blueprint-personalise@2", outputJson: blueprintDoc?.body ?? "{}", nextAttempt: 3,
    });
    expect(replay).toEqual({ kind: "stale" });

    const after = await rows(w);
    expect(after.rosterPlans).toEqual(before.rosterPlans);
    expect(after.members).toEqual(before.members);
    expect(after.workstreams).toEqual(before.workstreams);
    expect(after.documents).toEqual(before.documents);
    expect(after.tasks).toEqual(before.tasks);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("a blueprint outside a launch (no roster task) never plans a roster", async () => {
    const w = await world();
    const { taskId } = await w.t.mutation(internal.crew.jobs.createCrewTask, {
      ownerId: w.owner.userId, projectId: w.projectId, jobType: "crew_blueprint",
    });
    expect(await runBlueprint(w, taskId)).toMatchObject({ kind: "finished" });
    const r = await rows(w);
    expect(r.rosterPlans).toHaveLength(0);
    expect(r.members).toHaveLength(0);
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId })).toEqual({ state: "not_started" });
  });

  test("a launch on a blueprint that already succeeded plans the team from it and still spends one token", async () => {
    const w = await world();
    const { taskId } = await w.t.mutation(internal.crew.jobs.createCrewTask, {
      ownerId: w.owner.userId, projectId: w.projectId, jobType: "crew_blueprint",
    });
    await runBlueprint(w, taskId);
    const spent = await tokensSpent(w);
    const view = await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    expect(view).toMatchObject({ state: "ready" });
    expect(await tokensSpent(w)).toBe(spent + 1);
    expect(blueprintTasks(await rows(w))).toHaveLength(1);
  });
});

describe("WP75-S1 a failed blueprint", () => {
  test("writes no roster, shows the retry, and only the founder's retry spends a token and starts a new first draft", async () => {
    const w = await world();
    const { blueprint, outcome } = await launchToRoster(w, () => ({ refusal: { category: "cyber" } }));
    expect(outcome).toMatchObject({ kind: "failed" });
    let r = await rows(w);
    expect(r.rosterPlans).toHaveLength(0);
    expect(r.members).toHaveLength(0);
    expect(r.workstreams).toHaveLength(0);
    expect(r.documents).toHaveLength(0);
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId }))
      .toEqual({ state: "failed", paused: false, retryable: true });

    // A reload calls startLaunch again: it shows the failure and spends nothing.
    expect(await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId }))
      .toEqual({ state: "failed", paused: false, retryable: true });
    expect(blueprintTasks(await rows(w))).toHaveLength(1);
    expect(await tokensSpent(w)).toBe(1);

    const retried = await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId });
    expect(retried).toEqual({ state: "assembling" });
    r = await rows(w);
    const drafts = blueprintTasks(r);
    expect(drafts).toHaveLength(2);
    const fresh = drafts.find((row) => row._id !== blueprint._id);
    expect(fresh).toMatchObject({ status: "queued", jobKey: blueprint.jobKey, changeRound: 0n });
    expect(fresh?.idempotencyKey).not.toBe(blueprint.idempotencyKey);
    expect(enqueued(r).map((row) => row.taskId)).toContain(fresh?._id);
    expect(await tokensSpent(w)).toBe(2);

    // A second click while the new draft is queued writes and spends nothing.
    expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual({ state: "assembling" });
    expect(blueprintTasks(await rows(w))).toHaveLength(2);
    expect(await tokensSpent(w)).toBe(2);

    expect(await runBlueprint(w, fresh?._id as Id<"tasks">)).toMatchObject({ kind: "finished" });
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId })).toMatchObject({ state: "ready" });
  });

  test("a roster that cannot be planned fails the blueprint closed: no blueprint document, no card, no roster", async () => {
    const w = await world();
    await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    const [blueprint] = blueprintTasks(await rows(w));
    if (blueprint === undefined) throw new Error("no blueprint");
    // The session's answers become unusable between the call and the finish.
    const runPrompt: CrewRunPrompt = async (args) => {
      await w.t.run(async (ctx) => await ctx.db.patch("wizard_sessions", w.wizardSessionId, { answers: {} }));
      return await gateway(w.t).runPrompt(args);
    };
    const outcome = await runCrewGeneratorStepWith(ctxFor(w.t), { taskId: blueprint._id }, { runPrompt });
    expect(outcome).toMatchObject({ kind: "failed" });
    const r = await rows(w);
    expect(r.documents).toHaveLength(0);
    expect(r.approvals).toHaveLength(0);
    expect(r.rosterPlans).toHaveLength(0);
    expect(r.tasks.find((row) => row.type === "crew_roster")).toMatchObject({ status: "queued" });
    // The answers are unusable, so no new blueprint could plan a team: no retry is offered, and one spends nothing.
    const terminal = { state: "failed", paused: false, retryable: false };
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId })).toEqual(terminal);
    for (let click = 0; click < 3; click += 1) {
      expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual(terminal);
    }
    const after = await rows(w);
    expect(after.tasks).toEqual(r.tasks);
    expect(after.scheduled).toEqual(r.scheduled);
    expect(after.steps).toEqual(r.steps);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("a paused blueprint reads as paused; the founder's retry resumes it for one token", async () => {
    const w = await world();
    await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    const [blueprint] = blueprintTasks(await rows(w));
    if (blueprint === undefined) throw new Error("no blueprint");
    await w.t.run(async (ctx) => await ctx.db.patch("tasks", blueprint._id, { status: "blocked" }));
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId })).toEqual({ state: "failed", paused: true, retryable: true });
    await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId });
    const r = await rows(w);
    expect(blueprintTasks(r)).toHaveLength(1);
    // S2b: resumed on the pool (blocked → running, enqueued with `resume: true`).
    expect(blueprintTasks(r)[0]).toMatchObject({ status: "running" });
    expect(enqueued(r).map((row) => row.taskId)).toContain(blueprint._id);
    expect(await tokensSpent(w)).toBe(2);
  });
});

describe("WP75-S1 refusals write nothing", () => {
  const refusals: { name: string; arrange: (w: World) => Promise<void>; caller: (w: World) => ReturnType<T["withIdentity"]> | T }[] = [
    { name: "a non-owner", arrange: async () => undefined, caller: (w) => as(w, w.other) },
    { name: "a signed-out caller", arrange: async () => undefined, caller: (w) => w.t },
    {
      name: "an archived business",
      arrange: async (w) => await w.t.run(async (ctx) => await ctx.db.patch("projects", w.projectId, { archivedAt: 5 })),
      caller: (w) => as(w, w.owner),
    },
    {
      name: "the workspace switched off",
      arrange: async (w) => await w.t.run(async (ctx) => await ctx.db.patch("ops_settings", w.opsId, { workspaceEnabled: false })),
      caller: (w) => as(w, w.owner),
    },
    {
      name: "AI switched off",
      arrange: async (w) => await w.t.run(async (ctx) => {
        const ops = await ctx.db.get("ops_settings", w.opsId);
        if (ops === null) throw new Error("no ops");
        await ctx.db.patch("ops_settings", w.opsId, { killSwitches: { ...ops.killSwitches, ai: true } });
      }),
      caller: (w) => as(w, w.owner),
    },
  ];

  for (const refusal of refusals) {
    test(`${refusal.name}: startLaunch, retryLaunch and launchStatus refuse`, async () => {
      const w = await world();
      await refusal.arrange(w);
      const caller = refusal.caller(w);
      await expect(caller.mutation(api.crew.roster.startLaunch, { projectId: w.projectId })).rejects.toThrow();
      await expect(caller.mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).rejects.toThrow();
      await expect(caller.query(api.crew.roster.launchStatus, { projectId: w.projectId })).rejects.toThrow();
      const r = await rows(w);
      expect(r.tasks).toHaveLength(0);
      expect(r.rosterPlans).toHaveLength(0);
      expect(r.members).toHaveLength(0);
      expect(r.scheduled).toHaveLength(0);
      expect(r.steps).toHaveLength(0);
      expect(await tokensSpent(w)).toBe(0);
    });
  }

  for (const refusal of refusals) {
    test(`${refusal.name}, after a launch whose blueprint failed: retryLaunch refuses and writes, schedules and spends nothing`, async () => {
      const w = await world();
      const { outcome } = await launchToRoster(w, () => ({ refusal: { category: "cyber" } }));
      expect(outcome).toMatchObject({ kind: "failed" });
      const before = await rows(w);
      const spent = await tokensSpent(w);
      expect(spent).toBe(1);
      await refusal.arrange(w);
      const caller = refusal.caller(w);
      await expect(caller.mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).rejects.toThrow();
      await expect(caller.mutation(api.crew.roster.startLaunch, { projectId: w.projectId })).rejects.toThrow();
      await expect(caller.query(api.crew.roster.launchStatus, { projectId: w.projectId })).rejects.toThrow();
      const after = await rows(w);
      expect(after.tasks).toEqual(before.tasks);
      expect(after.scheduled).toEqual(before.scheduled);
      expect(after.steps).toEqual(before.steps);
      expect(after.rosterPlans).toHaveLength(0);
      expect(after.members).toHaveLength(0);
      expect(await tokensSpent(w)).toBe(spent);
    });
  }

  test("the feature gates run before the business check: AI off refuses AI_DISABLED even for a non-owner", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const ops = await ctx.db.get("ops_settings", w.opsId);
      if (ops === null) throw new Error("no ops");
      await ctx.db.patch("ops_settings", w.opsId, { killSwitches: { ...ops.killSwitches, ai: true } });
    });
    await expect(as(w, w.other).mutation(api.crew.roster.startLaunch, { projectId: w.projectId })).rejects.toThrow("AI_DISABLED");
  });

  test("retryLaunch before a launch refuses LAUNCH_NOT_STARTED", async () => {
    const w = await world();
    await expect(as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).rejects.toThrow("LAUNCH_NOT_STARTED");
    expect(await tokensSpent(w)).toBe(0);
  });
});

/** A blueprint first draft run outside a launch, then a launch's roster task inserted beside it (a launch caught mid-way). */
async function storedFirstDraftWithOpenRoster(w: World) {
  const { taskId } = await w.t.mutation(internal.crew.jobs.createCrewTask, {
    ownerId: w.owner.userId, projectId: w.projectId, jobType: "crew_blueprint",
  });
  const outcome = await runBlueprint(w, taskId);
  if (outcome.kind !== "finished") throw new Error(`first draft did not finish: ${JSON.stringify(outcome)}`);
  const rosterTaskId = await w.t.run(async (ctx) => await insertLaunchRosterTask(ctx, w.owner.userId, w.projectId, Date.now()));
  return { firstDraftId: taskId, rosterTaskId };
}

/** A round-1 revision of a blueprint, inserted the way S6's change round does. */
async function insertBlueprintRevision(w: World, revisionOfTaskId: Id<"tasks">) {
  const key = jobKey(w.projectId, "crew_blueprint", "main", 1);
  return await w.t.run(async (ctx) => await ctx.db.insert("tasks", {
    ownerId: w.owner.userId, projectId: w.projectId, type: "crew_blueprint", status: "queued", title: "Blueprint",
    creditCost: 0n, changeRound: 1n, revisionOfTaskId, jobKey: key, idempotencyKey: `crew-task:${key}`,
    createdAt: Date.now(), updatedAt: Date.now(),
  }));
}

const courseBlueprint = (): Blueprint => ({
  ...hydrotrailBlueprint,
  profile: { ideaKind: "course", buyer: "consumer", deliveryFormat: "cohort", audiencePlural: "new hikers" },
  team: [],
});

describe("WP75-S1 review fixes", () => {
  test("retryLaunch while the blueprint is running writes, schedules and spends nothing", async () => {
    const w = await world();
    await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    const [blueprint] = blueprintTasks(await rows(w));
    if (blueprint === undefined) throw new Error("no blueprint");
    await w.t.run(async (ctx) => await ctx.db.patch("tasks", blueprint._id, { status: "running" }));
    const before = await rows(w);
    expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual({ state: "assembling" });
    const after = await rows(w);
    expect(after.tasks).toEqual(before.tasks);
    expect(after.scheduled).toEqual(before.scheduled);
    expect(after.steps).toEqual(before.steps);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("writeLaunchRoster on a succeeded roster task with its plan row writes nothing", async () => {
    const w = await world();
    await launchToRoster(w);
    const before = await rows(w);
    const rosterTask = before.tasks.find((row) => row.type === "crew_roster");
    if (rosterTask === undefined) throw new Error("no roster task");
    expect(before.rosterPlans).toHaveLength(1);
    const result = await w.t.run(async (ctx) => await writeLaunchRoster(ctx, rosterTask, expectedPlan(FIXTURE_BLUEPRINT), Date.now()));
    expect(result).toBe("exists");
    const after = await rows(w);
    expect(after.tasks).toEqual(before.tasks);
    expect(after.rosterPlans).toEqual(before.rosterPlans);
    expect(after.members).toEqual(before.members);
    expect(after.workstreams).toEqual(before.workstreams);
    expect(after.documents).toEqual(before.documents);
  });

  test("a plan row beside an open roster task heals for free: the row is kept, the task finishes, missing rows are added once", async () => {
    const w = await world();
    await launchToRoster(w);
    const written = await rows(w);
    const rosterTask = written.tasks.find((row) => row.type === "crew_roster");
    const brand = written.members.find((member) => member.roleKey === "brand");
    if (rosterTask === undefined || brand === undefined) throw new Error("no roster");
    // A half-finished launch: the task is open again, its document and one workstream are gone.
    await w.t.run(async (ctx) => {
      await ctx.db.patch("tasks", rosterTask._id, { status: "queued" });
      for (const doc of written.documents.filter((row) => row.kind === "roster_plan")) await ctx.db.delete("documents", doc._id);
      const stream = written.workstreams.find((row) => row.employeeId === brand._id);
      if (stream !== undefined) await ctx.db.delete("workstreams", stream._id);
    });
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId }))
      .toEqual({ state: "failed", paused: false, retryable: true });

    const healed = await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId });
    expect(healed).toMatchObject({ state: "ready" });
    const after = await rows(w);
    expect(after.tasks.find((row) => row.type === "crew_roster")).toMatchObject({ status: "succeeded" });
    expect(after.rosterPlans).toEqual(written.rosterPlans);
    expect(after.members).toEqual(written.members);
    expect(after.workstreams).toHaveLength(8);
    expect(after.workstreams.filter((row) => row.employeeId === brand._id)).toHaveLength(1);
    expect(after.documents.filter((row) => row.kind === "roster_plan")).toHaveLength(1);
    expect(blueprintTasks(after)).toHaveLength(1);
    // No second blueprint run; with the team healed, S2b's DAG goes on to the brand kit.
    const blueprintRuns = (r: Rows) => enqueued(r).filter((row) => row.type === "crew_blueprint");
    expect(blueprintRuns(after)).toEqual(blueprintRuns(written));
    expect(enqueued(after).filter((row) => row.type === "crew_brand_kit")).toHaveLength(1);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("a stored blueprint whose team cannot be planned is terminal: retries spend no token; once plannable, a free retry plans it", async () => {
    const w = await world();
    const { taskId } = await w.t.mutation(internal.crew.jobs.createCrewTask, {
      ownerId: w.owner.userId, projectId: w.projectId, jobType: "crew_blueprint",
    });
    expect(await runBlueprint(w, taskId)).toMatchObject({ kind: "finished" });
    await w.t.run(async (ctx) => await ctx.db.patch("wizard_sessions", w.wizardSessionId, { answers: {} }));
    const spentBefore = await tokensSpent(w);

    const terminal = { state: "failed", paused: false, retryable: false };
    expect(await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId })).toEqual(terminal);
    // The launch itself is the founder's one action.
    expect(await tokensSpent(w)).toBe(spentBefore + 1);
    const before = await rows(w);
    for (let click = 0; click < 3; click += 1) {
      expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual(terminal);
    }
    let after = await rows(w);
    expect(after.tasks).toEqual(before.tasks);
    expect(after.scheduled).toEqual(before.scheduled);
    expect(after.steps).toEqual(before.steps);
    expect(after.rosterPlans).toHaveLength(0);
    expect(await tokensSpent(w)).toBe(spentBefore + 1);

    await w.t.run(async (ctx) => await ctx.db.patch("wizard_sessions", w.wizardSessionId, { answers: hydrotrailWizardAnswers }));
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId }))
      .toEqual({ state: "failed", paused: false, retryable: true });
    expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toMatchObject({ state: "ready" });
    after = await rows(w);
    expect(blueprintTasks(after)).toHaveLength(1);
    expect(after.scheduled).toEqual(before.scheduled);
    // No blueprint runs again; with the team planned, S2b's DAG enqueues the brand kit (free).
    expect(after.steps.filter((row) => row.type === "crew_blueprint")).toEqual(before.steps.filter((row) => row.type === "crew_blueprint"));
    expect(enqueued(after).map((row) => row.type)).toEqual(["crew_brand_kit"]);
    expect(await tokensSpent(w)).toBe(spentBefore + 1);
  });

  test("a blueprint revision never plans a roster, even while the launch's roster task is open", async () => {
    const w = await world();
    const { firstDraftId } = await storedFirstDraftWithOpenRoster(w);
    const revisionId = await insertBlueprintRevision(w, firstDraftId);
    expect(await runBlueprint(w, revisionId, () => ({ json: courseBlueprint() }))).toMatchObject({ kind: "finished" });
    const r = await rows(w);
    expect(r.tasks.find((row) => row._id === revisionId)).toMatchObject({ status: "succeeded" });
    expect(r.rosterPlans).toHaveLength(0);
    expect(r.members).toHaveLength(0);
    expect(r.tasks.find((row) => row.type === "crew_roster")).toMatchObject({ status: "queued" });
  });

  test("the stored-blueprint path plans from the newest approved blueprint, not the first draft", async () => {
    const w = await world();
    const { firstDraftId } = await storedFirstDraftWithOpenRoster(w);
    const revisionId = await insertBlueprintRevision(w, firstDraftId);
    const revised = await runBlueprint(w, revisionId, () => ({ json: courseBlueprint() }));
    if (revised.kind !== "finished") throw new Error(`revision did not finish: ${JSON.stringify(revised)}`);
    await w.t.run(async (ctx) => await ctx.db.patch("approvals", revised.approvalId, { status: "approved", decidedAt: Date.now() }));
    const spent = await tokensSpent(w);

    const view = await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    if (view.state !== "ready") throw new Error(`not ready: ${JSON.stringify(view)}`);
    expect(view.hired.map((role) => role.roleKey)).toEqual(expectedPlan(courseBlueprint()).hired.map((entry) => entry.roleKey));
    expect(view.hired.map((role) => role.roleKey)).toContain("curriculum");
    expect(view.hired.map((role) => role.roleKey)).not.toEqual(expectedPlan(FIXTURE_BLUEPRINT).hired.map((entry) => entry.roleKey));
    // The launch already existed (its roster task), so this is a free heal.
    expect(await tokensSpent(w)).toBe(spent);
  });

  test("with no approved blueprint, the stored-blueprint path falls back to the first draft", async () => {
    const w = await world();
    await storedFirstDraftWithOpenRoster(w);
    const view = await as(w, w.owner).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    if (view.state !== "ready") throw new Error(`not ready: ${JSON.stringify(view)}`);
    expect(view.hired.map((role) => role.roleKey)).toEqual(expectedPlan(FIXTURE_BLUEPRINT).hired.map((entry) => entry.roleKey));
  });
});

/** Another business of the same owner, for the "linked to another project" guards. */
async function otherProject(w: World): Promise<Id<"projects">> {
  return await w.t.run(async (ctx) => await ctx.db.insert("projects", {
    ownerId: w.owner.userId, source: "repository_idea", title: "Other", status: "draft", idempotencyKey: "business:other",
    createdAt: 1, updatedAt: 1,
  }));
}

describe("WP75-S1 re-check fixes", () => {
  test("a heal writes only the stored row's team: a different (course) plan writes nothing; the row's own plan heals", async () => {
    const w = await world();
    const { blueprint } = await launchToRoster(w);
    const written = await rows(w);
    const row = written.rosterPlans[0];
    const rosterTask = written.tasks.find((task) => task.type === "crew_roster");
    const brand = written.members.find((member) => member.roleKey === "brand");
    if (row === undefined || rosterTask === undefined || brand === undefined) throw new Error("no roster");
    // Half-finished: the task is open again, the document and the brand workstream are gone; the HydroTrail row stays.
    await w.t.run(async (ctx) => {
      await ctx.db.patch("tasks", rosterTask._id, { status: "queued" });
      for (const doc of written.documents.filter((d) => d.kind === "roster_plan")) await ctx.db.delete("documents", doc._id);
      const stream = written.workstreams.find((ws) => ws.employeeId === brand._id);
      if (stream !== undefined) await ctx.db.delete("workstreams", stream._id);
    });
    const half = await rows(w);

    // The founder approves a course revision: its plan is not the row's team.
    const revisionId = await insertBlueprintRevision(w, blueprint._id);
    const revised = await runBlueprint(w, revisionId, () => ({ json: courseBlueprint() }));
    if (revised.kind !== "finished") throw new Error(`revision did not finish: ${JSON.stringify(revised)}`);
    await w.t.run(async (ctx) => await ctx.db.patch("approvals", revised.approvalId, { status: "approved", decidedAt: Date.now() }));
    const course = expectedPlan(courseBlueprint());
    expect(rosterPlanMatchesRow(course, row)).toBe(false);

    // Directly: a conflict, with no writes and the task left open.
    const openTask = await w.t.run(async (ctx) => await ctx.db.get("tasks", rosterTask._id));
    if (openTask === null) throw new Error("no task");
    expect(await w.t.run(async (ctx) => await writeLaunchRoster(ctx, openTask, course, Date.now()))).toBe("conflict");
    // Through the founder's retry: the same, and the page offers no retry.
    const terminal = { state: "failed", paused: false, retryable: false };
    expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual(terminal);
    expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId })).toEqual(terminal);
    let after = await rows(w);
    expect(after.tasks.find((task) => task._id === rosterTask._id)).toMatchObject({ status: "queued" });
    expect(after.rosterPlans).toEqual(half.rosterPlans);
    expect(after.members).toEqual(half.members);
    expect(after.workstreams).toEqual(half.workstreams);
    expect(after.documents.filter((d) => d.kind === "roster_plan")).toHaveLength(0);

    // The row's own team (the first draft once the course approval is withdrawn) heals it, and everything matches the row.
    await w.t.run(async (ctx) => await ctx.db.patch("approvals", revised.approvalId, { status: "pending" }));
    const view = await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId });
    if (view.state !== "ready") throw new Error(`not ready: ${JSON.stringify(view)}`);
    expect(view.hired.map((role) => role.roleKey)).toEqual(row.hired);
    expect(view.skipped.map(({ roleKey, reason }) => ({ roleKey, reason }))).toEqual(row.skipped);
    after = await rows(w);
    expect(after.rosterPlans).toEqual([row]);
    expect(after.members.filter((m) => m.status !== "skipped").map((m) => m.roleKey).sort()).toEqual([...row.hired].sort());
    expect(after.members.filter((m) => m.status === "skipped").map((m) => m.roleKey).sort())
      .toEqual(row.skipped.map((entry) => entry.roleKey).sort());
    const hiredIds = new Set(after.members.filter((m) => row.hired.includes(m.roleKey) && m.roleKey !== "lead").map((m) => m._id));
    expect(after.workstreams).toHaveLength(hiredIds.size);
    expect(after.workstreams.every((ws) => hiredIds.has(ws.employeeId))).toBe(true);
    expect(await tokensSpent(w)).toBe(1);
  });

  test("a heal with the roster document already there adds no second document", async () => {
    const w = await world();
    await launchToRoster(w);
    const written = await rows(w);
    const rosterTask = written.tasks.find((task) => task.type === "crew_roster");
    const brand = written.members.find((member) => member.roleKey === "brand");
    if (rosterTask === undefined || brand === undefined) throw new Error("no roster");
    await w.t.run(async (ctx) => {
      await ctx.db.patch("tasks", rosterTask._id, { status: "queued" });
      const stream = written.workstreams.find((ws) => ws.employeeId === brand._id);
      if (stream !== undefined) await ctx.db.delete("workstreams", stream._id);
    });
    const openTask = await w.t.run(async (ctx) => await ctx.db.get("tasks", rosterTask._id));
    if (openTask === null) throw new Error("no task");
    expect(await w.t.run(async (ctx) => await writeLaunchRoster(ctx, openTask, expectedPlan(FIXTURE_BLUEPRINT), Date.now())))
      .toBe("healed");
    const after = await rows(w);
    expect(after.documents.filter((d) => d.kind === "roster_plan")).toEqual(written.documents.filter((d) => d.kind === "roster_plan"));
    expect(after.workstreams).toHaveLength(8);
  });

  const sessionGuards: { name: string; arrange: (w: World) => Promise<void> }[] = [
    {
      name: "owned by someone else",
      arrange: async (w) => await w.t.run(async (ctx) => await ctx.db.patch("wizard_sessions", w.wizardSessionId, { ownerId: w.other.userId })),
    },
    {
      name: "linked to another project",
      arrange: async (w) => {
        const elsewhere = await otherProject(w);
        await w.t.run(async (ctx) => await ctx.db.patch("wizard_sessions", w.wizardSessionId, { projectId: elsewhere }));
      },
    },
    {
      name: "abandoned",
      arrange: async (w) => await w.t.run(async (ctx) => await ctx.db.patch("wizard_sessions", w.wizardSessionId, { abandonedAt: 3 })),
    },
  ];

  for (const guard of sessionGuards) {
    test(`a wizard session ${guard.name} plans no team`, async () => {
      const w = await world();
      await storedFirstDraftWithOpenRoster(w);
      await guard.arrange(w);
      const terminal = { state: "failed", paused: false, retryable: false };
      expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId })).toEqual(terminal);
      expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual(terminal);
      const r = await rows(w);
      expect(r.rosterPlans).toHaveLength(0);
      expect(r.members).toHaveLength(0);
    });
  }

  const documentGuards: { name: string; patch: (w: World) => Promise<Partial<Doc<"documents">>> }[] = [
    { name: "another owner's", patch: async (w) => ({ ownerId: w.other.userId }) },
    { name: "another project's", patch: async (w) => ({ projectId: await otherProject(w) }) },
    { name: "not a blueprint", patch: async () => ({ kind: "brief" }) },
  ];

  for (const guard of documentGuards) {
    test(`the first-draft fallback ignores a document that is ${guard.name}`, async () => {
      const w = await world();
      const { firstDraftId } = await storedFirstDraftWithOpenRoster(w);
      const patch = await guard.patch(w);
      await w.t.run(async (ctx) => {
        const doc = await ctx.db.query("documents").withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", firstDraftId)).first();
        if (doc === null) throw new Error("no first-draft document");
        await ctx.db.patch("documents", doc._id, patch);
      });
      const terminal = { state: "failed", paused: false, retryable: false };
      expect(await as(w, w.owner).query(api.crew.roster.launchStatus, { projectId: w.projectId })).toEqual(terminal);
      expect(await as(w, w.owner).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId })).toEqual(terminal);
      expect((await rows(w)).rosterPlans).toHaveLength(0);
    });
  }
});
