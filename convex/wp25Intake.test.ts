/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { serializeBriefPayload } from "./platform/briefPayload";

const modules = import.meta.glob("./**/*.ts");

const ownIdea = {
  title: "Customer interview planner",
  problem:
    "Solo founders struggle to run consistent customer interviews and keep the evidence useful.",
  audience: "Indie founders preparing to validate a new product",
  outcome: "A repeatable interview plan with evidence captured in one place.",
  constraints: "Keep the first version focused on one founder and one active idea.",
};

type UserFixture = {
  userId: Id<"users">;
  sessionId: Id<"authSessions">;
};

async function seedUser(
  t: TestConvex<typeof schema>,
  email: string,
): Promise<UserFixture> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: 9_999_999_999_999,
    });
    return { userId, sessionId };
  });
}

function asUser(t: TestConvex<typeof schema>, fixture: UserFixture) {
  return t.withIdentity({
    subject: `${fixture.userId}|${fixture.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${fixture.userId}`,
  });
}

async function seedIdea(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("ideas", {
      slug: "customer-interview-planner",
      title: "Customer Interview Planner",
      description:
        "Turn a rough problem statement into a consistent customer interview workflow.",
      publishedAt: 100,
      category: "productivity",
      buildTime: "8",
      revenueGoal: "1k-month",
      applicationCategory: "BusinessApplication",
      tools: ["nextjs"],
      audiences: ["indie-founders"],
      scores: {
        opportunity: 8,
        pain: 7,
        timing: 8,
        builder_confidence: 9,
      },
      bodyMode: "mdx",
    });
  });
}

