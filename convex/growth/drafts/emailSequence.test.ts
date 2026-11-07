/// <reference types="vite/client" />
/**
 * WP76-S1a. The email sequence step through the launch DAG on `crewWorkpool`
 * in convex-test, fixture mode, with the REAL registry, C-METER, ledger,
 * approvals and limiter: no provider is ever called. The pool's action is the
 * real generator step with a fixture adapter (`../../crew/launch.test.ts`
 * pattern); a test can script one call's reply or a change just before it.
 */
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, components, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import schema from "../../schema";
import { runPromptWithMeter } from "../../ai/gatewayActions";
import { createAnthropicAdapter } from "../../ai/providers/anthropic";
import type { AnthropicFixtureReply } from "../../ai/providers/fixtures";
import { isSubjectUnchangedSince } from "../../../lib/workspace/contracts/approvals";
import { EMAIL_KINDS, emailsInOrder, type EmailSequence } from "../../../lib/workspace/contracts/artifacts";
import { hydrotrailEmailSequence, hydrotrailWizardAnswers } from "../../../lib/workspace/contracts/fixtures/hydrotrail";
import { emailStepContent } from "../../../lib/workspace/growth/emailDraft";
import { runCrewGeneratorStepWith, type CrewGeneratorCtx } from "../../crew/generators";
import { BRAND_KIT_CHANGED_REASON, EMAIL_BRIEF_CHANGED_REASON, EMAIL_DRAFT_CONFLICT_REASON } from "../../crew/launch";
import { SEQUENCES_READ_MAX } from "./emailSequence";
import type { CrewStepOutcome } from "../../crew/runner";
import { readSubjectState } from "../../workspace/approvals";

type Plan = {
  readonly prelude?: () => Promise<void>;
  readonly reply?: () => AnthropicFixtureReply | undefined;
  readonly before?: () => Promise<void>;
};

type PlanFor = (call: { taskId: string; type: string }) => Plan;

const hooks = vi.hoisted(() => ({
  plan: (() => ({})) as PlanFor,
  calls: [] as { taskId: string; type: string }[],
  /** Each provider request the fixture client saw, by task type. */
  requests: [] as { type: string; request: unknown }[],
  readType: (async () => "unknown") as (taskId: string) => Promise<string>,
}));

vi.mock("../../crew/generators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../crew/generators")>();
  const { internalAction } = await import("../../_generated/server");
  const runner = await import("../../crew/runner");
  const meter = await import("../../ai/gatewayActions");
  const anthropic = await import("../../ai/providers/anthropic");
  return {
    ...actual,
    runCrewGeneratorStep: internalAction({
      args: actual.runCrewGeneratorStepArgs,
      returns: runner.crewStepOutcomeValidator,
      handler: async (ctx, args): Promise<CrewStepOutcome> => {
        const type = await hooks.readType(args.taskId);
        hooks.calls.push({ taskId: args.taskId, type });
        const plan = hooks.plan({ taskId: args.taskId, type });
        await plan.prelude?.();
        const adapter = anthropic.createAnthropicAdapter({ env: {}, fixtureResponder: (request) => {
          hooks.requests.push({ type, request });
          return plan.reply?.();
        } });
        return await actual.runCrewGeneratorStepWith(ctx, args, {
          runPrompt: async (promptArgs) => {
            await plan.before?.();
            return await meter.runPromptWithMeter(ctx, promptArgs, { adapter });
          },
        });
      },
    }),
  };
});

/** WP76-S2a: each module loads once, so the social pack running beside the email never bypasses the mock (`../../crew/launch.test.ts`). */
function onceEach(glob: Record<string, () => Promise<unknown>>): Record<string, () => Promise<unknown>> {
  return Object.fromEntries(Object.entries(glob).map(([key, load]) => {
    let loaded: Promise<unknown> | null = null;
    return [key, () => (loaded ??= load())];
  }));
}

const modules = onceEach(import.meta.glob("/convex/**/*.ts"));

type T = TestConvex<typeof schema>;

beforeEach(() => {
  vi.useFakeTimers();
  hooks.plan = () => ({});
  hooks.calls = [];
  hooks.requests = [];
});
afterEach(() => {
  vi.useRealTimers();
});

type Person = { readonly userId: Id<"users">; readonly sessionId: Id<"authSessions"> };
type World = { readonly t: T; readonly owner: Person; readonly opsId: Id<"ops_settings">; readonly projectId: Id<"projects"> };

async function person(t: T, email: string): Promise<Person> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, emailVerificationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

