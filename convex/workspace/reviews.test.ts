/// <reference types="vite/client" />
/**
 * L1-C6. The "Waiting on you" list (`pendingReviews`) in convex-test, fixture
 * mode. One test runs the real HydroTrail launch through the DAG on
 * `crewWorkpool` with the fixture gateway (`../growth/drafts/emailSequence.test.ts`
 * pattern; no provider is ever called) and reads the cards it raised, plus
 * the brand kit and blueprint drafts it wrote. The rest write cards directly.
 */
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { APPROVAL_LIST_LIMIT, approvalExpiresAt } from "../../lib/workspace/contracts/approvals";
import { hydrotrailBlueprint, hydrotrailBrandKit, hydrotrailWizardAnswers } from "../../lib/workspace/contracts/fixtures/hydrotrail";
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

/** Each module loads once, so every crew step stays on the mock (`../crew/launch.test.ts`). */
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
type World = { readonly t: T; readonly owner: Person; readonly opsId: Id<"ops_settings">; readonly projectId: Id<"projects"> };

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
      ownerId, source: "repository_idea", title: slug, status: "draft", idempotencyKey: `business:${slug}`,
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
  const opsId = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    return await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true }, updatedAt: 1,
    });
  });
  return { t, owner, opsId, projectId: await project(t, owner.userId, "hydrotrail") };
}

const as = (w: World, who: Person = w.owner) =>
  w.t.withIdentity({ subject: `${who.userId}|${who.sessionId}`, issuer: "https://local.test" });

const reviews = async (w: World, who: Person = w.owner, projectId: Id<"projects"> = w.projectId) =>
  await as(w, who).query(api.workspace.reviews.pendingReviews, { projectId });

type DocumentInput = {
  readonly kind: Doc<"documents">["kind"];
  readonly at: number;
  readonly projectId?: Id<"projects">;
  readonly archivedAt?: number;
};

async function document(w: World, input: DocumentInput): Promise<Id<"documents">> {
  return await w.t.run(async (ctx) => await ctx.db.insert("documents", {
    ownerId: w.owner.userId, projectId: input.projectId ?? w.projectId, kind: input.kind, format: "json", title: input.kind,
    body: "{}", createdAt: input.at, updatedAt: input.at,
    ...(input.archivedAt === undefined ? {} : { archivedAt: input.archivedAt }),
  }));
}

type CardInput = {
  readonly at: number;
  readonly status?: Doc<"approvals">["status"];
  readonly kind?: Doc<"approvals">["kind"];
  readonly round?: bigint;
  readonly projectId?: Id<"projects">;
  readonly subjectTable?: string;
};

async function card(w: World, subjectId: string, input: CardInput): Promise<Id<"approvals">> {
  return await w.t.run(async (ctx) => await ctx.db.insert("approvals", {
    ownerId: w.owner.userId, projectId: input.projectId ?? w.projectId, kind: input.kind ?? "artifact_review",
    subjectTable: input.subjectTable ?? "documents", subjectId, status: input.status ?? "pending",
    changeRound: input.round ?? 0n, createdAt: input.at, updatedAt: input.at,
  }));
}

