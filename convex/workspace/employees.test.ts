/// <reference types="vite/client" />
/**
 * WP67 employee pages — `employeeActivity` in convex-test, fixture mode. One
 * test runs the real HydroTrail launch through the DAG on `crewWorkpool` with
 * the fixture gateway (the `./reviews.test.ts` pattern; no provider is ever
 * called) and reads Iris's, a coming-soon and a skipped employee's records.
 * The rest write rows directly: owner scoping, the bounds, and the ledger.
 */
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { hydrotrailWizardAnswers } from "../../lib/workspace/contracts/fixtures/hydrotrail";
import { EMPLOYEE_ARTIFACT_KINDS, EMPLOYEE_TASKS_MAX, isSpecialistRoleKey, type SpecialistRoleKey } from "../../lib/workspace/employees";
import type { CrewStepOutcome } from "../crew/runner";

vi.mock("../crew/generators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../crew/generators")>();
  const { internalAction } = await import("../_generated/server");
  const runner = await import("../crew/runner");
  const meter = await import("../ai/gatewayActions");
  const anthropic = await import("../ai/providers/anthropic");
  return {
    ...actual,
    runCrewGeneratorStep: internalAction({
      args: actual.runCrewGeneratorStepArgs,
      returns: runner.crewStepOutcomeValidator,
      handler: async (ctx, args): Promise<CrewStepOutcome> => {
        const adapter = anthropic.createAnthropicAdapter({ env: {}, fixtureResponder: () => undefined });
        return await actual.runCrewGeneratorStepWith(ctx, args, {
          runPrompt: async (promptArgs) => await meter.runPromptWithMeter(ctx, promptArgs, { adapter }),
        });
      },
    }),
  };
});

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
});
afterEach(() => {
  vi.useRealTimers();
});

type Person = { readonly userId: Id<"users">; readonly sessionId: Id<"authSessions"> };
type World = { readonly t: T; readonly owner: Person; readonly projectId: Id<"projects"> };

async function person(t: T, email: string): Promise<Person> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, emailVerificationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

async function project(t: T, ownerId: Id<"users">, slug: string): Promise<Id<"projects">> {
  return await t.run(async (ctx) => {
    const wizardSessionId = await ctx.db.insert("wizard_sessions", {
      ownerId, ideaSlug: "hydrotrail", step: "partner_name", answers: hydrotrailWizardAnswers, startedAt: 1, updatedAt: 1, completedAt: 2,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId, source: "repository_idea", title: slug, status: "draft", idempotencyKey: `business:${slug}:${ownerId}`,
      workspace: {
        version: 1, name: slug, slug, ideaSlug: "hydrotrail", platform: "web", commercialModel: "free",
        goal: "waitlist", partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
      },
      createdAt: 1, updatedAt: 1,
    });
    await ctx.db.patch("wizard_sessions", wizardSessionId, { projectId });
    return projectId;
  });
}

async function world(): Promise<World> {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  registerWorkpool(t, "crewWorkpool");
  const owner = await person(t, "owner@example.test");
  await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true }, updatedAt: 1,
    });
  });
  return { t, owner, projectId: await project(t, owner.userId, "hydrotrail") };
}

const as = (w: World, who: Person = w.owner) =>
  w.t.withIdentity({ subject: `${who.userId}|${who.sessionId}`, issuer: "https://local.test" });

const activity = async (w: World, roleKey: SpecialistRoleKey, who: Person = w.owner, projectId: Id<"projects"> = w.projectId) =>
  await as(w, who).query(api.workspace.employees.employeeActivity, { projectId, roleKey });

type TaskInput = {
  readonly ownerId: Id<"users">;
  readonly projectId: Id<"projects">;
  readonly employeeKey?: string;
  readonly at: number;
  readonly status?: "queued" | "running" | "blocked" | "succeeded" | "failed" | "cancelled";
  readonly creditCost?: bigint;
};

async function task(w: World, input: TaskInput): Promise<Id<"tasks">> {
  return await w.t.run(async (ctx) => await ctx.db.insert("tasks", {
    ownerId: input.ownerId, projectId: input.projectId, type: "crew_brand_kit", status: input.status ?? "succeeded",
    title: "Brand kit", idempotencyKey: `task:${input.at}:${input.employeeKey ?? "none"}:${input.projectId}`,
    createdAt: input.at, updatedAt: input.at,
    ...(input.employeeKey === undefined ? {} : { employeeKey: input.employeeKey }),
    ...(input.creditCost === undefined ? {} : { creditCost: input.creditCost }),
  }));
}

