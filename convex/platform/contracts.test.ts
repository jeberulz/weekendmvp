/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import {
  PLATFORM_AUTH_ERROR,
  PROJECT_CHILD_TABLE_NAMES,
  type ProjectChildTable,
  requireOwnedProjectChild,
  requireOwnedRecord,
} from "./authz";
import {
  APPEND_ONLY_TABLE_NAMES,
  MAX_GENERATED_DOCUMENT_BODY_BYTES,
  assertGeneratedDocumentBody,
} from "./validators";

const modules = import.meta.glob("../**/*.ts");

const FROZEN_TABLES = [
  "projects",
  "briefs",
  "submissions",
  "idea_intents",
  "tasks",
  "task_steps",
  "documents",
  "document_citations",
  "site_configs",
  "site_versions",
  "leads",
  "audit_events",
  "credit_accounts",
  "credit_ledger",
  "purchases",
  "workflow_runs",
] as const;

const REQUIRED_INDEXES = {
  projects: [
    "by_ownerId_and_updatedAt",
    "by_ownerId_and_status_and_updatedAt",
    "by_ownerId_and_idempotencyKey",
    "by_ownerId_and_sourceIdeaId",
    "by_ownerId_and_sourceIdeaId_and_archivedAt",
  ],
  briefs: [
    "by_projectId_and_status_and_updatedAt",
    "by_ownerId_and_projectId_and_revision",
  ],
  submissions: [
    "by_ownerId_and_idempotencyKey",
    "by_projectId_and_status_and_createdAt",
  ],
  idea_intents: [
    "by_ownerId_and_ideaId",
    "by_ownerId_and_updatedAt",
    "by_ownerId_and_saved_and_updatedAt",
    "by_ownerId_and_interested_and_updatedAt",
  ],
  tasks: [
    "by_ownerId_and_idempotencyKey",
    "by_projectId_and_createdAt",
    "by_projectId_and_status_and_createdAt",
  ],
  task_steps: ["by_taskId_and_position", "by_projectId_and_status_and_createdAt"],
  documents: [
    "by_projectId_and_updatedAt",
    "by_projectId_and_kind_and_updatedAt",
    "by_taskId_and_createdAt",
  ],
  document_citations: ["by_documentId_and_position", "by_projectId_and_createdAt"],
  site_configs: [
    "by_ownerId_and_projectId",
    "by_hostname",
    "by_ownerId_and_status_and_updatedAt",
  ],
  site_versions: [
    "by_siteConfigId_and_version",
    "by_projectId_and_status_and_createdAt",
  ],
  leads: [
    "by_projectId_and_createdAt",
    "by_siteConfigId_and_createdAt",
    "by_ownerId_and_createdAt",
  ],
  audit_events: ["by_ownerId_and_createdAt", "by_projectId_and_createdAt"],
  credit_accounts: ["by_ownerId"],
  credit_ledger: [
    "by_accountId_and_createdAt",
    "by_ownerId_and_idempotencyKey",
    "by_provider_and_providerEventId",
  ],
  purchases: [
    "by_ownerId_and_idempotencyKey",
    "by_ownerId_and_status_and_createdAt",
    "by_provider_and_providerCheckoutSessionId",
    "by_provider_and_providerPaymentIntentId",
  ],
  workflow_runs: [
    "by_ownerId_and_idempotencyKey",
    "by_projectId_and_status_and_createdAt",
    "by_taskId_and_createdAt",
    "by_status_and_createdAt",
  ],
} as const satisfies Record<(typeof FROZEN_TABLES)[number], readonly string[]>;

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

describe("WP22 frozen contract inventory", () => {
  test("contains every frozen table and required compound index", () => {
    expect(FROZEN_TABLES).toHaveLength(16);
    for (const tableName of FROZEN_TABLES) {
      expect(schema.tables).toHaveProperty(tableName);
      const indexes = schema.tables[tableName][" indexes"]().map(
        ({ indexDescriptor }) => indexDescriptor,
      );
      expect(indexes).toEqual(expect.arrayContaining([...REQUIRED_INDEXES[tableName]]));
    }
  });

  test("freezes ledger and audit tables as append-only consumers", () => {
    expect(APPEND_ONLY_TABLE_NAMES).toEqual(["audit_events", "credit_ledger"]);
  });

  test("enforces the generated body boundary in UTF-8 bytes", () => {
    const exactAscii = "a".repeat(MAX_GENERATED_DOCUMENT_BODY_BYTES);
    expect(assertGeneratedDocumentBody(exactAscii)).toBe(exactAscii);
    expect(() => assertGeneratedDocumentBody(`${exactAscii}a`)).toThrow(
      "DOCUMENT_BODY_TOO_LARGE",
    );

    const exactMultibyte = "😀".repeat(MAX_GENERATED_DOCUMENT_BODY_BYTES / 4);
    expect(assertGeneratedDocumentBody(exactMultibyte)).toBe(exactMultibyte);
    expect(() => assertGeneratedDocumentBody(`${exactMultibyte}😀`)).toThrow(
      "DOCUMENT_BODY_TOO_LARGE",
    );
  });
});

