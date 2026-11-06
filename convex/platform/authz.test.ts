/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import {
  PLATFORM_AUTH_ERROR,
  requireBusinessAccess,
  requireCurrentPlatformUser,
  requireOwnedProject,
  requireOwnedProjectChild,
  requireOwnedWizardSession,
} from "./authz";

const modules = import.meta.glob("../**/*.ts");

type Fixture = {
  ownerId: Id<"users">;
  strangerId: Id<"users">;
  ownerSessionId: Id<"authSessions">;
  strangerSessionId: Id<"authSessions">;
  ownerProjectId: Id<"projects">;
  strangerProjectId: Id<"projects">;
  ownerDocumentId: Id<"documents">;
  forgedDocumentId: Id<"documents">;
};

async function seedFixture(t: TestConvex<typeof schema>): Promise<Fixture> {
  return await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const strangerId = await ctx.db.insert("users", {
      email: "stranger@example.test",
    });
    const ownerSessionId = await ctx.db.insert("authSessions", {
      userId: ownerId,
      expirationTime: 9_999_999_999_999,
    });
    const strangerSessionId = await ctx.db.insert("authSessions", {
      userId: strangerId,
      expirationTime: 9_999_999_999_999,
    });
    const ownerProjectId = await ctx.db.insert("projects", {
      ownerId,
      source: "own_idea",
      title: "Owner project",
      status: "draft",
      idempotencyKey: "owner-project",
      createdAt: 1,
      updatedAt: 1,
    });
    const strangerProjectId = await ctx.db.insert("projects", {
      ownerId: strangerId,
      source: "own_idea",
      title: "Stranger project",
      status: "draft",
      idempotencyKey: "stranger-project",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerDocumentId = await ctx.db.insert("documents", {
      ownerId,
      projectId: ownerProjectId,
      kind: "brief",
      format: "text",
      title: "Owner document",
      body: "private",
      createdAt: 1,
      updatedAt: 1,
    });
    const forgedDocumentId = await ctx.db.insert("documents", {
      ownerId,
      projectId: strangerProjectId,
      kind: "brief",
      format: "text",
      title: "Forged parent",
      body: "private",
      createdAt: 1,
      updatedAt: 1,
    });
    return {
      ownerId,
      strangerId,
      ownerSessionId,
      strangerSessionId,
      ownerProjectId,
      strangerProjectId,
      ownerDocumentId,
      forgedDocumentId,
    };
  });
}

function asUser(
  t: TestConvex<typeof schema>,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
) {
  return t.withIdentity({
    subject: `${userId}|${sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${userId}`,
  });
}