async function world(): Promise<World> {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  registerWorkpool(t, "crewWorkpool");
  hooks.readType = async (taskId) =>
    (await t.run(async (ctx) => await ctx.db.get("tasks", taskId as Id<"tasks">)))?.type ?? "missing";
  const owner = await person(t, "owner@example.test");
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true }, updatedAt: 1,
    });
    const wizardSessionId = await ctx.db.insert("wizard_sessions", {
      ownerId: owner.userId, ideaSlug: "hydrotrail", step: "partner_name", answers: hydrotrailWizardAnswers,
      startedAt: 1, updatedAt: 1, completedAt: 2,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId: owner.userId, source: "repository_idea", title: "HydroTrail", status: "draft", idempotencyKey: "business:hydrotrail",
      workspace: {
        version: 1, name: "HydroTrail", slug: "hydrotrail", ideaSlug: "hydrotrail", platform: "web", commercialModel: "free",
        goal: "waitlist", partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
      },
      createdAt: 1, updatedAt: 1,
    });
    await ctx.db.patch("wizard_sessions", wizardSessionId, { projectId });
    return { opsId, projectId };
  });
  return { t, owner, ...ids };
}

const as = (w: World, who: Person = w.owner) =>
  w.t.withIdentity({ subject: `${who.userId}|${who.sessionId}`, issuer: "https://local.test" });

