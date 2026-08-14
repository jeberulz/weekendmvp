/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import {
  PLATFORM_AUTH_ERROR,
  requireCurrentPlatformUser,
  requireOwnedProject,
  requireOwnedProjectChild,
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
