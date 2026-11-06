import { register as registerResend } from "@convex-dev/resend/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { LEAD_RETENTION_WINDOW_MS } from "./retention";

const modules = import.meta.glob("/convex/**/*.ts");
const dueWorker = internal.platform.sites.retention.purgeDueProjectLeads;
const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const t = convexTest(schema, modules);
  registerResend(t);
  return { t, component: components.resend };
}

async function seed(
  t: TestConvex<typeof schema>,
  options: { count?: number; real?: boolean; requestAt?: number } = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const requestAt = options.requestAt ?? now - 31 * DAY;
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const projectId = await ctx.db.insert("projects", {
      ownerId, source: "own_idea", title: "Delete after request", status: "draft",
      idempotencyKey: "wp78:due:test", createdAt: now, updatedAt: now,
      archivedAt: requestAt, deletionRequestedAt: requestAt,
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId, projectId, status: "draft", createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: false,
      cohortMode: "allowlist", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: {
        ai: true, studioVideo: true, publish: true, email: true,
        social: true, ads: true,
      },
      updatedAt: now,
    });
    const leadIds: Id<"leads">[] = [];
    for (let n = 0; n < (options.count ?? 1); n += 1) {
      leadIds.push(await ctx.db.insert("leads", {
        ownerId, projectId, siteConfigId, synthetic: !options.real,
        ...(options.real ? {
          email: `contact${n}@example.test`, payload: "{}",
          consentText: "Join the waitlist", consentVersion: "v1",
        } : {}),
        createdAt: now + n,
      }));
    }
    const jobId = await ctx.db.insert("lead_retention_jobs", {
      ownerId, projectId, deletionRequestedAt: requestAt,
      deleteDueAt: requestAt + LEAD_RETENTION_WINDOW_MS,
      nextAttemptAt: requestAt + LEAD_RETENTION_WINDOW_MS,
      state: "scheduled", attempts: 0, processedCount: 0,
      createdAt: now, updatedAt: now,
    });
    return { ownerId, projectId, siteConfigId, leadIds, jobId, requestAt };
  });
}

