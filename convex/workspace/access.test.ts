/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { MY_BUSINESSES_MAX } from "./access";

const modules = import.meta.glob("/convex/**/*.ts");

type Setup = {
  workspaceEnabled: boolean;
  cohortMode: "allowlist" | "open";
  ownerInCohort: boolean;
};

async function seed(setup: Setup) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    const otherSessionId = await ctx.db.insert("authSessions", { userId: otherId, expirationTime: 9_999_999_999_999 });
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      source: "own_idea",
      title: "HydroTrail",
      status: "draft",
      idempotencyKey: "wp72-owner",
      createdAt: 1,
      updatedAt: 1,
    });
    const archivedProjectId = await ctx.db.insert("projects", {
      ownerId,
      source: "own_idea",
      title: "Archived",
      status: "draft",
      idempotencyKey: "wp72-archived",
      createdAt: 1,
      updatedAt: 1,
      archivedAt: 2,
    });
    await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: setup.workspaceEnabled,
      cohortMode: setup.cohortMode,
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n,
      paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    if (setup.ownerInCohort) {
      await ctx.db.insert("workspace_cohort", { ownerId, addedBy: adminId, addedAt: 1 });
      await ctx.db.insert("workspace_cohort", { ownerId: otherId, addedBy: adminId, addedAt: 1 });
    }
    return { ownerId, otherId, ownerSessionId, otherSessionId, projectId, archivedProjectId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.ownerSessionId}`, issuer: "https://local.test" });
  const other = t.withIdentity({ subject: `${ids.otherId}|${ids.otherSessionId}`, issuer: "https://local.test" });
  return { t, owner, other, ids };
}

const ON: Setup = { workspaceEnabled: true, cohortMode: "allowlist", ownerInCohort: true };

describe("WP72-S1 getWorkspaceAccess", () => {
  test("the owner in the cohort with the workspace on is allowed", async () => {
    const { owner, ids } = await seed(ON);
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toEqual({ allowed: true, project: { _id: ids.projectId, name: "HydroTrail" } });
  });

  test("open cohort mode allows the owner without an allowlist row", async () => {
    const { owner, ids } = await seed({ workspaceEnabled: true, cohortMode: "open", ownerInCohort: false });
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toMatchObject({ allowed: true });
  });

  test("the workspace flag off denies the owner", async () => {
    const { owner, ids } = await seed({ ...ON, workspaceEnabled: false });
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toEqual({ allowed: false });
  });

  test("no ops_settings row at all denies the owner", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
      const sessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
      const projectId = await ctx.db.insert("projects", {
        ownerId, source: "own_idea", title: "P", status: "draft", idempotencyKey: "k", createdAt: 1, updatedAt: 1,
      });
      return { ownerId, sessionId, projectId };
    });
    const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.sessionId}`, issuer: "https://local.test" });
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toEqual({ allowed: false });
  });

  test("an owner outside the allowlist cohort is denied", async () => {
    const { owner, ids } = await seed({ ...ON, ownerInCohort: false });
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toEqual({ allowed: false });
  });

  test("a signed-in non-owner gets the same answer as a missing project", async () => {
    const { t, owner, other, ids } = await seed(ON);
    const notOwner = await other.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId });
    const missingId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("projects", {
        ownerId: ids.ownerId, source: "own_idea", title: "Gone", status: "draft", idempotencyKey: "gone", createdAt: 1, updatedAt: 1,
      });
      await ctx.db.delete("projects", id);
      return id;
    });
    const missing = await owner.query(api.workspace.access.getWorkspaceAccess, { projectId: missingId });
    const archived = await owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.archivedProjectId });
    expect(notOwner).toEqual({ allowed: false });
    expect(missing).toEqual(notOwner);
    expect(archived).toEqual(notOwner);
  });

  test("a signed-out caller is denied", async () => {
    const { t, ids } = await seed(ON);
    await expect(t.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toEqual({ allowed: false });
  });

  test("a revoked session is denied", async () => {
    const { t, owner, ids } = await seed(ON);
    await t.run(async (ctx) => ctx.db.delete("authSessions", ids.ownerSessionId));
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toEqual({ allowed: false });
  });

  test("a malformed project id fails argument validation", async () => {
    const { owner, ids } = await seed(ON);
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, {
      projectId: "not-a-real-id" as Id<"projects">,
    })).rejects.toThrow();
    // An id from another table is rejected too, not treated as a project.
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, {
      projectId: ids.ownerId as unknown as Id<"projects">,
    })).rejects.toThrow();
  });

  test("the wizard workspace name wins over the project title", async () => {
    const { t, owner, ids } = await seed(ON);
    await t.run(async (ctx) => {
      const wizardSessionId = await ctx.db.insert("wizard_sessions", {
        ownerId: ids.ownerId, step: "done", answers: {}, startedAt: 1, updatedAt: 1,
      });
      await ctx.db.patch("projects", ids.projectId, {
        workspace: {
          version: 1,
          name: "HydroTrail Co",
          slug: "hydrotrail-co",
          platform: "web",
          commercialModel: "free",
          goal: "waitlist",
          partner: { personality: "strategist", name: "Wren" },
          wizardSessionId,
          createdVia: "wizard",
        },
      });
    });
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .resolves.toEqual({ allowed: true, project: { _id: ids.projectId, name: "HydroTrail Co" } });
  });

  test("the project title is used when there is no workspace name", async () => {
    const { owner, ids } = await seed(ON);
    const access = await owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId });
    expect(access).toEqual({ allowed: true, project: { _id: ids.projectId, name: "HydroTrail" } });
  });

  test("an unexpected fault is rethrown, not reported as no access", async () => {
    const { t, owner, ids } = await seed(ON);
    // A second singleton row makes C-OPS `.unique()` throw a plain Error,
    // which is not one of the access-denial codes.
    await t.run(async (ctx) => {
      const settings = await ctx.db.query("ops_settings").first();
      if (settings === null) throw new Error("fixture missing ops_settings");
      const { _id, _creationTime, ...row } = settings;
      void _id;
      void _creationTime;
      await ctx.db.insert("ops_settings", row);
    });
    await expect(owner.query(api.workspace.access.getWorkspaceAccess, { projectId: ids.projectId }))
      .rejects.toThrow(/unique|more than one|multiple/i);
  });
});