describe("WP25 project creation", () => {
  test("denies anonymous creation", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.platform.intake.startOwnIdea, {
        idempotencyKey: "browser-session-0001",
        input: ownIdea,
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  test("creates one complete own-idea graph for repeated and concurrent requests", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    const args = { idempotencyKey: "browser-session-0001", input: ownIdea };

    const [first, second] = await Promise.all([
      owner.mutation(api.platform.intake.startOwnIdea, args),
      owner.mutation(api.platform.intake.startOwnIdea, args),
    ]);
    expect(second.projectId).toBe(first.projectId);

    await t.run(async (ctx) => {
      expect(await ctx.db.query("projects").collect()).toHaveLength(1);
      expect(await ctx.db.query("submissions").collect()).toHaveLength(1);
      expect(await ctx.db.query("briefs").collect()).toHaveLength(1);
      expect(await ctx.db.query("documents").collect()).toHaveLength(1);
    });
  });

  test("returns the canonical winner for concurrent differing first saves", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    const firstInput = { ...ownIdea, title: "First tab wording" };
    const secondInput = { ...ownIdea, title: "Second tab wording" };

    const [first, second] = await Promise.all([
      owner.mutation(api.platform.intake.startOwnIdea, {
        idempotencyKey: "concurrent-different-input",
        input: firstInput,
      }),
      owner.mutation(api.platform.intake.startOwnIdea, {
        idempotencyKey: "concurrent-different-input",
        input: secondInput,
      }),
    ]);

    expect(second.projectId).toBe(first.projectId);
    expect(second.revision).toBe(first.revision);
    expect(second.updatedAt).toBe(first.updatedAt);
    expect(second.input).toEqual(first.input);
    expect([first.acceptedInput, second.acceptedInput].sort()).toEqual([
      false,
      true,
    ]);
    expect([firstInput, secondInput]).toContainEqual(first.input);

    const resumed = await owner.query(
      api.platform.intake.getOwnIdeaDraftByKey,
      { idempotencyKey: "concurrent-different-input" },
    );
    expect(resumed?.input).toEqual(first.input);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("projects").collect()).toHaveLength(1);
      expect(await ctx.db.query("submissions").collect()).toHaveLength(1);
      expect(await ctx.db.query("briefs").collect()).toHaveLength(1);
      expect(await ctx.db.query("documents").collect()).toHaveLength(1);
    });
  });

  test("persists and resumes partial first-entry answers before review", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    const partial = {
      title: "C",
      problem: "",
      audience: "",
      outcome: "",
      constraints: "",
    };
    const created = await owner.mutation(api.platform.intake.startOwnIdea, {
      idempotencyKey: "first-entry-session",
      input: partial,
    });
    const resumed = await owner.query(
      api.platform.intake.getOwnIdeaDraftByKey,
      { idempotencyKey: "first-entry-session" },
    );
    expect(resumed).toMatchObject({
      projectId: created.projectId,
      revision: 1n,
      input: partial,
    });
    await expect(
      owner.mutation(api.platform.intake.confirmBrief, {
        projectId: created.projectId,
        revision: 1n,
      }),
    ).rejects.toThrow("INVALID_BRIEF_FIELD");
    await t.run(async (ctx) => {
      expect((await ctx.db.get("projects", created.projectId))?.status).toBe(
        "draft",
      );
      expect(await ctx.db.query("projects").collect()).toHaveLength(1);
    });
  });

  test("resolves and freezes a repository source server-side", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    const ideaId = await seedIdea(t);

    const created = await owner.mutation(
      api.platform.intake.startRepositoryIdea,
      {
        idempotencyKey: "repository-start-0001",
        slug: "customer-interview-planner",
      },
    );
    await t.run(async (ctx) => {
      const project = await ctx.db.get("projects", created.projectId);
      const brief = await ctx.db.get("briefs", created.briefId);
      const document = brief?.documentId
        ? await ctx.db.get("documents", brief.documentId)
        : null;
      const payload = JSON.parse(document?.body ?? "null");
      expect(project).toMatchObject({
        source: "repository_idea",
        sourceIdeaId: ideaId,
        title: "Customer Interview Planner",
      });
      expect(payload.sourceSnapshot).toMatchObject({
        ideaId,
        slug: "customer-interview-planner",
        title: "Customer Interview Planner",
        publishedAt: 100,
      });
    });
    await expect(
      owner.mutation(api.platform.intake.startRepositoryIdea, {
        idempotencyKey: "repository-start-0002",
        slug: "not-a-real-idea",
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  test("scopes the same idempotency key independently per owner", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    const stranger = asUser(t, await seedUser(t, "stranger@example.test"));
    const args = { idempotencyKey: "browser-session-shared", input: ownIdea };
    const first = await owner.mutation(api.platform.intake.startOwnIdea, args);
    const second = await stranger.mutation(api.platform.intake.startOwnIdea, args);
    expect(second.projectId).not.toBe(first.projectId);
  });
});

describe("WP25 brief lifecycle", () => {
  test("saves, confirms, revises, and supersedes without mutating confirmed documents", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    const created = await owner.mutation(api.platform.intake.startOwnIdea, {
      idempotencyKey: "lifecycle-session-0001",
      input: ownIdea,
    });
    const changed = { ...ownIdea, outcome: `${ownIdea.outcome} Start with five interviews.` };
    const saved = await owner.mutation(api.platform.intake.saveDraft, {
      projectId: created.projectId,
      revision: 1n,
      expectedUpdatedAt: await t.run(async (ctx) =>
        (await ctx.db.get("briefs", created.briefId))!.updatedAt),
      input: changed,
    });
    await owner.mutation(api.platform.intake.confirmBrief, {
      projectId: created.projectId,
      revision: 1n,
    });
    const firstBody = await t.run(async (ctx) => {
      const brief = await ctx.db.get("briefs", created.briefId);
      return (await ctx.db.get("documents", brief!.documentId!))!.body;
    });

    const revision = await owner.mutation(api.platform.intake.beginRevision, {
      projectId: created.projectId,
      confirmedRevision: 1n,
    });
    const revised = { ...changed, constraints: "Run ten interviews before adding automation." };
    await owner.mutation(api.platform.intake.saveDraft, {
      projectId: created.projectId,
      revision: 2n,
      expectedUpdatedAt: await t.run(async (ctx) =>
        (await ctx.db.get("briefs", revision.briefId))!.updatedAt),
      input: revised,
    });
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.get("briefs", created.briefId))!.status,
      ),
    ).toBe("confirmed");
    expect(
      await t.run(async (ctx) => {
        const brief = await ctx.db.get("briefs", created.briefId);
        return (await ctx.db.get("documents", brief!.documentId!))!.body;
      }),
    ).toBe(firstBody);

    await owner.mutation(api.platform.intake.confirmBrief, {
      projectId: created.projectId,
      revision: 2n,
    });
    await expect(
      owner.mutation(api.platform.intake.confirmBrief, {
        projectId: created.projectId,
        revision: 2n,
      }),
    ).resolves.toMatchObject({ status: "confirmed" });
    await t.run(async (ctx) => {
      expect((await ctx.db.get("briefs", created.briefId))?.status).toBe(
        "superseded",
      );
      expect((await ctx.db.get("briefs", revision.briefId))?.status).toBe(
        "confirmed",
      );
      expect((await ctx.db.get("projects", created.projectId))?.status).toBe(
        "validating",
      );
    });
    expect(saved.revision).toBe(1n);
  });

  test("rejects stale writes, stale confirms, archived projects, and cross-owner graph swaps", async () => {
    const t = convexTest(schema, modules);
    const ownerFixture = await seedUser(t, "owner@example.test");
    const strangerFixture = await seedUser(t, "stranger@example.test");
    const owner = asUser(t, ownerFixture);
    const stranger = asUser(t, strangerFixture);
    const created = await owner.mutation(api.platform.intake.startOwnIdea, {
      idempotencyKey: "stale-session-0001",
      input: ownIdea,
    });
    const originalUpdatedAt = await t.run(async (ctx) =>
      (await ctx.db.get("briefs", created.briefId))!.updatedAt,
    );
    await owner.mutation(api.platform.intake.saveDraft, {
      projectId: created.projectId,
      revision: 1n,
      expectedUpdatedAt: originalUpdatedAt,
      input: { ...ownIdea, audience: "Bootstrapped founders testing B2B software" },
    });
    await expect(
      owner.mutation(api.platform.intake.saveDraft, {
        projectId: created.projectId,
        revision: 1n,
        expectedUpdatedAt: originalUpdatedAt,
        input: { ...ownIdea, audience: "A different stale audience" },
      }),
    ).rejects.toThrow("STALE_BRIEF_WRITE");
    await expect(
      stranger.query(api.platform.projects.getOwned, {
        projectId: created.projectId,
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      stranger.mutation(api.platform.intake.confirmBrief, {
        projectId: created.projectId,
        revision: 1n,
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");

    await t.run(async (ctx) => {
      await ctx.db.patch("projects", created.projectId, { archivedAt: 999 });
    });
    await expect(
      owner.query(api.platform.projects.getOwned, {
        projectId: created.projectId,
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  test("preserves the repository snapshot across user edits and revisions", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    await seedIdea(t);
    const created = await owner.mutation(
      api.platform.intake.startRepositoryIdea,
      {
        idempotencyKey: "repository-lifecycle-01",
        slug: "customer-interview-planner",
      },
    );
    const original = await t.run(async (ctx) => {
      const brief = await ctx.db.get("briefs", created.briefId);
      const document = await ctx.db.get("documents", brief!.documentId!);
      return JSON.parse(document!.body!).sourceSnapshot;
    });
    const brief = await t.run(async (ctx) => ctx.db.get("briefs", created.briefId));
    await owner.mutation(api.platform.intake.saveDraft, {
      projectId: created.projectId,
      revision: 1n,
      expectedUpdatedAt: brief!.updatedAt,
      input: { ...ownIdea, title: "A custom working title" },
    });
    const updated = await t.run(async (ctx) => {
      const current = await ctx.db.get("briefs", created.briefId);
      const document = await ctx.db.get("documents", current!.documentId!);
      return JSON.parse(document!.body!).sourceSnapshot;
    });
    expect(updated).toEqual(original);
  });

  test("fails closed on forged brief-document relationships and oversized documents", async () => {
    const t = convexTest(schema, modules);
    const ownerFixture = await seedUser(t, "owner@example.test");
    const strangerFixture = await seedUser(t, "stranger@example.test");
    const owner = asUser(t, ownerFixture);
    const created = await owner.mutation(api.platform.intake.startOwnIdea, {
      idempotencyKey: "forged-graph-session",
      input: ownIdea,
    });
    await t.run(async (ctx) => {
      const strangerProjectId = await ctx.db.insert("projects", {
        ownerId: strangerFixture.userId,
        source: "own_idea",
        title: "Stranger project",
        status: "draft",
        idempotencyKey: "stranger-forged-graph",
        createdAt: 1,
        updatedAt: 1,
      });
      const forgedDocumentId = await ctx.db.insert("documents", {
        ownerId: strangerFixture.userId,
        projectId: strangerProjectId,
        kind: "brief",
        format: "json",
        title: "Forged",
        body: JSON.stringify({ contractVersion: 1, source: "own_idea", brief: ownIdea }),
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.patch("briefs", created.briefId, {
        documentId: forgedDocumentId,
      });
    });
    await expect(
      owner.mutation(api.platform.intake.saveDraft, {
        projectId: created.projectId,
        revision: 1n,
        expectedUpdatedAt: created.updatedAt,
        input: { ...ownIdea, title: "Changed title" },
      }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");

    expect(() =>
      serializeBriefPayload({
        contractVersion: 1,
        source: "own_idea",
        brief: { ...ownIdea, problem: "x".repeat(256 * 1024) },
      }),
    ).toThrow("DOCUMENT_BODY_TOO_LARGE");
  });
});

describe("WP25 project queries", () => {
  test("returns bounded owner-only cards and a resumable draft", async () => {
    const t = convexTest(schema, modules);
    const owner = asUser(t, await seedUser(t, "owner@example.test"));
    await owner.mutation(api.platform.intake.startOwnIdea, {
      idempotencyKey: "query-session-0001",
      input: ownIdea,
    });
    const resumable = await owner.query(
      api.platform.intake.getOwnIdeaDraftByKey,
      { idempotencyKey: "query-session-0001" },
    );
    expect(resumable?.input).toEqual(ownIdea);
    const projects = await owner.query(api.platform.projects.listOwned, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(projects.page).toHaveLength(1);
    expect(projects.page[0]).toMatchObject({
      source: "own_idea",
      nextAction: "resume_brief",
    });
    await expect(
      owner.query(api.platform.projects.listOwned, {
        paginationOpts: { numItems: 5_000, cursor: null },
      }),
    ).rejects.toThrow("INVALID_PAGE_SIZE");
  });

  test("resumes by exact key beyond any recent-project horizon and hides other owners", async () => {
    const t = convexTest(schema, modules);
    const ownerFixture = await seedUser(t, "owner@example.test");
    const strangerFixture = await seedUser(t, "stranger@example.test");
    const owner = asUser(t, ownerFixture);
    const stranger = asUser(t, strangerFixture);
    const created = await owner.mutation(api.platform.intake.startOwnIdea, {
      idempotencyKey: "exact-resume-session",
      input: { ...ownIdea, title: "Old resumable draft" },
    });
    await t.run(async (ctx) => {
      for (let index = 0; index < 35; index += 1) {
        await ctx.db.insert("projects", {
          ownerId: ownerFixture.userId,
          source: "own_idea",
          title: `Newer project ${index}`,
          status: "draft",
          idempotencyKey: `newer-project-${index}`,
          createdAt: 10_000 + index,
          updatedAt: 10_000 + index,
        });
      }
    });
    await expect(
      owner.query(api.platform.intake.getOwnIdeaDraftByKey, {
        idempotencyKey: "exact-resume-session",
      }),
    ).resolves.toMatchObject({ projectId: created.projectId });
    await expect(
      stranger.query(api.platform.intake.getOwnIdeaDraftByKey, {
        idempotencyKey: "exact-resume-session",
      }),
    ).resolves.toBeNull();
  });
});