async function drain(w: World): Promise<void> {
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function launch(w: World): Promise<void> {
  await as(w).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
  await drain(w);
}

type Rows = {
  tasks: Doc<"tasks">[];
  documents: Doc<"documents">[];
  approvals: Doc<"approvals">[];
  runs: Doc<"workflow_runs">[];
  sequences: Doc<"sequences">[];
  steps: Doc<"sequence_steps">[];
};

async function rows(w: World): Promise<Rows> {
  return await w.t.run(async (ctx) => ({
    tasks: await ctx.db.query("tasks").collect(),
    documents: await ctx.db.query("documents").collect(),
    approvals: await ctx.db.query("approvals").collect(),
    runs: await ctx.db.query("workflow_runs").collect(),
    sequences: await ctx.db.query("sequences").collect(),
    steps: await ctx.db.query("sequence_steps").collect(),
  }));
}

const ofType = (r: Rows, type: Doc<"tasks">["type"]) => r.tasks.filter((row) => row.type === type);
const stepsOf = (r: Rows, sequenceId: Id<"sequences">) =>
  r.steps.filter((row) => row.sequenceId === sequenceId).sort((a, b) => Number(a.order - b.order));

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

/** Runs one generator step directly (a revision, a replay) with the fixture gateway and an optional scripted reply. */
async function runStep(w: World, taskId: Id<"tasks">, reply?: () => AnthropicFixtureReply | undefined): Promise<CrewStepOutcome> {
  const adapter = createAnthropicAdapter({ env: {}, fixtureResponder: () => reply?.() });
  const meter = ctxFor(w.t);
  return await runCrewGeneratorStepWith(ctxFor(w.t), { taskId }, {
    runPrompt: async (args) => await runPromptWithMeter(meter, args, { adapter }),
  });
}

/** A changed sequence for a revision: every subject reworded. */
function revisedSequence(): EmailSequence {
  const next: EmailSequence = JSON.parse(JSON.stringify(hydrotrailEmailSequence)) as EmailSequence;
  for (const kind of EMAIL_KINDS) next.emails[kind].subject = `${next.emails[kind].subject} (revised)`;
  next.emails.value.delayHours = 24;
  return next;
}

/** The founder approves a card (status only, as `decideApproval` records it). */
async function approve(w: World, approvalId: Id<"approvals">): Promise<void> {
  await w.t.run(async (ctx) => await ctx.db.patch("approvals", approvalId, { status: "approved", decidedAt: Date.now() }));
}

const cardOn = (r: Rows, documentId: Id<"documents">) => r.approvals.filter((row) => row.subjectId === documentId);

/** After a launch: approve the blueprint and brand kit, then ask for changes on the email card. Returns the revision task. */
async function emailRevision(w: World, approved: readonly ("blueprint" | "brand_kit")[] = ["blueprint", "brand_kit"]): Promise<Id<"tasks">> {
  const r = await rows(w);
  for (const kind of approved) {
    const document = r.documents.find((row) => row.kind === kind);
    const card = document === undefined ? undefined : cardOn(r, document._id)[0];
    if (card === undefined) throw new Error(`no ${kind} card`);
    await approve(w, card._id);
  }
  const emailDoc = r.documents.find((row) => row.kind === "email_sequence");
  const card = emailDoc === undefined ? undefined : cardOn(r, emailDoc._id)[0];
  if (card === undefined) throw new Error("no email card");
  const result = await as(w).mutation(api.workspace.approvals.decideApproval, {
    projectId: w.projectId, approvalId: card._id, decision: "request_changes", note: "Shorter subjects, please",
  });
  if (result.changeRound?.outcome !== "free") throw new Error(`expected a free round, got ${JSON.stringify(result)}`);
  return result.changeRound.taskId;
}

const view = async (w: World, who: Person = w.owner, projectId: Id<"projects"> = w.projectId) =>
  await as(w, who).query(api.growth.drafts.emailSequence.emailSequenceDraft, { projectId });

const progress = async (w: World) => await as(w).query(api.crew.launch.launchProgress, { projectId: w.projectId });

const crewJobLimiter = new RateLimiter(components.rateLimiter, { crewJob: { kind: "fixed window", rate: 10, period: HOUR } });
const limiterState = async (w: World) =>
  await w.t.run(async (ctx) => await crewJobLimiter.getValue(ctx, "crewJob", { key: w.owner.userId }));

/** A second business of the same owner (it shares the first one's wizard session; nothing launches it). */
async function secondProject(w: World): Promise<Id<"projects">> {
  return await w.t.run(async (ctx) => {
    const first = await ctx.db.get("projects", w.projectId);
    if (first?.workspace === undefined) throw new Error("no first business");
    return await ctx.db.insert("projects", {
      ownerId: w.owner.userId, source: "repository_idea", title: "Other", status: "draft", idempotencyKey: "business:other",
      workspace: { ...first.workspace, name: "Other", slug: "other" }, createdAt: 2, updatedAt: 2,
    });
  });
}

/** A document's newest card. */
async function newestCard(w: World, kind: "blueprint" | "brand_kit"): Promise<{ document: Doc<"documents">; card: Doc<"approvals"> }> {
  const r = await rows(w);
  const document = r.documents.find((row) => row.kind === kind);
  const card = document === undefined ? undefined : cardOn(r, document._id).sort((a, b) => b._creationTime - a._creationTime)[0];
  if (document === undefined || card === undefined) throw new Error(`no ${kind} card`);
  return { document, card };
}

/** Writes nothing for the email: no document, and the sequences and steps are exactly `expected`. */
async function expectNothingWritten(w: World, expected: { sequences: Doc<"sequences">[]; steps: Doc<"sequence_steps">[] } = { sequences: [], steps: [] }) {
  const r = await rows(w);
  const [email] = ofType(r, "crew_email_sequence");
  expect(email).toMatchObject({ status: "failed" });
  expect(r.runs.filter((run) => run.taskId === email?._id).map((run) => [run.status, run.errorCode])).toEqual([["failed", "permanent"]]);
  expect(r.documents.filter((row) => row.kind === "email_sequence")).toEqual([]);
  expect(r.sequences).toEqual(expected.sequences);
  expect(r.steps).toEqual(expected.steps);
}

/** Runs the launch with `seed` applied just before the email's gateway call (after its preflight). */
async function launchWithMidEmail(w: World, seed: () => Promise<void>): Promise<void> {
  hooks.plan = ({ type }) => (type === "crew_email_sequence" ? { before: seed } : {});
  await launch(w);
}

// ---------------------------------------------------------------------------

describe("WP76-S1a HydroTrail launch writes the email sequence draft", () => {
  test("the document, one draft sequence and four steps in order, one artifact_review card, nothing sent", async () => {
    const w = await launch_(await world());
    const r = await rows(w);
    const [email] = ofType(r, "crew_email_sequence");
    expect(email).toMatchObject({ status: "succeeded", employeeKey: "email", changeRound: 0n, creditCost: 0n });
    const documents = r.documents.filter((row) => row.kind === "email_sequence");
    expect(documents).toHaveLength(1);
    const document = documents[0] as Doc<"documents">;
    expect(document).toMatchObject({ taskId: email?._id, promptRef: "crew-email-sequence@1", format: "json" });

    expect(r.sequences).toHaveLength(1);
    const sequence = r.sequences[0] as Doc<"sequences">;
    expect(sequence).toMatchObject({ status: "draft", title: hydrotrailEmailSequence.name, ownerId: w.owner.userId, projectId: w.projectId });
    const steps = stepsOf(r, sequence._id);
    expect(steps.map((step) => [step.order, step.delayHours, step.subject, step.documentId])).toEqual(
      emailsInOrder(hydrotrailEmailSequence).map(({ email: entry }, order) => [BigInt(order), entry.delayHours, entry.subject, document._id]),
    );
    for (const step of steps) expect(step.approvalId).toBeUndefined();
    // Every step reads back through the WP79 helper.
    expect(steps.map((step) => emailStepContent(step, document).ok)).toEqual([true, true, true, true]);

    // One artifact_review card, on the document; no send approval anywhere.
    const cards = cardOn(r, document._id);
    expect(cards).toEqual([expect.objectContaining({ kind: "artifact_review", status: "pending", subjectTable: "documents" })]);
    expect(r.approvals.filter((row) => row.kind === "send")).toEqual([]);
    // C-APPROVAL's version policy sees the sequence, its steps and their document unchanged at the card.
    const state = await w.t.run(async (ctx) => await readSubjectState(ctx, w.owner.userId, w.projectId, "sequences", sequence._id));
    if (!state.found) throw new Error("sequence subject not found");
    expect(isSubjectUnchangedSince(state.writeTimes, (cards[0] as Doc<"approvals">).createdAt)).toBe(true);
  });

  test("the prompt quotes the blueprint, the kit's name and voice and the answers as data blocks; never the palette", async () => {
    await launch_(await world());
    const emailRequests = hooks.requests.filter((entry) => entry.type === "crew_email_sequence");
    expect(emailRequests).toHaveLength(1);
    const request = emailRequests[0]?.request as { system?: unknown; messages?: unknown };
    const user = JSON.stringify(request.messages ?? []);
    for (const tag of ["blueprint", "brand", "founder_answers"]) expect(user).toContain(`<${tag}>`);
    expect(user).toContain("Trail-tested");
    expect(user).not.toContain("#1F4E5F");
    expect(JSON.stringify(request.system ?? "")).not.toContain("Trail-tested");
  });

  test("the step runs only after the brand kit: a failed kit leaves it queued, never run, with no rows", async () => {
    const w = await world();
    hooks.plan = ({ type }) => (type === "crew_brand_kit" ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
    await launch(w);
    const r = await rows(w);
    expect(ofType(r, "crew_brand_kit")[0]).toMatchObject({ status: "failed" });
    expect(ofType(r, "crew_email_sequence")[0]).toMatchObject({ status: "queued" });
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_brand_kit"]);
    expect(r.sequences).toEqual([]);
    expect(r.steps).toEqual([]);
    const progress = await as(w).query(api.crew.launch.launchProgress, { projectId: w.projectId });
    expect(progress.steps.find((step) => step.key === "email_sequence")?.state).toBe("waiting");
  });
});

describe("WP76-S1a writes nothing on a failed step", () => {
  test("a refusal writes no document, no sequence and no step", async () => {
    const w = await world();
    hooks.plan = ({ type }) => (type === "crew_email_sequence" ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
    await launch(w);
    const r = await rows(w);
    expect(ofType(r, "crew_email_sequence")[0]).toMatchObject({ status: "failed" });
    expect(r.documents.filter((row) => row.kind === "email_sequence")).toEqual([]);
    expect(r.sequences).toEqual([]);
    expect(r.steps).toEqual([]);
  });

  test("an invalid output (a URL in a body) writes nothing", async () => {
    const w = await world();
    const bad: EmailSequence = JSON.parse(JSON.stringify(hydrotrailEmailSequence)) as EmailSequence;
    bad.emails.offer.body = "Hi {first name},\n\nSign up at https://hydrotrail.example.com today.\n\nJohn";
    hooks.plan = ({ type }) => (type === "crew_email_sequence" ? { reply: () => ({ json: bad }) } : {});
    await launch(w);
    const r = await rows(w);
    expect(ofType(r, "crew_email_sequence")[0]).toMatchObject({ status: "failed" });
    expect(r.documents.filter((row) => row.kind === "email_sequence")).toEqual([]);
    expect(r.sequences).toEqual([]);
    expect(r.steps).toEqual([]);
  });

  test("a brand kit changed between prepare and finish fails the step closed", async () => {
    const w = await world();
    hooks.plan = ({ type }) => (type === "crew_email_sequence"
      ? {
        before: async () => {
          await w.t.run(async (ctx) => {
            const kit = (await ctx.db.query("documents").collect()).find((row) => row.kind === "brand_kit");
            const card = kit === undefined ? undefined : (await ctx.db.query("approvals").collect()).find((row) => row.subjectId === kit._id);
            if (kit === undefined || card === undefined) throw new Error("no kit card");
            // Edited after its card (the fake clock can move inside a finish, so measure from the card).
            await ctx.db.patch("documents", kit._id, { updatedAt: Math.max(kit.updatedAt, card.createdAt) + 1 });
          });
        },
      }
      : {});
    await launch(w);
    const r = await rows(w);
    expect(ofType(r, "crew_email_sequence")[0]).toMatchObject({ status: "failed" });
    expect(r.documents.filter((row) => row.kind === "email_sequence")).toEqual([]);
    expect(r.sequences).toEqual([]);
  });

  test("two draft sequences appearing after preflight fail closed at the finish: no document, no write, permanent", async () => {
    const w = await world();
    await launchWithMidEmail(w, async () => {
      await w.t.run(async (ctx) => {
        for (const title of ["one", "two"]) {
          await ctx.db.insert("sequences", { ownerId: w.owner.userId, projectId: w.projectId, status: "draft", title, createdAt: 1, updatedAt: 1 });
        }
      });
    });
    const r = await rows(w);
    expect(hooks.requests.filter((entry) => entry.type === "crew_email_sequence")).toHaveLength(1);
    await expectNothingWritten(w, { sequences: r.sequences, steps: [] });
    expect(r.sequences.map((row) => [row.title, row.updatedAt])).toEqual([["one", 1], ["two", 1]]);
    expect(await view(w)).toEqual({ state: "unavailable" });
  });

  test("two drafts already there fail at preflight: no gateway call, no token, not retryable, a plain reason", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      for (const title of ["one", "two"]) {
        await ctx.db.insert("sequences", { ownerId: w.owner.userId, projectId: w.projectId, status: "draft", title, createdAt: 1, updatedAt: 1 });
      }
    });
    await as(w).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    const afterStart = await limiterState(w);
    await drain(w);
    expect(hooks.calls.map((call) => call.type)).toContain("crew_email_sequence");
    expect(hooks.requests.filter((entry) => entry.type === "crew_email_sequence")).toEqual([]);
    const usage = await w.t.run(async (ctx) => await ctx.db.query("ai_usage").collect());
    const emailTask = ofType(await rows(w), "crew_email_sequence")[0];
    expect(usage.filter((row) => row.taskId === emailTask?._id)).toEqual([]);
    await expectNothingWritten(w, { sequences: (await rows(w)).sequences, steps: [] });
    expect(await limiterState(w)).toEqual(afterStart);
    expect((await progress(w)).steps.find((step) => step.key === "email_sequence"))
      .toMatchObject({ state: "failed", retryable: false, reason: EMAIL_DRAFT_CONFLICT_REASON });
    // Try again has nothing it can help: no token, no new task.
    const tasksBefore = (await rows(w)).tasks;
    const limiterBefore = await limiterState(w);
    await as(w).mutation(api.crew.roster.retryLaunch, { projectId: w.projectId });
    expect(await limiterState(w)).toEqual(limiterBefore);
    expect((await rows(w)).tasks).toEqual(tasksBefore);
  });

  test.each([
    ["a fifth step", [0, 1, 2, 3, 4], false],
    ["a duplicate order", [0, 0], false],
    ["a step from another business", [0], true],
  ] as const)("a draft with %s fails closed at the finish", async (_label, orders, foreign) => {
    const w = await world();
    await launchWithMidEmail(w, async () => {
      const otherId = foreign ? await secondProject(w) : w.projectId;
      await w.t.run(async (ctx) => {
        const kit = (await ctx.db.query("documents").collect()).find((row) => row.kind === "brand_kit");
        if (kit === undefined) throw new Error("no kit");
        const sequenceId = await ctx.db.insert("sequences", { ownerId: w.owner.userId, projectId: w.projectId, status: "draft", title: "Old", createdAt: 1, updatedAt: 1 });
        for (const order of orders) {
          await ctx.db.insert("sequence_steps", {
            ownerId: w.owner.userId, projectId: otherId, sequenceId, order: BigInt(order), delayHours: 1, subject: "Old",
            documentId: kit._id, createdAt: 1, updatedAt: 1,
          });
        }
      });
    });
    const r = await rows(w);
    expect(r.sequences.map((row) => [row.title, row.updatedAt])).toEqual([["Old", 1]]);
    await expectNothingWritten(w, { sequences: r.sequences, steps: r.steps });
    expect(r.steps.every((row) => row.subject === "Old" && row.updatedAt === 1)).toBe(true);
  });

  test(`more than SEQUENCES_READ_MAX (${SEQUENCES_READ_MAX}) sequences fail closed`, async () => {
    const w = await world();
    await launchWithMidEmail(w, async () => {
      await w.t.run(async (ctx) => {
        for (let i = 0; i <= SEQUENCES_READ_MAX; i += 1) {
          await ctx.db.insert("sequences", { ownerId: w.owner.userId, projectId: w.projectId, status: "approved", title: `old ${i}`, createdAt: 1, updatedAt: 1 });
        }
      });
    });
    const r = await rows(w);
    expect(r.sequences).toHaveLength(SEQUENCES_READ_MAX + 1);
    await expectNothingWritten(w, { sequences: r.sequences, steps: [] });
  });

  test.each([
    ["a subject", (next: EmailSequence): void => void (next.emails.value.subject = "Plans at hydrotrail.shop")],
    ["a CTA label", (next: EmailSequence): void => void (next.emails.offer.cta = { label: "Open hydrotrail.app", target: "site" })],
  ] as const)("a link in %s fails the quality gate: nothing is stored", async (_label, edit) => {
    const w = await world();
    const linked: EmailSequence = JSON.parse(JSON.stringify(hydrotrailEmailSequence)) as EmailSequence;
    edit(linked);
    hooks.plan = ({ type }) => (type === "crew_email_sequence" ? { reply: () => ({ json: linked }) } : {});
    await launch(w);
    await expectNothingWritten(w);
  });

  test("the email's blueprint brief is re-checked at the finish", async () => {
    const w = await world();
    await launchWithMidEmail(w, async () => {
      const { document, card } = await newestCard(w, "blueprint");
      await w.t.run(async (ctx) => await ctx.db.patch("documents", document._id, { updatedAt: Math.max(document.updatedAt, card.createdAt) + 1 }));
    });
    await expectNothingWritten(w);
  });

  test("an email finish without its blueprint or brand kit id fails as permanent", async () => {
    for (const ids of ["none", "brief only", "kit only"] as const) {
      const w = await world();
      hooks.plan = ({ type }) => (type === "crew_email_sequence" ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
      await launch(w);
      const blueprint = await newestCard(w, "blueprint");
      const kit = await newestCard(w, "brand_kit");
      const { taskId } = await w.t.mutation(internal.crew.jobs.createCrewTask, {
        ownerId: w.owner.userId, projectId: w.projectId, jobType: "crew_email_sequence", employeeKey: "email",
      });
      const started = await w.t.mutation(internal.crew.jobs.startCrewRun, { taskId });
      if (started.kind !== "run") throw new Error(`expected a run, got ${JSON.stringify(started)}`);
      const outcome = await w.t.mutation(internal.crew.jobs.finishCrewStep, {
        runId: started.runId, promptRef: "crew-email-sequence@1", outputJson: JSON.stringify(hydrotrailEmailSequence),
        nextAttempt: started.attempt + 1,
        ...(ids === "brief only" ? { briefDocumentId: blueprint.document._id } : {}),
        ...(ids === "kit only" ? { brandKitDocumentId: kit.document._id } : {}),
      });
      expect(outcome).toMatchObject({ kind: "failed" });
      const r = await rows(w);
      expect(r.runs.find((run) => run._id === started.runId)).toMatchObject({ status: "failed", errorCode: "permanent" });
      expect(r.documents.filter((row) => row.kind === "email_sequence")).toEqual([]);
      expect(r.sequences).toEqual([]);
    }
  });

  test("a failed email reports why a retry cannot help: the blueprint changed, or the brand kit changed", async () => {
    const w = await world();
    hooks.plan = ({ type }) => (type === "crew_email_sequence" ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
    await launch(w);
    const emailStep = async () => (await progress(w)).steps.find((step) => step.key === "email_sequence");
    expect(await emailStep()).toMatchObject({ state: "failed", retryable: true });

    const blueprint = await newestCard(w, "blueprint");
    await w.t.run(async (ctx) => await ctx.db.patch("approvals", blueprint.card._id, { status: "changes_requested" }));
    expect(await emailStep()).toMatchObject({ state: "failed", retryable: false, reason: EMAIL_BRIEF_CHANGED_REASON });

    await w.t.run(async (ctx) => await ctx.db.patch("approvals", blueprint.card._id, { status: "pending" }));
    const kit = await newestCard(w, "brand_kit");
    await w.t.run(async (ctx) => await ctx.db.patch("approvals", kit.card._id, { status: "changes_requested" }));
    expect(await emailStep()).toMatchObject({ state: "failed", retryable: false, reason: BRAND_KIT_CHANGED_REASON });
  });
});

describe("WP76-S1a replay and revisions", () => {
  test("replay is idempotent: a finished step skips, and nothing is written twice", async () => {
    const w = await launch_(await world());
    const before = await rows(w);
    const [email] = ofType(before, "crew_email_sequence");
    if (email === undefined) throw new Error("no email task");
    expect(await runStep(w, email._id)).toEqual({ kind: "skipped", reason: "terminal" });
    const run = before.runs.find((row) => row.taskId === email._id);
    if (run === undefined) throw new Error("no run");
    expect(await w.t.mutation(internal.crew.jobs.finishCrewStep, {
      runId: run._id, promptRef: "crew-email-sequence@1", outputJson: JSON.stringify(hydrotrailEmailSequence), nextAttempt: 3,
    })).toEqual({ kind: "stale" });
    await as(w).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    await drain(w);
    const after = await rows(w);
    expect(after.sequences).toEqual(before.sequences);
    expect(after.steps).toEqual(before.steps);
    expect(after.documents).toEqual(before.documents);
  });

  test("a revision repoints the draft's steps to the new document, in place, in the same transaction", async () => {
    const w = await launch_(await world());
    const before = await rows(w);
    const draft = before.sequences[0] as Doc<"sequences">;
    const stepIds = stepsOf(before, draft._id).map((step) => step._id);
    const revisionId = await emailRevision(w);
    const outcome = await runStep(w, revisionId, () => ({ json: revisedSequence() }));
    if (outcome.kind !== "finished") throw new Error(`revision did not finish: ${JSON.stringify(outcome)}`);

    const after = await rows(w);
    expect(after.sequences.map((row) => row._id)).toEqual([draft._id]);
    const sequence = after.sequences[0] as Doc<"sequences">;
    expect(sequence.status).toBe("draft");
    const steps = stepsOf(after, draft._id);
    expect(steps.map((step) => step._id)).toEqual(stepIds);
    expect(steps.every((step) => step.documentId === outcome.documentId)).toBe(true);
    expect(steps.map((step) => [step.subject, step.delayHours])).toEqual(
      emailsInOrder(revisedSequence()).map(({ email: entry }) => [entry.subject, entry.delayHours]),
    );
    const document = after.documents.find((row) => row._id === outcome.documentId);
    if (document === undefined) throw new Error("no revised document");
    expect(steps.every((step) => step.updatedAt === document.createdAt && sequence.updatedAt === document.createdAt)).toBe(true);
    const ready = await view(w);
    if (ready.state !== "ready") throw new Error("view not ready");
    expect(ready.emails.map((entry) => entry.subject)).toEqual(EMAIL_KINDS.map((kind) => revisedSequence().emails[kind].subject));
    expect(ready.card).toMatchObject({ status: "pending", changeRound: 1n, approvalId: outcome.approvalId });
  });

  test("an email revision refuses when the brand kit is not approved", async () => {
    const w = await launch_(await world());
    const before = await rows(w);
    const revisionId = await emailRevision(w, ["blueprint"]);
    const outcome = await runStep(w, revisionId, () => ({ json: revisedSequence() }));
    expect(outcome).toMatchObject({ kind: "failed" });
    const after = await rows(w);
    expect(after.documents.filter((row) => row.kind === "email_sequence")).toEqual(before.documents.filter((row) => row.kind === "email_sequence"));
    expect(after.steps).toEqual(before.steps);
  });

  test("a draft step with an approval is never rewritten: the revision fails and the rows stay", async () => {
    const w = await launch_(await world());
    const first = await rows(w);
    const step = first.steps.find((row) => row.order === 0n);
    const card = first.approvals[0];
    if (step === undefined || card === undefined) throw new Error("no step or card");
    await w.t.run(async (ctx) => await ctx.db.patch("sequence_steps", step._id, { approvalId: card._id }));
    const frozen = await rows(w);
    const revisionId = await emailRevision(w);
    const outcome = await runStep(w, revisionId, () => ({ json: revisedSequence() }));
    expect(outcome).toMatchObject({ kind: "failed" });
    const after = await rows(w);
    expect(after.sequences).toEqual(frozen.sequences);
    expect(after.steps).toEqual(frozen.steps);
    expect(after.documents.filter((row) => row.kind === "email_sequence")).toHaveLength(1);
  });

  test("a sequence that is no longer draft is never touched: the revision gets a new draft", async () => {
    const w = await launch_(await world());
    const first = await rows(w);
    const approved = first.sequences[0] as Doc<"sequences">;
    await w.t.run(async (ctx) => await ctx.db.patch("sequences", approved._id, { status: "approved" }));
    const frozen = await rows(w);
    const revisionId = await emailRevision(w);
    const outcome = await runStep(w, revisionId, () => ({ json: revisedSequence() }));
    if (outcome.kind !== "finished") throw new Error(`revision did not finish: ${JSON.stringify(outcome)}`);

    const after = await rows(w);
    expect(after.sequences.find((row) => row._id === approved._id)).toEqual(frozen.sequences.find((row) => row._id === approved._id));
    expect(stepsOf(after, approved._id)).toEqual(stepsOf(frozen, approved._id));
    const drafts = after.sequences.filter((row) => row.status === "draft");
    expect(drafts).toHaveLength(1);
    const steps = stepsOf(after, (drafts[0] as Doc<"sequences">)._id);
    expect(steps.map((step) => [step.order, step.documentId])).toEqual([0n, 1n, 2n, 3n].map((order) => [order, outcome.documentId]));
  });
});

describe("WP76-S1a the Email page read", () => {
  test("the owner sees the status, the four emails in order and the card; nothing more", async () => {
    const w = await launch_(await world());
    const ready = await view(w);
    if (ready.state !== "ready") throw new Error(`expected ready, got ${JSON.stringify(ready)}`);
    expect(ready).toMatchObject({ status: "draft", name: hydrotrailEmailSequence.name, senderName: hydrotrailEmailSequence.senderName });
    expect(ready.emails.map((entry) => entry.kind)).toEqual([...EMAIL_KINDS]);
    expect(ready.emails[0]).toEqual({ kind: "welcome", ...hydrotrailEmailSequence.emails.welcome });
    expect(ready.card).toMatchObject({ status: "pending", changeRound: 0n });
    expect(Object.keys(ready).sort()).toEqual(["card", "emails", "name", "senderName", "state", "status"]);
  });

  test("before the step runs the page reads none; a step that disagrees with its document reads unavailable", async () => {
    const w = await world();
    expect(await view(w)).toEqual({ state: "none" });
    await launch(w);
    const r = await rows(w);
    const step = r.steps.find((row) => row.order === 2n);
    if (step === undefined) throw new Error("no step");
    await w.t.run(async (ctx) => await ctx.db.patch("sequence_steps", step._id, { subject: "Something the founder never saw" }));
    expect(await view(w)).toEqual({ state: "unavailable" });
  });

  test("a duplicate step order reads unavailable, even when it copies the other step exactly", async () => {
    const w = await launch_(await world());
    const steps = (await rows(w)).steps;
    const step = steps.find((row) => row.order === 3n);
    const twin = steps.find((row) => row.order === 2n);
    if (step === undefined || twin === undefined) throw new Error("no step");
    await w.t.run(async (ctx) => await ctx.db.patch("sequence_steps", step._id, { order: 2n, subject: twin.subject, delayHours: twin.delayHours }));
    expect(await view(w)).toEqual({ state: "unavailable" });
  });

  test("the draft wins over a newer approved sequence", async () => {
    const w = await launch_(await world());
    const r = await rows(w);
    const document = r.documents.find((row) => row.kind === "email_sequence");
    if (document === undefined) throw new Error("no document");
    await w.t.run(async (ctx) => {
      const later = Date.now() + 60_000;
      const sequenceId = await ctx.db.insert("sequences", { ownerId: w.owner.userId, projectId: w.projectId, status: "approved", title: "Newer", createdAt: later, updatedAt: later });
      for (const step of r.steps) {
        await ctx.db.insert("sequence_steps", {
          ownerId: step.ownerId, projectId: step.projectId, sequenceId, order: step.order, delayHours: step.delayHours,
          subject: step.subject, documentId: step.documentId, createdAt: later, updatedAt: later,
        });
      }
    });
    expect(await view(w)).toMatchObject({ state: "ready", status: "draft" });
  });

  test("never shows another business of the same owner", async () => {
    const w = await launch_(await world());
    const otherId = await secondProject(w);
    expect(await view(w, w.owner, otherId)).toEqual({ state: "none" });
    // A sequence of the other business pointing at this business's document reads unavailable, never its text.
    const document = (await rows(w)).documents.find((row) => row.kind === "email_sequence");
    if (document === undefined) throw new Error("no document");
    await w.t.run(async (ctx) => {
      const sequenceId = await ctx.db.insert("sequences", { ownerId: w.owner.userId, projectId: otherId, status: "draft", title: "Cross", createdAt: 1, updatedAt: 1 });
      for (const [order, { email }] of emailsInOrder(hydrotrailEmailSequence).entries()) {
        await ctx.db.insert("sequence_steps", {
          ownerId: w.owner.userId, projectId: otherId, sequenceId, order: BigInt(order), delayHours: email.delayHours,
          subject: email.subject, documentId: document._id, createdAt: 1, updatedAt: 1,
        });
      }
    });
    expect(await view(w, w.owner, otherId)).toEqual({ state: "unavailable" });
  });

  test("refuses another owner, the workspace off and AI off", async () => {
    const w = await launch_(await world());
    const stranger = await person(w.t, "stranger@example.test");
    await expect(view(w, stranger)).rejects.toThrow();
    await w.t.run(async (ctx) => await ctx.db.patch("ops_settings", w.opsId, { workspaceEnabled: false }));
    await expect(view(w)).rejects.toThrow(/WORKSPACE_DISABLED/);
    await w.t.run(async (ctx) => {
      const ops = await ctx.db.get("ops_settings", w.opsId);
      if (ops === null) throw new Error("no ops");
      await ctx.db.patch("ops_settings", w.opsId, { workspaceEnabled: true, killSwitches: { ...ops.killSwitches, ai: true } });
    });
    await expect(view(w)).rejects.toThrow(/AI_DISABLED/);
  });
});

/** A world with the HydroTrail launch run to the end. */
async function launch_(w: World): Promise<World> {
  await launch(w);
  return w;
}