describe("WP78 due lead cleanup", () => {
  test("runs with workspace off, deletes one lead at a time, and completes only after the last", async () => {
    const { t } = setup();
    const ids = await seed(t, { count: 3 });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 1, more: true });
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[1]))).not.toBeNull();
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 1, more: true });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 1, more: false });
    const job = await t.run((ctx) => ctx.db.get(ids.jobId));
    expect(job).toMatchObject({ state: "complete", attempts: 3, processedCount: 3 });
    expect(job?.completedAt).toBeTypeOf("number");
    await expect(t.mutation(dueWorker, { jobId: ids.jobId }))
      .rejects.toThrow("LEAD_RETENTION_NOT_SCHEDULED");
  });

  test("completes an empty due job without inventing a deleted lead", async () => {
    const { t } = setup();
    const ids = await seed(t, { count: 0 });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 0, more: false });
    expect(await t.run((ctx) => ctx.db.get(ids.jobId)))
      .toMatchObject({ state: "complete", processedCount: 0 });
  });

  test("refuses the 30-day boundary before it arrives", async () => {
    const { t } = setup();
    const ids = await seed(t, {
      requestAt: Date.now() - LEAD_RETENTION_WINDOW_MS + 60_000,
    });
    await expect(t.mutation(dueWorker, { jobId: ids.jobId }))
      .rejects.toThrow("LEAD_RETENTION_NOT_DUE");
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).not.toBeNull();
  });

  test("duplicate jobs and mismatched epochs cannot delete a lead", async () => {
    const { t } = setup();
    const ids = await seed(t);
    await t.run((ctx) => ctx.db.patch(ids.jobId, {
      deletionRequestedAt: ids.requestAt + 1,
    }));
    await expect(t.mutation(dueWorker, { jobId: ids.jobId }))
      .rejects.toThrow("LEAD_DELETE_REQUEST_REQUIRED");
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.jobId, { deletionRequestedAt: ids.requestAt });
      await ctx.db.insert("lead_retention_jobs", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        deletionRequestedAt: ids.requestAt,
        deleteDueAt: ids.requestAt + LEAD_RETENTION_WINDOW_MS,
        nextAttemptAt: ids.requestAt + LEAD_RETENTION_WINDOW_MS,
        state: "scheduled", attempts: 0, processedCount: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
    });
    await expect(t.mutation(dueWorker, { jobId: ids.jobId }))
      .rejects.toThrow("LEAD_RETENTION_DUPLICATE_JOB");
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).not.toBeNull();
  });

  test("revokes real-lead mail and token before physical deletion", async () => {
    const { t, component } = setup();
    const ids = await seed(t, { real: true });
    const queuedId = await t.mutation(component.lib.createManualEmail, {
      from: "sender@example.test", to: "contact0@example.test", subject: "Welcome",
    });
    const enrollmentId = await t.run(async (ctx) => {
      const now = Date.now();
      const documentId = await ctx.db.insert("documents", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        kind: "email_sequence", format: "markdown", title: "Welcome", body: "Hi",
        createdAt: now, updatedAt: now,
      });
      const sequenceId = await ctx.db.insert("sequences", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        status: "active", title: "Welcome", createdAt: now, updatedAt: now,
      });
      const stepId = await ctx.db.insert("sequence_steps", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        sequenceId, order: 1n, delayHours: 0, subject: "Welcome", documentId,
        createdAt: now, updatedAt: now,
      });
      const enrollmentId = await ctx.db.insert("enrollments", {
        ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadIds[0],
        sequenceId, nextStepAt: now, state: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("email_sends", {
        ownerId: ids.ownerId, projectId: ids.projectId, enrollmentId, stepId,
        idempotencyKey: "send:due:test", componentEmailId: queuedId,
        status: "queued", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("lead_email_tokens", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        leadId: ids.leadIds[0], purpose: "unsubscribe", tokenHash: "sha256:due:test",
        createdAt: now,
      });
      return enrollmentId;
    });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 1, more: false });
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).toBeNull();
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status)
      .toBe("cancelled");
    expect((await t.run((ctx) => ctx.db.get(enrollmentId)))?.state).toBe("revoked");
    expect(await t.run((ctx) => ctx.db.query("lead_email_tokens").collect()))
      .toHaveLength(0);
  });

  test("a revocation failure rolls back cancellation, keeps PII, and records a bounded retry", async () => {
    const { t, component } = setup();
    const ids = await seed(t, { real: true });
    const queuedId = await t.mutation(component.lib.createManualEmail, {
      from: "sender@example.test", to: "contact0@example.test", subject: "Welcome",
    });
    const brokenSendId = await t.run(async (ctx) => {
      const now = Date.now();
      const documentId = await ctx.db.insert("documents", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        kind: "email_sequence", format: "markdown", title: "Welcome", body: "Hi",
        createdAt: now, updatedAt: now,
      });
      const sequenceId = await ctx.db.insert("sequences", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        status: "active", title: "Welcome", createdAt: now, updatedAt: now,
      });
      const stepId = await ctx.db.insert("sequence_steps", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        sequenceId, order: 1n, delayHours: 0, subject: "Welcome", documentId,
        createdAt: now, updatedAt: now,
      });
      const enrollmentId = await ctx.db.insert("enrollments", {
        ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadIds[0],
        sequenceId, nextStepAt: now, state: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("email_sends", {
        ownerId: ids.ownerId, projectId: ids.projectId, enrollmentId, stepId,
        idempotencyKey: "send:due:good", componentEmailId: queuedId,
        status: "queued", createdAt: now, updatedAt: now,
      });
      return await ctx.db.insert("email_sends", {
        ownerId: ids.ownerId, projectId: ids.projectId, enrollmentId, stepId,
        idempotencyKey: "send:due:broken", status: "queued",
        createdAt: now + 1, updatedAt: now,
      });
    });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 0, more: true });
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status)
      .toBe("queued");
    expect((await t.run((ctx) => ctx.db.get(ids.leadIds[0])))?.email)
      .toBe("contact0@example.test");
    const retry = await t.run((ctx) => ctx.db.get(ids.jobId));
    expect(retry).toMatchObject({
      state: "scheduled", attempts: 1, processedCount: 0,
      lastErrorCode: "LEAD_RETENTION_REVOCATION_FAILED",
    });
    expect(retry!.nextAttemptAt).toBeGreaterThan(Date.now());
    expect(retry!.nextAttemptAt - retry!.lastAttemptAt!).toBe(60_000);
    await expect(t.mutation(dueWorker, { jobId: ids.jobId }))
      .rejects.toThrow("LEAD_RETENTION_NOT_DUE");

    // Model a reviewed historical-row repair and the passage of retry time.
    await t.run(async (ctx) => {
      await ctx.db.patch(brokenSendId, { status: "cancelled" });
      await ctx.db.patch(ids.jobId, { nextAttemptAt: Date.now() - 1 });
    });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 1, more: false });
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status)
      .toBe("cancelled");
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(ids.jobId)))?.lastErrorCode)
      .toBeUndefined();
  });

  test("a cross-owner lead graph cannot be deleted or completed", async () => {
    const { t } = setup();
    const ids = await seed(t);
    await t.run(async (ctx) => {
      const otherId = await ctx.db.insert("users", { email: "other@example.test" });
      await ctx.db.patch(ids.leadIds[0], { ownerId: otherId });
    });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 0, more: true });
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.jobId)))
      .toMatchObject({ state: "scheduled", lastErrorCode: "LEAD_RETENTION_OWNER_MISMATCH" });
  });

  test("a cross-project site graph defers the lead without deleting it", async () => {
    const { t } = setup();
    const ids = await seed(t);
    await t.run(async (ctx) => {
      const otherProjectId = await ctx.db.insert("projects", {
        ownerId: ids.ownerId, source: "own_idea", title: "Other", status: "draft",
        idempotencyKey: "wp78:due:other", createdAt: Date.now(), updatedAt: Date.now(),
      });
      await ctx.db.patch(ids.siteConfigId, { projectId: otherProjectId });
    });
    expect(await t.mutation(dueWorker, { jobId: ids.jobId }))
      .toEqual({ deleted: 0, more: true });
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.jobId)))
      .toMatchObject({ state: "scheduled", lastErrorCode: "LEAD_RETENTION_SITE_MISMATCH" });
  });

  test("an unarchived project or stale completed marker cannot authorize cleanup", async () => {
    const { t } = setup();
    const ids = await seed(t);
    await t.run((ctx) => ctx.db.patch(ids.projectId, { archivedAt: undefined }));
    await expect(t.mutation(dueWorker, { jobId: ids.jobId }))
      .rejects.toThrow("LEAD_DELETE_REQUEST_REQUIRED");
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.projectId, { archivedAt: ids.requestAt });
      await ctx.db.patch(ids.jobId, { completedAt: Date.now() });
    });
    await expect(t.mutation(dueWorker, { jobId: ids.jobId }))
      .rejects.toThrow("LEAD_RETENTION_JOB_INCONSISTENT");
    expect(await t.run((ctx) => ctx.db.get(ids.leadIds[0]))).not.toBeNull();
  });
});
