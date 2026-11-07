/// <reference types="vite/client" />
/**
 * WP76-S2a. The social pack step through the launch DAG on `crewWorkpool` in
 * convex-test, fixture mode, with the REAL registry, C-METER, ledger,
 * approvals and limiter: no provider is ever called. The pool's action is the
 * real generator step with a fixture adapter (`./emailSequence.test.ts`
 * pattern); a test can script one call's reply or a change just before it.
 * S2a writes no `social_posts` rows (owner ruling "Ship now, rows later").
 */
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import schema from "../../schema";
import { runPromptWithMeter } from "../../ai/gatewayActions";
import { createAnthropicAdapter } from "../../ai/providers/anthropic";
import type { AnthropicFixtureReply } from "../../ai/providers/fixtures";
import { SOCIAL_DAYS, socialPostsInOrder, type SocialPack } from "../../../lib/workspace/contracts/artifacts";
import { hydrotrailSocialPack, hydrotrailWizardAnswers } from "../../../lib/workspace/contracts/fixtures/hydrotrail";
import { runCrewGeneratorStepWith, type CrewGeneratorCtx } from "../../crew/generators";
import { SOCIAL_BRAND_KIT_CHANGED_REASON, SOCIAL_BRIEF_CHANGED_REASON } from "../../crew/launch";
import type { CrewStepOutcome } from "../../crew/runner";