describe("platform owner-only authorization", () => {
  test("pre-business wizard guard hides other-owner, missing, abandoned and linked sessions", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const ids = await t.run(async (ctx) => {
      const workspaceFor = (wizardSessionId: Id<"wizard_sessions">, slug: string) => ({
        version: 1 as const,
        name: slug,
        slug,
        platform: "web",
        commercialModel: "free",
        goal: "waitlist",
        partner: { personality: "strategist", name: "Wren" },
        wizardSessionId,
        createdVia: "wizard" as const,
      });
      const active = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Test idea" } },
        startedAt: 1,
        updatedAt: 1,
      });
      const otherOwner = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.strangerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Other idea" } },
        startedAt: 1,
        updatedAt: 1,
      });
      const abandoned = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Abandoned idea" } },
        startedAt: 1,
        updatedAt: 1,
        abandonedAt: 2,
      });
      const linked = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Linked idea" } },
        startedAt: 1,
        updatedAt: 1,
        projectId: fixture.ownerProjectId,
      });
      await ctx.db.patch("projects", fixture.ownerProjectId, {
        workspace: workspaceFor(linked, "linked-business"),
      });
      const forgedLink = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Forged link" } },
        startedAt: 1,
        updatedAt: 1,
        projectId: fixture.strangerProjectId,
      });
      const wrongProjectId = await ctx.db.insert("projects", {
        ownerId: fixture.ownerId,
        workspace: workspaceFor(active, "wrong-business"),
        source: "own_idea",
        title: "Wrong project",
        status: "draft",
        idempotencyKey: "wrong-project",
        createdAt: 1,
        updatedAt: 1,
      });
      const wrongLink = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Wrong link" } },
        startedAt: 1,
        updatedAt: 1,
        projectId: wrongProjectId,
      });
      const legacyProjectId = await ctx.db.insert("projects", {
        ownerId: fixture.ownerId,
        source: "own_idea",
        title: "Legacy project",
        status: "draft",
        idempotencyKey: "legacy-project",
        createdAt: 1,
        updatedAt: 1,
      });
      const legacyLink = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Legacy link" } },
        startedAt: 1,
        updatedAt: 1,
        projectId: legacyProjectId,
      });
      const archivedProjectId = await ctx.db.insert("projects", {
        ownerId: fixture.ownerId,
        workspace: workspaceFor(active, "archived-business"),
        source: "own_idea",
        title: "Archived project",
        status: "draft",
        idempotencyKey: "archived-project",
        createdAt: 1,
        updatedAt: 1,
      });
      const archivedLink = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Archived link" } },
        startedAt: 1,
        updatedAt: 1,
        projectId: archivedProjectId,
      });
      await ctx.db.patch("projects", archivedProjectId, {
        workspace: workspaceFor(archivedLink, "archived-business"),
        archivedAt: 2,
      });
      const missingProjectId = await ctx.db.insert("projects", {
        ownerId: fixture.ownerId,
        source: "own_idea",
        title: "Deleted project",
        status: "draft",
        idempotencyKey: "deleted-project",
        createdAt: 1,
        updatedAt: 1,
      });
      const missingLink = await ctx.db.insert("wizard_sessions", {
        ownerId: fixture.ownerId,
        step: "idea",
        answers: { idea: { source: "own_idea", text: "Missing link" } },
        startedAt: 1,
        updatedAt: 1,
        projectId: missingProjectId,
      });
      await ctx.db.delete("projects", missingProjectId);
      return { active, otherOwner, abandoned, linked, forgedLink, wrongLink, legacyLink, archivedLink, missingLink };
    });
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);
    const stranger = asUser(t, fixture.strangerId, fixture.strangerSessionId);

    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.active)))
      .resolves.toMatchObject({ _id: ids.active, ownerId: fixture.ownerId });
    await expect(stranger.run((ctx) => requireOwnedWizardSession(ctx, ids.active)))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.otherOwner)))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.abandoned)))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.linked)))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.linked, { allowLinked: true })))
      .resolves.toMatchObject({ _id: ids.linked, projectId: fixture.ownerProjectId });
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.forgedLink, { allowLinked: true })))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.wrongLink, { allowLinked: true })))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.legacyLink, { allowLinked: true })))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.archivedLink, { allowLinked: true })))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.missingLink, { allowLinked: true })))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await t.run(async (ctx) => { await ctx.db.delete("wizard_sessions", ids.active); });
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, ids.active)))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });

  test("wizard mutations enforce stored expiry while reactive reads stay clock-free", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const sessionId = await t.run(async (ctx) => await ctx.db.insert("wizard_sessions", {
      ownerId: fixture.ownerId,
      step: "idea",
      answers: { idea: { source: "own_idea", text: "Test idea" } },
      startedAt: 1,
      updatedAt: 1,
    }));
    await t.run(async (ctx) => { await ctx.db.patch("authSessions", fixture.ownerSessionId, { expirationTime: 1 }); });
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);
    await expect(owner.run((ctx) => requireOwnedWizardSession(ctx, sessionId)))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.unauthenticated);
    await expect(owner.run((ctx) => requireOwnedWizardSession({ auth: ctx.auth, db: ctx.db }, sessionId)))
      .resolves.toMatchObject({ _id: sessionId });
  });

  test("C-AUTHZ grants only the owner and hides missing, archived and other-owner businesses", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);
    const stranger = asUser(t, fixture.strangerId, fixture.strangerSessionId);

    await expect(owner.run((ctx) => requireBusinessAccess(ctx, fixture.ownerProjectId, "owner")))
      .resolves.toMatchObject({ _id: fixture.ownerProjectId, ownerId: fixture.ownerId });
    await expect(stranger.run((ctx) => requireBusinessAccess(ctx, fixture.ownerProjectId, "owner")))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(owner.run((ctx) => requireBusinessAccess(ctx, fixture.strangerProjectId, "owner")))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);

    await t.run(async (ctx) => { await ctx.db.patch("projects", fixture.ownerProjectId, { archivedAt: 2 }); });
    await expect(owner.run((ctx) => requireBusinessAccess(ctx, fixture.ownerProjectId, "owner")))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });

  test("C-AUTHZ rejects an expired stored session on mutation calls", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("authSessions", fixture.ownerSessionId, { expirationTime: 1 });
    });
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);
    await expect(owner.run((ctx) => requireBusinessAccess(ctx, fixture.ownerProjectId, "owner")))
      .rejects.toThrow(PLATFORM_AUTH_ERROR.unauthenticated);
  });

  test("denies anonymous and anonymous-user identities", async () => {
    const t = convexTest(schema, modules);
    await expect(t.run(requireCurrentPlatformUser)).rejects.toThrow(
      PLATFORM_AUTH_ERROR.unauthenticated,
    );

    let anonymousId!: Id<"users">;
    let sessionId!: Id<"authSessions">;
    await t.run(async (ctx) => {
      anonymousId = await ctx.db.insert("users", { isAnonymous: true });
      sessionId = await ctx.db.insert("authSessions", {
        userId: anonymousId,
        expirationTime: 9_999_999_999_999,
      });
    });
    await expect(
      asUser(t, anonymousId, sessionId).run(requireCurrentPlatformUser),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.unauthenticated);
  });

  test("loads the current owner's project and child", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);

    await expect(
      owner.run((ctx) => requireOwnedProject(ctx, fixture.ownerProjectId)),
    ).resolves.toMatchObject({ ownerId: fixture.ownerId });
    await expect(
      owner.run((ctx) =>
        requireOwnedProjectChild(
          ctx,
          "documents",
          fixture.ownerDocumentId,
          fixture.ownerProjectId,
        ),
      ),
    ).resolves.toMatchObject({ projectId: fixture.ownerProjectId });
  });

  test("returns the same generic denial for cross-owner IDs", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const stranger = asUser(t, fixture.strangerId, fixture.strangerSessionId);

    await expect(
      stranger.run((ctx) => requireOwnedProject(ctx, fixture.ownerProjectId)),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(
      stranger.run((ctx) =>
        requireOwnedProjectChild(
          ctx,
          "documents",
          fixture.ownerDocumentId,
          fixture.ownerProjectId,
        ),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });

  test("denies a child with a forged parent relationship", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);

    await expect(
      owner.run((ctx) =>
        requireOwnedProjectChild(
          ctx,
          "documents",
          fixture.forgedDocumentId,
          fixture.ownerProjectId,
        ),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });

  test("hides archived projects and archived children", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedFixture(t);
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);

    await t.run(async (ctx) => {
      await ctx.db.patch("documents", fixture.ownerDocumentId, { archivedAt: 2 });
    });
    await expect(
      owner.run((ctx) =>
        requireOwnedProjectChild(
          ctx,
          "documents",
          fixture.ownerDocumentId,
          fixture.ownerProjectId,
        ),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);

    await t.run(async (ctx) => {
      await ctx.db.patch("projects", fixture.ownerProjectId, { archivedAt: 3 });
    });
    await expect(
      owner.run((ctx) => requireOwnedProject(ctx, fixture.ownerProjectId)),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });
});