describe("L1-C5b myBusinesses", () => {
  /** Gives a project a `workspace` object (a business), named `name`, updated at `updatedAt`. */
  async function makeBusiness(t: Awaited<ReturnType<typeof seed>>["t"], projectId: Id<"projects">, ownerId: Id<"users">, name: string, updatedAt: number) {
    await t.run(async (ctx) => {
      const wizardSessionId = await ctx.db.insert("wizard_sessions", { ownerId, step: "done", answers: {}, startedAt: 1, updatedAt: 1 });
      await ctx.db.patch("projects", projectId, {
        updatedAt,
        workspace: {
          version: 1, name, slug: name.toLowerCase(), platform: "web", commercialModel: "free", goal: "waitlist",
          partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
        },
      });
    });
  }

  test("lists the owner's live businesses, newest first, and never a plain project or an archived one", async () => {
    const { t, owner, other, ids } = await seed(ON);
    expect(await owner.query(api.workspace.access.myBusinesses, {})).toEqual([]);
    await makeBusiness(t, ids.projectId, ids.ownerId, "PostureUp", 5);
    await makeBusiness(t, ids.archivedProjectId, ids.ownerId, "Gone", 9);
    const secondId = await t.run(async (ctx) => await ctx.db.insert("projects", {
      ownerId: ids.ownerId, source: "own_idea", title: "Second", status: "draft", idempotencyKey: "second", createdAt: 1, updatedAt: 1,
    }));
    const plainId = await t.run(async (ctx) => await ctx.db.insert("projects", {
      ownerId: ids.ownerId, source: "own_idea", title: "Plain", status: "draft", idempotencyKey: "plain", createdAt: 1, updatedAt: 99,
    }));
    void plainId;
    await makeBusiness(t, secondId, ids.ownerId, "SipLine", 7);
    expect(await owner.query(api.workspace.access.myBusinesses, {})).toEqual([
      { projectId: secondId, name: "SipLine" },
      { projectId: ids.projectId, name: "PostureUp" },
    ]);
    // Someone else's list never shows the owner's businesses.
    expect(await other.query(api.workspace.access.myBusinesses, {})).toEqual([]);
  });

  test("dormant-safe: flag off, outside the cohort or signed out reads an empty list, not an error", async () => {
    for (const setup of [{ ...ON, workspaceEnabled: false }, { ...ON, ownerInCohort: false }]) {
      const { t, owner, ids } = await seed(setup);
      await makeBusiness(t, ids.projectId, ids.ownerId, "PostureUp", 5);
      expect(await owner.query(api.workspace.access.myBusinesses, {})).toEqual([]);
    }
    const { t, ids } = await seed(ON);
    await makeBusiness(t, ids.projectId, ids.ownerId, "PostureUp", 5);
    expect(await t.query(api.workspace.access.myBusinesses, {})).toEqual([]);
  });
  test(`lists at most MY_BUSINESSES_MAX (${MY_BUSINESSES_MAX}) businesses, the newest ones`, async () => {
    const { t, owner, ids } = await seed(ON);
    const total = MY_BUSINESSES_MAX + 2;
    const made: Id<"projects">[] = [];
    for (let i = 0; i < total; i += 1) {
      const projectId = await t.run(async (ctx) => await ctx.db.insert("projects", {
        ownerId: ids.ownerId, source: "own_idea", title: `Biz ${i}`, status: "draft", idempotencyKey: `cap-${i}`, createdAt: 1, updatedAt: 1,
      }));
      await makeBusiness(t, projectId, ids.ownerId, `Biz${i}`, 100 + i);
      made.push(projectId);
    }
    const listed = await owner.query(api.workspace.access.myBusinesses, {});
    expect(listed).toHaveLength(MY_BUSINESSES_MAX);
    // Newest first: the two oldest are the ones left out.
    expect(listed.map((row) => row.projectId)).toEqual([...made].reverse().slice(0, MY_BUSINESSES_MAX));
    expect(listed.map((row) => row.projectId)).not.toContain(made[0]);
    expect(listed.map((row) => row.projectId)).not.toContain(made[1]);
  });

  test("an unexpected fault is rethrown, not reported as an empty list", async () => {
    const { t, owner, ids } = await seed(ON);
    await makeBusiness(t, ids.projectId, ids.ownerId, "PostureUp", 5);
    // A second singleton row makes C-OPS `.unique()` throw a plain Error, not an access denial.
    await t.run(async (ctx) => {
      const settings = await ctx.db.query("ops_settings").first();
      if (settings === null) throw new Error("fixture missing ops_settings");
      const { _id, _creationTime, ...row } = settings;
      void _id;
      void _creationTime;
      await ctx.db.insert("ops_settings", row);
    });
    await expect(owner.query(api.workspace.access.myBusinesses, {})).rejects.toThrow(/unique|more than one|multiple/i);
  });
});
