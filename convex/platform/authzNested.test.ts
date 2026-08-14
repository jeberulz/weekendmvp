/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import {
  PLATFORM_AUTH_ERROR,
  requireOwnedAccountRecord,
  requireOwnedProjectChild,
} from "./authz";

const modules = import.meta.glob("../**/*.ts");

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

describe("nested platform ownership chains", () => {
  test("denies every same-owner cross-project nested foreign key", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", { email: "nested@example.test" });
      const sessionId = await ctx.db.insert("authSessions", {
        userId: ownerId,
        expirationTime: 9_999_999_999_999,
      });
      const projectAId = await ctx.db.insert("projects", {
        ownerId,
        source: "own_idea",
        title: "Project A",
        status: "draft",
        idempotencyKey: "nested-project-a",
        createdAt: 1,
        updatedAt: 1,
      });
      const projectBId = await ctx.db.insert("projects", {
        ownerId,
        source: "own_idea",
        title: "Project B",
        status: "draft",
        idempotencyKey: "nested-project-b",
        createdAt: 1,
        updatedAt: 1,
      });
      const taskAId = await ctx.db.insert("tasks", {
        ownerId,
        projectId: projectAId,
        type: "research",
        status: "queued",
        title: "Task A",
        idempotencyKey: "nested-task-a",
        createdAt: 1,
        updatedAt: 1,
      });
      const taskBId = await ctx.db.insert("tasks", {
        ownerId,
        projectId: projectBId,
        type: "research",
        status: "queued",
        title: "Task B",
        idempotencyKey: "nested-task-b",
        createdAt: 1,
        updatedAt: 1,
      });
      const documentAId = await ctx.db.insert("documents", {
        ownerId,
        projectId: projectAId,
        taskId: taskAId,
        kind: "research",
        format: "text",
        title: "Document A",
        createdAt: 1,
        updatedAt: 1,
      });
      const documentBId = await ctx.db.insert("documents", {
        ownerId,
        projectId: projectBId,
        taskId: taskBId,
        kind: "research",
        format: "text",
        title: "Document B",
        createdAt: 1,
        updatedAt: 1,
      });
      const siteConfigAId = await ctx.db.insert("site_configs", {
        ownerId,
        projectId: projectAId,
        status: "draft",
        createdAt: 1,
        updatedAt: 1,
      });
      const siteConfigBId = await ctx.db.insert("site_configs", {
        ownerId,
        projectId: projectBId,
        status: "draft",
        createdAt: 1,
        updatedAt: 1,
      });
      const siteVersionBId = await ctx.db.insert("site_versions", {
        ownerId,
        projectId: projectBId,
        siteConfigId: siteConfigBId,
        status: "draft",
        version: 1n,
        documentId: documentBId,
        createdAt: 1,
      });
      const purchaseBId = await ctx.db.insert("purchases", {
        ownerId,
        projectId: projectBId,
        provider: "stripe",
        status: "pending",
        amountMinor: 100n,
        currency: "gbp",
        credits: 1n,
        idempotencyKey: "nested-purchase-b",
        createdAt: 1,
        updatedAt: 1,
      });
      const accountId = await ctx.db.insert("credit_accounts", {
        ownerId,
        balance: 0n,
        createdAt: 1,
        updatedAt: 1,
      });

      const forgedBriefId = await ctx.db.insert("briefs", {
        ownerId,
        projectId: projectAId,
        status: "draft",
        revision: 1n,
        documentId: documentBId,
        createdAt: 1,
        updatedAt: 1,
      });
      const forgedStepId = await ctx.db.insert("task_steps", {
        ownerId,
        projectId: projectAId,
        taskId: taskBId,
        type: "research",
        status: "pending",
        position: 1n,
        createdAt: 1,
        updatedAt: 1,
      });
      const forgedDocumentId = await ctx.db.insert("documents", {
        ownerId,
        projectId: projectAId,
        taskId: taskBId,
        kind: "research",
        format: "text",
        title: "Forged task document",
        createdAt: 1,
        updatedAt: 1,
      });
      const forgedCitationId = await ctx.db.insert("document_citations", {
        ownerId,
        projectId: projectAId,
        documentId: documentBId,
        position: 1n,
        url: "https://example.test/forged",
        title: "Forged citation",
        createdAt: 1,
      });
      const forgedSiteConfigId = await ctx.db.insert("site_configs", {
        ownerId,
        projectId: projectAId,
        status: "draft",
        currentVersionId: siteVersionBId,
        createdAt: 1,
        updatedAt: 1,
      });
      const forgedSiteVersionId = await ctx.db.insert("site_versions", {
        ownerId,
        projectId: projectAId,
        siteConfigId: siteConfigBId,
        status: "draft",
        version: 2n,
        documentId: documentBId,
        createdAt: 1,
      });
      const forgedLeadId = await ctx.db.insert("leads", {
        ownerId,
        projectId: projectAId,
        siteConfigId: siteConfigBId,
        synthetic: true,
        createdAt: 1,
      });
      const forgedLedgerId = await ctx.db.insert("credit_ledger", {
        ownerId,
        accountId,
        projectId: projectAId,
        purchaseId: purchaseBId,
        taskId: taskBId,
        reason: "task_refund",
        delta: 1n,
        balanceAfter: 1n,
        idempotencyKey: "nested-ledger",
        createdAt: 1,
      });
      const forgedRunId = await ctx.db.insert("workflow_runs", {
        ownerId,
        projectId: projectAId,
        taskId: taskBId,
        type: "research",
        status: "queued",
        idempotencyKey: "nested-run",
        attempt: 1n,
        createdAt: 1,
        updatedAt: 1,
      });

      const deletedTaskId = await ctx.db.insert("tasks", {
        ownerId,
        projectId: projectAId,
        type: "research",
        status: "queued",
        title: "Deleted task fixture",
        idempotencyKey: "deleted-task",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.delete("tasks", deletedTaskId);
      const missingParentDocumentId = await ctx.db.insert("documents", {
        ownerId,
        projectId: projectAId,
        taskId: deletedTaskId,
        kind: "research",
        format: "text",
        title: "Missing parent document",
        createdAt: 1,
        updatedAt: 1,
      });

      return {
        ownerId,
        sessionId,
        projectAId,
        valid: { taskAId, documentAId, siteConfigAId },
        forged: {
          briefs: forgedBriefId,
          task_steps: forgedStepId,
          documents: forgedDocumentId,
          document_citations: forgedCitationId,
          site_configs: forgedSiteConfigId,
          site_versions: forgedSiteVersionId,
          leads: forgedLeadId,
          credit_ledger: forgedLedgerId,
          workflow_runs: forgedRunId,
        },
        missingParentDocumentId,
      };
    });
    const owner = asUser(t, fixture.ownerId, fixture.sessionId);

    const forgedChecks = [
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "briefs",
            fixture.forged.briefs,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "task_steps",
            fixture.forged.task_steps,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "documents",
            fixture.forged.documents,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "document_citations",
            fixture.forged.document_citations,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "site_configs",
            fixture.forged.site_configs,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "site_versions",
            fixture.forged.site_versions,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "leads",
            fixture.forged.leads,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "credit_ledger",
            fixture.forged.credit_ledger,
            fixture.projectAId,
          ),
        ),
      () =>
        owner.run((ctx) =>
          requireOwnedProjectChild(
            ctx,
            "workflow_runs",
            fixture.forged.workflow_runs,
            fixture.projectAId,
          ),
        ),
    ];
    for (const check of forgedChecks) {
      await expect(check()).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    }
    await expect(
      owner.run((ctx) =>
        requireOwnedProjectChild(
          ctx,
          "documents",
          fixture.missingParentDocumentId,
          fixture.projectAId,
        ),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });

  test("supports account-level rows and preserves project-chain enforcement", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", { email: "account@example.test" });
      const strangerId = await ctx.db.insert("users", {
        email: "account-stranger@example.test",
      });
      const ownerSessionId = await ctx.db.insert("authSessions", {
        userId: ownerId,
        expirationTime: 9_999_999_999_999,
      });
      const strangerSessionId = await ctx.db.insert("authSessions", {
        userId: strangerId,
        expirationTime: 9_999_999_999_999,
      });
      const projectAId = await ctx.db.insert("projects", {
        ownerId,
        source: "own_idea",
        title: "Account project A",
        status: "draft",
        idempotencyKey: "account-project-a",
        createdAt: 1,
        updatedAt: 1,
      });
      const projectBId = await ctx.db.insert("projects", {
        ownerId,
        source: "own_idea",
        title: "Account project B",
        status: "draft",
        idempotencyKey: "account-project-b",
        createdAt: 1,
        updatedAt: 1,
      });
      const taskAId = await ctx.db.insert("tasks", {
        ownerId,
        projectId: projectAId,
        type: "research",
        status: "failed",
        title: "Account task A",
        idempotencyKey: "account-task-a",
        createdAt: 1,
        updatedAt: 1,
      });
      const taskBId = await ctx.db.insert("tasks", {
        ownerId,
        projectId: projectBId,
        type: "research",
        status: "failed",
        title: "Account task B",
        idempotencyKey: "account-task-b",
        createdAt: 1,
        updatedAt: 1,
      });
      const ownerAccountId = await ctx.db.insert("credit_accounts", {
        ownerId,
        balance: 1n,
        createdAt: 1,
        updatedAt: 1,
      });
      const strangerAccountId = await ctx.db.insert("credit_accounts", {
        ownerId: strangerId,
        balance: 0n,
        createdAt: 1,
        updatedAt: 1,
      });
      const accountAuditId = await ctx.db.insert("audit_events", {
        ownerId,
        actorType: "system",
        action: "account.created",
        subjectType: "credit_account",
        subjectId: ownerAccountId,
        createdAt: 1,
      });
      const accountLedgerId = await ctx.db.insert("credit_ledger", {
        ownerId,
        accountId: ownerAccountId,
        reason: "purchase_grant",
        delta: 1n,
        balanceAfter: 1n,
        idempotencyKey: "account-ledger",
        createdAt: 1,
      });
      const projectAuditId = await ctx.db.insert("audit_events", {
        ownerId,
        projectId: projectAId,
        actorType: "user",
        actorUserId: ownerId,
        action: "project.updated",
        subjectType: "project",
        subjectId: projectAId,
        createdAt: 1,
      });
      const projectLedgerId = await ctx.db.insert("credit_ledger", {
        ownerId,
        accountId: ownerAccountId,
        projectId: projectAId,
        taskId: taskAId,
        reason: "task_refund",
        delta: 1n,
        balanceAfter: 2n,
        idempotencyKey: "project-ledger",
        createdAt: 1,
      });
      const forgedProjectLedgerId = await ctx.db.insert("credit_ledger", {
        ownerId,
        accountId: ownerAccountId,
        projectId: projectAId,
        taskId: taskBId,
        reason: "task_refund",
        delta: 1n,
        balanceAfter: 3n,
        idempotencyKey: "forged-project-ledger",
        createdAt: 1,
      });
      const forgedAccountLedgerId = await ctx.db.insert("credit_ledger", {
        ownerId,
        accountId: strangerAccountId,
        reason: "purchase_grant",
        delta: 1n,
        balanceAfter: 4n,
        idempotencyKey: "forged-account-ledger",
        createdAt: 1,
      });
      return {
        ownerId,
        strangerId,
        ownerSessionId,
        strangerSessionId,
        accountAuditId,
        accountLedgerId,
        projectAuditId,
        projectLedgerId,
        forgedProjectLedgerId,
        forgedAccountLedgerId,
      };
    });
    const owner = asUser(t, fixture.ownerId, fixture.ownerSessionId);
    const stranger = asUser(t, fixture.strangerId, fixture.strangerSessionId);

    const accountAudit = await owner.run((ctx) =>
      requireOwnedAccountRecord(ctx, "audit_events", fixture.accountAuditId),
    );
    const accountLedger = await owner.run((ctx) =>
      requireOwnedAccountRecord(ctx, "credit_ledger", fixture.accountLedgerId),
    );
    expect(accountAudit.projectId).toBeUndefined();
    expect(accountLedger.projectId).toBeUndefined();
    await expect(
      owner.run((ctx) =>
        requireOwnedAccountRecord(ctx, "audit_events", fixture.projectAuditId),
      ),
    ).resolves.toMatchObject({ projectId: expect.any(String) });
    await expect(
      owner.run((ctx) =>
        requireOwnedAccountRecord(ctx, "credit_ledger", fixture.projectLedgerId),
      ),
    ).resolves.toMatchObject({ projectId: expect.any(String) });

    await expect(
      stranger.run((ctx) =>
        requireOwnedAccountRecord(ctx, "audit_events", fixture.accountAuditId),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(
      stranger.run((ctx) =>
        requireOwnedAccountRecord(ctx, "credit_ledger", fixture.accountLedgerId),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(
      owner.run((ctx) =>
        requireOwnedAccountRecord(
          ctx,
          "credit_ledger",
          fixture.forgedProjectLedgerId,
        ),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
    await expect(
      owner.run((ctx) =>
        requireOwnedAccountRecord(
          ctx,
          "credit_ledger",
          fixture.forgedAccountLedgerId,
        ),
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);
  });
});