describe("WP67 employeeActivity", () => {
  test("after a real launch: Iris's jobs, drafts and decisions; a coming-soon and a skipped employee read empty", async () => {
    const w = await world();
    await as(w).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);

    const iris = await activity(w, "brand");
    expect(iris.member).toMatchObject({ status: expect.any(String), hiredBy: "rule" });
    expect(iris.member?.status).not.toBe("skipped");
    expect(iris.tasks.length).toBeGreaterThanOrEqual(1);
    const first = iris.tasks[iris.tasks.length - 1];
    expect(first).toMatchObject({ title: "Brand kit", status: "succeeded", revision: false, creditCost: 0n, charged: 0n, refunded: 0n });
    expect(first.attempts).toBeGreaterThanOrEqual(1);
    expect(first.drafts.map((draft) => draft.kind)).toEqual(["brand_kit"]);
    expect(first.decisions.map((decision) => decision.status)).toEqual(["pending"]);
    expect(iris.deliverables).toHaveLength(1);
    expect(iris.deliverables[0]).toMatchObject({ kind: "brand_kit", review: { status: "pending", changeRound: 0n } });
    expect(iris.tasksTruncated).toBe(false);
    // No ids, codes or model data leak out.
    expect(Object.keys(first).sort()).toEqual([
      "attempts", "changeRound", "charged", "createdAt", "creditCost", "decisions", "drafts", "failedAttempts", "refunded",
      "revision", "status", "title", "updatedAt",
    ]);

    // Elle's email job ran too, under the brand kit.
    const elle = await activity(w, "email");
    expect(elle.tasks.map((entry) => entry.title)).toContain("Email sequence");
    expect(elle.deliverables.map((entry) => entry.kind)).toEqual(["email_sequence"]);

    // A hired employee whose work is coming soon: a member row, no jobs, no drafts.
    const launch = await as(w).query(api.crew.roster.launchStatus, { projectId: w.projectId });
    if (launch.state !== "ready") throw new Error("team not written");
    const hiredKeys = launch.hired.map((entry) => entry.roleKey);
    expect(hiredKeys).toContain("landing");
    const leo = await activity(w, "landing");
    expect(leo.member).toMatchObject({ status: "queued" });
    expect(leo.tasks).toEqual([]);
    expect(leo.deliverables).toEqual([]);

    // A role the roster skipped: its row reads skipped, with nothing else.
    const skipped = launch.skipped.map((entry) => entry.roleKey).find(isSpecialistRoleKey);
    if (skipped === undefined) throw new Error("HydroTrail skips no specialist");
    const record = await activity(w, skipped);
    expect(record.member).toMatchObject({ status: "skipped" });
    expect(record.tasks).toEqual([]);
    expect(record.deliverables).toEqual([]);
  }, 20_000);

  test("owner scoped: another founder is refused, and rows of another owner or business never appear", async () => {
    const w = await world();
    const stranger = await person(w.t, "stranger@example.test");
    await expect(activity(w, "brand", stranger)).rejects.toThrow();

    const strangerProject = await project(w.t, stranger.userId, "elsewhere");
    const otherOwnBusiness = await project(w.t, w.owner.userId, "second");
    await task(w, { ownerId: w.owner.userId, projectId: w.projectId, employeeKey: "brand", at: 10 });
    // A row on this project id but another owner, the owner's other business, and the stranger's business.
    await task(w, { ownerId: stranger.userId, projectId: w.projectId, employeeKey: "brand", at: 11 });
    await task(w, { ownerId: w.owner.userId, projectId: otherOwnBusiness, employeeKey: "brand", at: 12 });
    await task(w, { ownerId: stranger.userId, projectId: strangerProject, employeeKey: "brand", at: 13 });
    // Another employee's job and an un-keyed (lead) job on this business.
    await task(w, { ownerId: w.owner.userId, projectId: w.projectId, employeeKey: "email", at: 14 });
    await task(w, { ownerId: w.owner.userId, projectId: w.projectId, at: 15 });
    await w.t.run(async (ctx) => {
      await ctx.db.insert("documents", {
        ownerId: stranger.userId, projectId: w.projectId, kind: "brand_kit", format: "json", title: "Brand kit", body: "{}",
        createdAt: 16, updatedAt: 16,
      });
      await ctx.db.insert("documents", {
        ownerId: w.owner.userId, projectId: otherOwnBusiness, kind: "brand_kit", format: "json", title: "Brand kit", body: "{}",
        createdAt: 17, updatedAt: 17,
      });
    });

    const iris = await activity(w, "brand");
    expect(iris.tasks.map((entry) => entry.createdAt)).toEqual([10]);
    expect(iris.deliverables).toEqual([]);
    expect(iris.member).toBeNull();
    // The stranger reads their own business, and only it.
    expect((await activity(w, "brand", stranger, strangerProject)).tasks.map((entry) => entry.createdAt)).toEqual([13]);
  });

  test("bounded: at most the newest jobs, flagged as truncated", async () => {
    const w = await world();
    for (let i = 0; i < EMPLOYEE_TASKS_MAX + 3; i += 1) {
      await task(w, { ownerId: w.owner.userId, projectId: w.projectId, employeeKey: "social", at: 100 + i });
    }
    const theo = await activity(w, "social");
    expect(theo.tasks).toHaveLength(EMPLOYEE_TASKS_MAX);
    expect(theo.tasks[0].createdAt).toBe(100 + EMPLOYEE_TASKS_MAX + 2);
    expect(theo.tasksTruncated).toBe(true);
  });

  test("tries, decisions with the founder's note, and a costed job's charge and refund", async () => {
    const w = await world();
    const taskId = await task(w, { ownerId: w.owner.userId, projectId: w.projectId, employeeKey: "brand", at: 20, status: "failed", creditCost: 3n });
    await w.t.run(async (ctx) => {
      for (const [n, status] of [[1n, "failed"], [2n, "failed"]] as const) {
        await ctx.db.insert("workflow_runs", {
          ownerId: w.owner.userId, projectId: w.projectId, taskId, type: "crew_brand_kit", status,
          idempotencyKey: `run:${n}`, attempt: n, errorCode: "provider_timeout", createdAt: 20 + Number(n), updatedAt: 20 + Number(n),
        });
      }
      const accountId = await ctx.db.insert("credit_accounts", { ownerId: w.owner.userId, balance: 10n, createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("credit_ledger", {
        ownerId: w.owner.userId, accountId, taskId, reason: "task_debit", delta: -3n, balanceAfter: 7n, idempotencyKey: "debit", createdAt: 20,
      });
      await ctx.db.insert("credit_ledger", {
        ownerId: w.owner.userId, accountId, taskId, reason: "task_refund", delta: 3n, balanceAfter: 10n, idempotencyKey: "refund", createdAt: 25,
      });
    });
    const revisionId = await task(w, { ownerId: w.owner.userId, projectId: w.projectId, employeeKey: "brand", at: 30 });
    await w.t.run(async (ctx) => {
      const documentId = await ctx.db.insert("documents", {
        ownerId: w.owner.userId, projectId: w.projectId, taskId: revisionId, kind: "brand_kit", format: "json", title: "Brand kit", body: "{}",
        createdAt: 31, updatedAt: 31,
      });
      await ctx.db.insert("approvals", {
        ownerId: w.owner.userId, projectId: w.projectId, kind: "artifact_review", subjectTable: "documents", subjectId: documentId,
        status: "changes_requested", changeRound: 0n, note: "Warmer colours", decidedAt: 33, createdAt: 32, updatedAt: 33,
      });
      // A spend card on the same draft is not a review decision.
      await ctx.db.insert("approvals", {
        ownerId: w.owner.userId, projectId: w.projectId, kind: "spend", subjectTable: "documents", subjectId: documentId,
        status: "pending", changeRound: 1n, createdAt: 34, updatedAt: 34,
      });
    });

    const iris = await activity(w, "brand");
    const [revision, failed] = iris.tasks;
    expect(failed).toMatchObject({ status: "failed", attempts: 2, failedAttempts: 2, creditCost: 3n, charged: 3n, refunded: 3n, drafts: [] });
    expect(revision.decisions).toEqual([{ status: "changes_requested", changeRound: 0n, note: "Warmer colours", createdAt: 32, decidedAt: 33 }]);
    expect(iris.deliverables).toEqual([
      { kind: "brand_kit", title: "Brand kit", createdAt: 31, review: { status: "changes_requested", changeRound: 0n, note: "Warmer colours", createdAt: 32, decidedAt: 33 } },
    ]);
    expect(JSON.stringify(iris, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value))).not.toContain("provider_timeout");
  });

  test("every specialist owns the artifact kinds Team HQ routes to them", async () => {
    const { REVIEW_OWNER } = await import("../../lib/workspace/teamHq");
    for (const [kind, owner] of Object.entries(REVIEW_OWNER)) {
      if (owner === "lead") continue;
      expect(EMPLOYEE_ARTIFACT_KINDS[owner]).toContain(kind);
    }
  });
});
