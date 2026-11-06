import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../_generated/api";
import schema from "../../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const DAY = 24 * 60 * 60 * 1000;

describe("D5 deletion-request contract fixture", () => {
  test("archive-only jobs never purge, and a valid explicit request stays inert", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const archivedAt = now - 31 * DAY;
    const ids = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
      const projectId = await ctx.db.insert("projects", {
        ownerId, title: "Keep my leads", source: "own_idea", status: "draft",
        idempotencyKey: "wp78:retention:contract", archivedAt,
        createdAt: now, updatedAt: now,
      });
      const siteConfigId = await ctx.db.insert("site_configs", {
        ownerId, projectId, status: "draft", createdAt: now, updatedAt: now,
      });
      const leadId = await ctx.db.insert("leads", {
        ownerId, projectId, siteConfigId, synthetic: true, createdAt: now,
      });
      const jobId = await ctx.db.insert("lead_retention_jobs", {
        ownerId, projectId, archivedAt, deleteDueAt: archivedAt + 30 * DAY,
        nextAttemptAt: archivedAt + 30 * DAY, state: "scheduled",
        attempts: 0, processedCount: 0, createdAt: now, updatedAt: now,
      });
      return { projectId, leadId, jobId };
    });

    await expect(t.mutation(internal.platform.sites.retention.purgeDueProjectLeads,
      { jobId: ids.jobId })).rejects.toThrow("LEAD_DELETE_REQUEST_REQUIRED");

    const deletionRequestedAt = now;
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.projectId, { deletionRequestedAt });
    });
    await expect(t.mutation(internal.platform.sites.retention.purgeDueProjectLeads,
      { jobId: ids.jobId })).rejects.toThrow("LEAD_DELETE_REQUEST_REQUIRED");

    await t.run(async (ctx) => {
      await ctx.db.patch(ids.jobId, {
        deletionRequestedAt, deleteDueAt: deletionRequestedAt + 30 * DAY,
        nextAttemptAt: deletionRequestedAt + 30 * DAY,
      });
    });
    await expect(t.mutation(internal.platform.sites.retention.purgeDueProjectLeads,
      { jobId: ids.jobId })).rejects.toThrow("LEAD_RETENTION_NOT_ACTIVE");
    expect(await t.run((ctx) => ctx.db.get(ids.leadId))).not.toBeNull();
  });
});