describe("L1-C6 pendingReviews", () => {
  test("after a real launch: every pending review card, newest first, and the drafts it wrote", async () => {
    const w = await world();
    await as(w).mutation(api.crew.roster.startLaunch, { projectId: w.projectId });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    const list = await reviews(w);
    // The launch raised a card on each of its drafts; the newest written comes first.
    expect(list.map((row) => row.kind)).toEqual(expect.arrayContaining(["blueprint", "brand_kit", "email_sequence"]));
    const at = await w.t.run(async (ctx) => await ctx.db.query("approvals").collect());
    const created = new Map(at.map((row) => [row._id, row._creationTime]));
    const times = list.map((row) => created.get(row.approvalId) ?? 0);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const kit = list.find((row) => row.kind === "brand_kit");
    expect(kit).toMatchObject({ title: "Brand kit", changeRound: 0n, href: `/dashboard/b/${w.projectId}/brand` });
    expect(list.find((row) => row.kind === "blueprint")).toMatchObject({ title: "Blueprint", href: `/dashboard/b/${w.projectId}/team` });
    expect(list.find((row) => row.kind === "email_sequence")).toMatchObject({ title: "Waitlist emails", href: `/dashboard/b/${w.projectId}/email` });
    for (const row of list) expect(Object.keys(row).sort()).toEqual(["approvalId", "changeRound", "expiresAt", "href", "kind", "title"]);

    // The drafts the crew wrote read back through their pages' queries, with the same cards.
    const kitView = await as(w).query(api.growth.drafts.brandKit.brandKitDraft, { projectId: w.projectId });
    expect(kitView).toMatchObject({ state: "ready", kit: { palette: hydrotrailBrandKit.palette }, card: { approvalId: kit?.approvalId, status: "pending" } });
    const blueprintView = await as(w).query(api.growth.drafts.blueprint.blueprintDraft, { projectId: w.projectId });
    expect(blueprintView).toMatchObject({ state: "ready", blueprint: { validated: true }, card: { status: "pending" } });
    if (blueprintView.state !== "ready") throw new Error("no blueprint");
    expect(blueprintView.blueprint.features.length).toBe(hydrotrailBlueprint.features.length);
  }, 20_000); // The whole fixture launch runs here; under the full suite it can pass 5 s.

  test("only pending artifact_review cards on this business's live documents", async () => {
    const w = await world();
    const kit = await document(w, { kind: "brand_kit", at: 10 });
    const social = await document(w, { kind: "social_pack", at: 11 });
    const archived = await document(w, { kind: "blueprint", at: 12, archivedAt: 13 });
    const notArtifact = await document(w, { kind: "research", at: 14 });
    const otherId = await project(w.t, w.owner.userId, "other");
    const otherKit = await document(w, { kind: "brand_kit", at: 15, projectId: otherId });

    const kitCard = await card(w, kit, { at: 20, round: 1n });
    const socialCard = await card(w, social, { at: 21 });
    for (const status of ["approved", "changes_requested", "expired", "cancelled"] as const) await card(w, kit, { at: 22, status });
    await card(w, kit, { at: 23, kind: "spend", round: 3n });
    await card(w, archived, { at: 24 });
    await card(w, notArtifact, { at: 25 });
    await card(w, kit, { at: 26, subjectTable: "site_versions" });
    await card(w, "not-a-document-id", { at: 27 });
    // Another business's card, and this business's card pointing at the other business's document.
    await card(w, otherKit, { at: 28, projectId: otherId });
    await card(w, otherKit, { at: 29 });

    expect(await reviews(w)).toEqual([
      { approvalId: socialCard, kind: "social_pack", title: "Social posts", changeRound: 0n, expiresAt: approvalExpiresAt(21), href: `/dashboard/b/${w.projectId}/social` },
      { approvalId: kitCard, kind: "brand_kit", title: "Brand kit", changeRound: 1n, expiresAt: approvalExpiresAt(20), href: `/dashboard/b/${w.projectId}/brand` },
    ]);
    expect((await reviews(w, w.owner, otherId)).map((row) => row.kind)).toEqual(["brand_kit"]);
  });

  test("pending cards of other kinds never crowd review cards out of the window", async () => {
    const w = await world();
    const kit = await document(w, { kind: "brand_kit", at: 10 });
    const kitCard = await card(w, kit, { at: 20 });
    // More newer pending non-review cards than the list cap.
    for (let i = 0; i < APPROVAL_LIST_LIMIT + 5; i += 1) await card(w, kit, { at: 30 + i, kind: "spend" });
    expect((await reviews(w)).map((row) => row.approvalId)).toEqual([kitCard]);
  });

  test("empty when nothing waits", async () => {
    const w = await world();
    expect(await reviews(w)).toEqual([]);
  });

  test("refuses another owner and the workspace off", async () => {
    const w = await world();
    await card(w, await document(w, { kind: "brand_kit", at: 10 }), { at: 11 });
    const stranger = await person(w.t, "stranger@example.test");
    await expect(reviews(w, stranger)).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await w.t.run(async (ctx) => await ctx.db.patch("ops_settings", w.opsId, { workspaceEnabled: false }));
    await expect(reviews(w)).rejects.toThrow(/WORKSPACE_DISABLED/);
  });
});