describe("WP22 bounded ownership and intent seams", () => {
  test("uses bounded exact indexes for idempotency and independent intents", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", { email: "intent@example.test" });
      const ideaId = await ctx.db.insert("ideas", {
        slug: "intent-idea",
        title: "Intent idea",
        description: "Intent idea",
        publishedAt: 1,
        category: "saas",
        buildTime: "weekend",
        revenueGoal: "1k",
        applicationCategory: "BusinessApplication",
        tools: [],
        audiences: [],
        bodyMode: "mdx",
      });
      const projectId = await ctx.db.insert("projects", {
        ownerId,
        source: "repository_idea",
        sourceIdeaId: ideaId,
        title: "Intent project",
        status: "building",
        idempotencyKey: "project-once",
        createdAt: 1,
        updatedAt: 1,
      });
      const intentId = await ctx.db.insert("idea_intents", {
        ownerId,
        ideaId,
        saved: true,
        interested: false,
        updatedAt: 1,
      });

      const exactProject = await ctx.db
        .query("projects")
        .withIndex("by_ownerId_and_idempotencyKey", (query) =>
          query.eq("ownerId", ownerId).eq("idempotencyKey", "project-once"),
        )
        .unique();
      const exactIntent = await ctx.db
        .query("idea_intents")
        .withIndex("by_ownerId_and_ideaId", (query) =>
          query.eq("ownerId", ownerId).eq("ideaId", ideaId),
        )
        .unique();
      const activeIdeaProject = await ctx.db
        .query("projects")
        .withIndex("by_ownerId_and_sourceIdeaId_and_archivedAt", (query) =>
          query
            .eq("ownerId", ownerId)
            .eq("sourceIdeaId", ideaId)
            .eq("archivedAt", undefined),
        )
        .first();

      expect(exactProject?._id).toBe(projectId);
      expect(exactIntent).toMatchObject({ saved: true, interested: false });
      expect(activeIdeaProject?._id).toBe(projectId);

      await ctx.db.patch("idea_intents", intentId, {
        interested: true,
        updatedAt: 2,
      });
      expect(await ctx.db.get("idea_intents", intentId)).toMatchObject({
        saved: true,
        interested: true,
      });
    });
  });

  test("makes duplicate compound idempotency visible to unique queries", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {});
        const project = {
          ownerId,
          source: "own_idea" as const,
          title: "Duplicate",
          status: "draft" as const,
          idempotencyKey: "duplicate",
          createdAt: 1,
          updatedAt: 1,
        };
        await ctx.db.insert("projects", project);
        await ctx.db.insert("projects", project);
        return await ctx.db
          .query("projects")
          .withIndex("by_ownerId_and_idempotencyKey", (query) =>
            query.eq("ownerId", ownerId).eq("idempotencyKey", "duplicate"),
          )
          .unique();
      }),
    ).rejects.toThrow();
  });

  test("denies swapped IDs for every project-child contract", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      async function createGraph(label: string) {
        const ownerId = await ctx.db.insert("users", {
          email: `${label}@example.test`,
        });
        const sessionId = await ctx.db.insert("authSessions", {
          userId: ownerId,
          expirationTime: 9_999_999_999_999,
        });
        const ideaId = await ctx.db.insert("ideas", {
          slug: `${label}-idea`,
          title: `${label} idea`,
          description: `${label} idea`,
          publishedAt: 1,
          category: "saas",
          buildTime: "weekend",
          revenueGoal: "1k",
          applicationCategory: "BusinessApplication",
          tools: [],
          audiences: [],
          bodyMode: "mdx",
        });
        const projectId = await ctx.db.insert("projects", {
          ownerId,
          source: "repository_idea",
          sourceIdeaId: ideaId,
          title: `${label} project`,
          status: "draft",
          idempotencyKey: `${label}-project`,
          createdAt: 1,
          updatedAt: 1,
        });
        const taskId = await ctx.db.insert("tasks", {
          ownerId,
          projectId,
          type: "research",
          status: "queued",
          title: `${label} task`,
          idempotencyKey: `${label}-task`,
          createdAt: 1,
          updatedAt: 1,
        });
        const documentId = await ctx.db.insert("documents", {
          ownerId,
          projectId,
          taskId,
          kind: "research",
          format: "text",
          title: `${label} document`,
          body: label,
          createdAt: 1,
          updatedAt: 1,
        });
        const siteConfigId = await ctx.db.insert("site_configs", {
          ownerId,
          projectId,
          status: "draft",
          createdAt: 1,
          updatedAt: 1,
        });
        const purchaseId = await ctx.db.insert("purchases", {
          ownerId,
          projectId,
          provider: "stripe",
          status: "pending",
          amountMinor: 100n,
          currency: "gbp",
          credits: 1n,
          idempotencyKey: `${label}-purchase`,
          createdAt: 1,
          updatedAt: 1,
        });
        const accountId = await ctx.db.insert("credit_accounts", {
          ownerId,
          balance: 0n,
          createdAt: 1,
          updatedAt: 1,
        });
        const childIds = {
          briefs: await ctx.db.insert("briefs", {
            ownerId,
            projectId,
            status: "draft",
            revision: 1n,
            documentId,
            createdAt: 1,
            updatedAt: 1,
          }),
          submissions: await ctx.db.insert("submissions", {
            ownerId,
            projectId,
            status: "draft",
            idempotencyKey: `${label}-submission`,
            payload: "{}",
            createdAt: 1,
            updatedAt: 1,
          }),
          tasks: taskId,
          task_steps: await ctx.db.insert("task_steps", {
            ownerId,
            projectId,
            taskId,
            type: "research",
            status: "pending",
            position: 0n,
            createdAt: 1,
            updatedAt: 1,
          }),
          documents: documentId,
          document_citations: await ctx.db.insert("document_citations", {
            ownerId,
            projectId,
            documentId,
            position: 0n,
            url: "https://example.test/source",
            title: "Source",
            createdAt: 1,
          }),
          site_configs: siteConfigId,
          site_versions: await ctx.db.insert("site_versions", {
            ownerId,
            projectId,
            siteConfigId,
            status: "draft",
            version: 1n,
            documentId,
            createdAt: 1,
          }),
          leads: await ctx.db.insert("leads", {
            ownerId,
            projectId,
            siteConfigId,
            synthetic: true,
            createdAt: 1,
          }),
          audit_events: await ctx.db.insert("audit_events", {
            ownerId,
            projectId,
            actorType: "user",
            actorUserId: ownerId,
            action: "fixture.created",
            subjectType: "project",
            subjectId: projectId,
            createdAt: 1,
          }),
          credit_ledger: await ctx.db.insert("credit_ledger", {
            ownerId,
            accountId,
            projectId,
            purchaseId,
            taskId,
            reason: "purchase_grant",
            delta: 1n,
            balanceAfter: 1n,
            idempotencyKey: `${label}-ledger`,
            createdAt: 1,
          }),
          purchases: purchaseId,
          workflow_runs: await ctx.db.insert("workflow_runs", {
            ownerId,
            projectId,
            taskId,
            type: "research",
            status: "queued",
            idempotencyKey: `${label}-run`,
            attempt: 1n,
            createdAt: 1,
            updatedAt: 1,
          }),
        } satisfies Record<ProjectChildTable, string>;
        const intentId = await ctx.db.insert("idea_intents", {
          ownerId,
          ideaId,
          saved: true,
          interested: false,
          updatedAt: 1,
        });
        return { ownerId, sessionId, projectId, accountId, intentId, childIds };
      }

      return {
        owner: await createGraph("owner"),
        stranger: await createGraph("stranger"),
      };
    });

    const owner = asUser(t, fixture.owner.ownerId, fixture.owner.sessionId);
    for (const tableName of PROJECT_CHILD_TABLE_NAMES) {
      await expect(
        owner.run(async (ctx) => {
          const ownId = ctx.db.normalizeId(
            tableName,
            fixture.owner.childIds[tableName],
          );
          if (ownId === null) throw new Error("Fixture ID did not normalize");
          return await requireOwnedProjectChild(
            ctx,
            tableName,
            ownId,
            fixture.owner.projectId,
          );
        }),
      ).resolves.toMatchObject({ ownerId: fixture.owner.ownerId });

      await expect(
        owner.run(async (ctx) => {
          const swappedId = ctx.db.normalizeId(
            tableName,
            fixture.stranger.childIds[tableName],
          );
          if (swappedId === null) throw new Error("Fixture ID did not normalize");
          return await requireOwnedProjectChild(
            ctx,
            tableName,
            swappedId,
            fixture.owner.projectId,
          );
        }),
      ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    }

    await expect(
      owner.run((ctx) =>
        requireOwnedRecord(ctx, "credit_accounts", fixture.stranger.accountId),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(
      owner.run((ctx) =>
        requireOwnedRecord(ctx, "idea_intents", fixture.stranger.intentId),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });
});