type Plan = {
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

/** Each module loads once, so the email sequence and the social pack running together both stay on the mock (`../../crew/launch.test.ts`). */
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

async function launch(w: World): Promise<World> {
  await as(w).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
  return w;
}

type Rows = {
  tasks: Doc<"tasks">[];
  documents: Doc<"documents">[];
  approvals: Doc<"approvals">[];
  runs: Doc<"workflow_runs">[];
  socialPosts: Doc<"social_posts">[];
};

async function rows(w: World): Promise<Rows> {
  return await w.t.run(async (ctx) => ({
    tasks: await ctx.db.query("tasks").collect(),
    documents: await ctx.db.query("documents").collect(),
    approvals: await ctx.db.query("approvals").collect(),
    runs: await ctx.db.query("workflow_runs").collect(),
    socialPosts: await ctx.db.query("social_posts").collect(),
  }));
}

const ofType = (r: Rows, type: Doc<"tasks">["type"]) => r.tasks.filter((row) => row.type === type);
const socialDocs = (r: Rows) => r.documents.filter((row) => row.kind === "social_pack");
const cardOn = (r: Rows, documentId: Id<"documents">) => r.approvals.filter((row) => row.subjectId === documentId);
const clonePack = (): SocialPack => JSON.parse(JSON.stringify(hydrotrailSocialPack)) as SocialPack;
const socialOnly = (plan: Plan): PlanFor => ({ type }) => (type === "crew_social_pack" ? plan : {});

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

/** A changed pack for a revision: every hook reworded. */
function revisedPack(): SocialPack {
  const next = clonePack();
  for (const day of SOCIAL_DAYS) next.posts[day].hook = `${next.posts[day].hook} Again.`;
  return next;
}

async function approve(w: World, approvalId: Id<"approvals">): Promise<void> {
  await w.t.run(async (ctx) => await ctx.db.patch("approvals", approvalId, { status: "approved", decidedAt: Date.now() }));
}

/** A document's newest card. */
async function newestCard(w: World, kind: "blueprint" | "brand_kit"): Promise<{ document: Doc<"documents">; card: Doc<"approvals"> }> {
  const r = await rows(w);
  const document = r.documents.find((row) => row.kind === kind);
  const card = document === undefined ? undefined : cardOn(r, document._id).sort((a, b) => b._creationTime - a._creationTime)[0];
  if (document === undefined || card === undefined) throw new Error(`no ${kind} card`);
  return { document, card };
}

/** After a launch: approve the given briefs, then ask for changes on the social card. Returns the revision task. */
async function socialRevision(w: World, approved: readonly ("blueprint" | "brand_kit")[] = ["blueprint", "brand_kit"]): Promise<Id<"tasks">> {
  for (const kind of approved) await approve(w, (await newestCard(w, kind)).card._id);
  const r = await rows(w);
  const doc = socialDocs(r)[0];
  const card = doc === undefined ? undefined : cardOn(r, doc._id)[0];
  if (card === undefined) throw new Error("no social card");
  const result = await as(w).mutation(api.workspace.approvals.decideApproval, {
    projectId: w.projectId, approvalId: card._id, decision: "request_changes", note: "Shorter hooks, please",
  });
  if (result.changeRound?.outcome !== "free") throw new Error(`expected a free round, got ${JSON.stringify(result)}`);
  return result.changeRound.taskId;
}

/** The social step failed closed: no document, no rows, the run closed permanent. */
async function expectNothingWritten(w: World): Promise<void> {
  const r = await rows(w);
  const [social] = ofType(r, "crew_social_pack");
  expect(social).toMatchObject({ status: "failed" });
  expect(r.runs.filter((run) => run.taskId === social?._id).map((run) => [run.status, run.errorCode])).toEqual([["failed", "permanent"]]);
  expect(socialDocs(r)).toEqual([]);
  expect(r.socialPosts).toEqual([]);
}

/** Runs the launch with `change` applied just before the social pack's gateway call (after its preflight). */
async function launchWithMidSocial(w: World, change: () => Promise<void>): Promise<void> {
  hooks.plan = socialOnly({ before: change });
  await launch(w);
}

/** Moves a document's `updatedAt` past its card, so the card no longer covers it. */
async function editAfterCard(w: World, kind: "blueprint" | "brand_kit"): Promise<void> {
  const { document, card } = await newestCard(w, kind);
  await w.t.run(async (ctx) => await ctx.db.patch("documents", document._id, { updatedAt: Math.max(document.updatedAt, card.createdAt) + 1 }));
}

const view = async (w: World, who: Person = w.owner, projectId: Id<"projects"> = w.projectId) =>
  await as(w, who).query(api.growth.drafts.socialPack.socialPackDraft, { projectId });

const progress = async (w: World) => await as(w).query(api.crew.launch.launchProgress, { projectId: w.projectId });

// ---------------------------------------------------------------------------

describe("WP76-S2a HydroTrail launch writes the social pack draft", () => {
  test("the document and one artifact_review card; no social_posts rows; nothing posts", async () => {
    const w = await launch(await world());
    const r = await rows(w);
    const [social] = ofType(r, "crew_social_pack");
    expect(social).toMatchObject({ status: "succeeded", employeeKey: "social", changeRound: 0n, creditCost: 0n });
    const documents = socialDocs(r);
    expect(documents).toHaveLength(1);
    const document = documents[0] as Doc<"documents">;
    expect(document).toMatchObject({ taskId: social?._id, promptRef: "crew-social-pack@1", format: "json" });
    expect(JSON.parse(document.body ?? "null")).toEqual(hydrotrailSocialPack);
    expect(cardOn(r, document._id)).toEqual([expect.objectContaining({ kind: "artifact_review", status: "pending", subjectTable: "documents" })]);
    expect(r.socialPosts).toEqual([]);
    expect(r.approvals.filter((row) => row.kind !== "artifact_review")).toEqual([]);
    expect((await progress(w)).steps.find((step) => step.key === "social_pack")?.state).toBe("succeeded");
  });

  test("the prompt quotes the blueprint and the kit's name and voice as data blocks; no answers, never the palette", async () => {
    await launch(await world());
    const socialRequests = hooks.requests.filter((entry) => entry.type === "crew_social_pack");
    expect(socialRequests).toHaveLength(1);
    const request = socialRequests[0]?.request as { system?: unknown; messages?: unknown; model?: unknown };
    expect(request.model).toBe("claude-haiku-5-5");
    const user = JSON.stringify(request.messages ?? []);
    for (const tag of ["blueprint", "brand"]) expect(user).toContain(`<${tag}>`);
    expect(user).not.toContain("<founder_answers>");
    expect(user).toContain("Trail-tested");
    expect(user).not.toContain("#1F4E5F");
    expect(JSON.stringify(request.system ?? "")).not.toContain("Trail-tested");
  });

  test("the step runs only after the brand kit: a failed kit leaves it queued, never run", async () => {
    const w = await world();
    hooks.plan = ({ type }) => (type === "crew_brand_kit" ? { reply: () => ({ refusal: { category: "cyber" } }) } : {});
    await launch(w);
    const r = await rows(w);
    expect(ofType(r, "crew_brand_kit")[0]).toMatchObject({ status: "failed" });
    expect(ofType(r, "crew_social_pack")[0]).toMatchObject({ status: "queued" });
    expect(hooks.calls.map((call) => call.type)).toEqual(["crew_blueprint", "crew_brand_kit"]);
    expect(socialDocs(r)).toEqual([]);
    expect((await progress(w)).steps.find((step) => step.key === "social_pack")?.state).toBe("waiting");
  });
});

describe("WP76-S2a writes nothing on a failed step", () => {
  test("a refusal writes no document", async () => {
    const w = await world();
    hooks.plan = socialOnly({ reply: () => ({ refusal: { category: "cyber" } }) });
    await launch(w);
    const r = await rows(w);
    expect(ofType(r, "crew_social_pack")[0]).toMatchObject({ status: "failed" });
    expect(socialDocs(r)).toEqual([]);
    expect(r.socialPosts).toEqual([]);
  });

  test.each([
    ["poll options on an image post", (pack: SocialPack): void => void (pack.posts.fri.pollOptions = ["Yes", "No"])],
    ["a short caption over 280 characters", (pack: SocialPack): void => void (pack.posts.sat.shortCaption = "a".repeat(281))],
    ["a hashtag with #", (pack: SocialPack): void => void (pack.posts.sun.hashtags = ["#hiking"])],
  ] as const)("an invalid output (%s) writes nothing", async (_label, edit) => {
    const w = await world();
    const bad = clonePack();
    edit(bad);
    hooks.plan = socialOnly({ reply: () => ({ json: bad }) });
    await launch(w);
    await expectNothingWritten(w);
  });

  test.each([
    ["a hook", (pack: SocialPack): void => void (pack.posts.fri.hook = "Plans at hydrotrail.shop")],
    ["a caption", (pack: SocialPack): void => void (pack.posts.sat.caption = "Follow @hydrotrail for the next route.")],
    ["a short caption", (pack: SocialPack): void => void (pack.posts.sun.shortCaption = "Write to hello@hydrotrail.app")],
    ["the card text", (pack: SocialPack): void => void (pack.posts.mon.imageText = "www.hydro")],
    ["alt text", (pack: SocialPack): void => void (pack.posts.tue.imageAlt = "Card reading https://hydrotrail.app")],
    ["a poll option", (pack: SocialPack): void => void (pack.posts.mon.pollOptions = ["Ask @trailcrew", "I guess"])],
  ] as const)("a link or handle in %s fails the quality gate: nothing is stored", async (_label, edit) => {
    const w = await world();
    const linked = clonePack();
    edit(linked);
    hooks.plan = socialOnly({ reply: () => ({ json: linked }) });
    await launch(w);
    await expectNothingWritten(w);
  });

  test.each(["blueprint", "brand_kit"] as const)("the social pack's %s brief is re-checked at the finish", async (kind) => {
    const w = await world();
    await launchWithMidSocial(w, async () => await editAfterCard(w, kind));
    await expectNothingWritten(w);
  });

  test("a social finish without its blueprint or brand kit id fails as permanent", async () => {
    for (const ids of ["none", "brief only", "kit only"] as const) {
      const w = await world();
      hooks.plan = socialOnly({ reply: () => ({ refusal: { category: "cyber" } }) });
      await launch(w);
      const blueprint = await newestCard(w, "blueprint");
      const kit = await newestCard(w, "brand_kit");
      const { taskId } = await w.t.mutation(internal.crew.jobs.createCrewTask, {
        ownerId: w.owner.userId, projectId: w.projectId, jobType: "crew_social_pack", employeeKey: "social",
      });
      const started = await w.t.mutation(internal.crew.jobs.startCrewRun, { taskId });
      if (started.kind !== "run") throw new Error(`expected a run, got ${JSON.stringify(started)}`);
      const outcome = await w.t.mutation(internal.crew.jobs.finishCrewStep, {
        runId: started.runId, promptRef: "crew-social-pack@1", outputJson: JSON.stringify(hydrotrailSocialPack),
        nextAttempt: started.attempt + 1,
        ...(ids === "brief only" ? { briefDocumentId: blueprint.document._id } : {}),
        ...(ids === "kit only" ? { brandKitDocumentId: kit.document._id } : {}),
      });
      expect(outcome).toMatchObject({ kind: "failed" });
      const r = await rows(w);
      expect(r.runs.find((run) => run._id === started.runId)).toMatchObject({ status: "failed", errorCode: "permanent" });
      expect(socialDocs(r)).toEqual([]);
    }
  });

  test("a failed social pack reports why a retry cannot help: the blueprint changed, or the brand kit changed", async () => {
    const w = await world();
    hooks.plan = socialOnly({ reply: () => ({ refusal: { category: "cyber" } }) });
    await launch(w);
    const socialStep = async () => (await progress(w)).steps.find((step) => step.key === "social_pack");
    expect(await socialStep()).toMatchObject({ state: "failed", retryable: true });

    const blueprint = await newestCard(w, "blueprint");
    await w.t.run(async (ctx) => await ctx.db.patch("approvals", blueprint.card._id, { status: "changes_requested" }));
    expect(await socialStep()).toMatchObject({ state: "failed", retryable: false, reason: SOCIAL_BRIEF_CHANGED_REASON });

    await w.t.run(async (ctx) => await ctx.db.patch("approvals", blueprint.card._id, { status: "pending" }));
    const kit = await newestCard(w, "brand_kit");
    await w.t.run(async (ctx) => await ctx.db.patch("approvals", kit.card._id, { status: "changes_requested" }));
    expect(await socialStep()).toMatchObject({ state: "failed", retryable: false, reason: SOCIAL_BRAND_KIT_CHANGED_REASON });
  });
});

describe("WP76-S2a replay and revisions", () => {
  test("replay is idempotent: a finished step skips, and nothing is written twice", async () => {
    const w = await launch(await world());
    const before = await rows(w);
    const [social] = ofType(before, "crew_social_pack");
    if (social === undefined) throw new Error("no social task");
    expect(await runStep(w, social._id)).toEqual({ kind: "skipped", reason: "terminal" });
    const run = before.runs.find((row) => row.taskId === social._id);
    if (run === undefined) throw new Error("no run");
    expect(await w.t.mutation(internal.crew.jobs.finishCrewStep, {
      runId: run._id, promptRef: "crew-social-pack@1", outputJson: JSON.stringify(hydrotrailSocialPack), nextAttempt: 3,
    })).toEqual({ kind: "stale" });
    await as(w).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await rows(w);
    expect(after.documents).toEqual(before.documents);
    expect(after.approvals).toEqual(before.approvals);
    expect(after.socialPosts).toEqual([]);
  });

  test("a revision writes a new version and a new card, and the page reads it", async () => {
    const w = await launch(await world());
    const first = socialDocs(await rows(w))[0] as Doc<"documents">;
    const revisionId = await socialRevision(w);
    const outcome = await runStep(w, revisionId, () => ({ json: revisedPack() }));
    if (outcome.kind !== "finished") throw new Error(`revision did not finish: ${JSON.stringify(outcome)}`);
    const r = await rows(w);
    const revised = r.documents.find((row) => row._id === outcome.documentId);
    expect(revised).toMatchObject({ kind: "social_pack", supersedesDocumentId: first._id, promptRef: "crew-social-pack@1" });
    expect(socialDocs(r)).toHaveLength(2);
    expect(cardOn(r, outcome.documentId)).toEqual([expect.objectContaining({ kind: "artifact_review", status: "pending", changeRound: 1n })]);
    expect(r.socialPosts).toEqual([]);
    const ready = await view(w);
    if (ready.state !== "ready") throw new Error("view not ready");
    expect(ready.posts.map((post) => post.hook)).toEqual(SOCIAL_DAYS.map((day) => revisedPack().posts[day].hook));
    expect(ready.card).toMatchObject({ status: "pending", changeRound: 1n, approvalId: outcome.approvalId });
  });

  test.each([
    ["the brand kit", ["blueprint"]],
    ["the blueprint", ["brand_kit"]],
  ] as const)("a social revision refuses when %s is not approved: no new document, no new card", async (_label, approved) => {
    const w = await launch(await world());
    const before = await rows(w);
    const revisionId = await socialRevision(w, approved);
    const outcome = await runStep(w, revisionId, () => ({ json: revisedPack() }));
    expect(outcome).toMatchObject({ kind: "failed" });
    const after = await rows(w);
    expect(socialDocs(after)).toEqual(socialDocs(before));
    expect(after.approvals.map((row) => row._id)).toEqual(before.approvals.map((row) => row._id));
    // Refused at preflight: no model call was metered for the revision.
    const usage = await w.t.run(async (ctx) => await ctx.db.query("ai_usage").collect());
    expect(usage.filter((row) => row.taskId === revisionId)).toEqual([]);
  });
});

describe("WP76-S2a the Social page read", () => {
  test("the owner sees the seven posts Friday to Thursday and the card; nothing more", async () => {
    const w = await launch(await world());
    const ready = await view(w);
    if (ready.state !== "ready") throw new Error(`expected ready, got ${JSON.stringify(ready)}`);
    expect(Object.keys(ready).sort()).toEqual(["card", "posts", "state"]);
    expect(ready.posts.map((post) => post.day)).toEqual(["fri", "sat", "sun", "mon", "tue", "wed", "thu"]);
    expect(ready.posts).toEqual(socialPostsInOrder(hydrotrailSocialPack).map(({ day, post }) => ({ day, ...post })));
    expect(ready.card).toMatchObject({ status: "pending", changeRound: 0n });
  });

  test("before the step runs the page reads none; a document that does not parse reads unavailable", async () => {
    const w = await world();
    expect(await view(w)).toEqual({ state: "none" });
    await launch(w);
    const document = socialDocs(await rows(w))[0] as Doc<"documents">;
    await w.t.run(async (ctx) => await ctx.db.patch("documents", document._id, { body: JSON.stringify({ schemaVersion: 1, posts: {} }) }));
    expect(await view(w)).toEqual({ state: "unavailable" });
  });

  test("never shows another business of the same owner", async () => {
    const w = await launch(await world());
    const otherId = await w.t.run(async (ctx) => {
      const first = await ctx.db.get("projects", w.projectId);
      if (first?.workspace === undefined) throw new Error("no first business");
      return await ctx.db.insert("projects", {
        ownerId: w.owner.userId, source: "repository_idea", title: "Other", status: "draft", idempotencyKey: "business:other",
        workspace: { ...first.workspace, name: "Other", slug: "other" }, createdAt: 2, updatedAt: 2,
      });
    });
    expect(await view(w, w.owner, otherId)).toEqual({ state: "none" });
  });

  test("refuses another owner, the workspace off and AI off", async () => {
    const w = await launch(await world());
    const stranger = await person(w.t, "stranger@example.test");
    // Another owner's business reads as not found, never as forbidden (no existence leak).
    await expect(view(w, stranger)).rejects.toThrow(/RESOURCE_NOT_FOUND/);
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
