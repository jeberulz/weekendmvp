/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../schema";
import { requireBusinessChild, requireBusinessForOwner } from "./authz";

const modules = import.meta.glob("/convex/**/*.ts");

describe("workspace child authorization", () => {
  test("checks direct ownership and nested employee, sequence, account and list links", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", { email: "workspace-owner@example.test" });
      const otherId = await ctx.db.insert("users", { email: "workspace-other@example.test" });
      const sessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
      const projectId = await ctx.db.insert("projects", { ownerId, source: "own_idea", title: "Owner", status: "draft", idempotencyKey: "workspace-owner", createdAt: 1, updatedAt: 1 });
      const otherProjectId = await ctx.db.insert("projects", { ownerId: otherId, source: "own_idea", title: "Other", status: "draft", idempotencyKey: "workspace-other", createdAt: 1, updatedAt: 1 });
      const ownCrewId = await ctx.db.insert("crew_members", { ownerId, projectId, roleKey: "brand", displayName: "B", status: "done", hiredBy: "rule", autopilot: false, createdAt: 1, updatedAt: 1 });
      const otherCrewId = await ctx.db.insert("crew_members", { ownerId: otherId, projectId: otherProjectId, roleKey: "brand", displayName: "O", status: "done", hiredBy: "rule", autopilot: false, createdAt: 1, updatedAt: 1 });
      const ownWorkstreamId = await ctx.db.insert("workstreams", { ownerId, projectId, employeeId: ownCrewId, title: "Brand", status: "done", documentIds: [], fileIds: [], createdAt: 1, updatedAt: 1 });
      const forgedWorkstreamId = await ctx.db.insert("workstreams", { ownerId, projectId, employeeId: otherCrewId, title: "Forged", status: "done", documentIds: [], fileIds: [], createdAt: 1, updatedAt: 1 });
      const documentId = await ctx.db.insert("documents", { ownerId, projectId, kind: "brief", format: "text", title: "Brief", createdAt: 1, updatedAt: 1 });
      const ownSequenceId = await ctx.db.insert("sequences", { ownerId, projectId, status: "draft", title: "Own", createdAt: 1, updatedAt: 1 });
      const otherSequenceId = await ctx.db.insert("sequences", { ownerId: otherId, projectId: otherProjectId, status: "draft", title: "Other", createdAt: 1, updatedAt: 1 });
      const forgedStepId = await ctx.db.insert("sequence_steps", { ownerId, projectId, sequenceId: otherSequenceId, order: 1n, delayHours: 0, subject: "Hello", documentId, createdAt: 1, updatedAt: 1 });
      const ownAccountId = await ctx.db.insert("social_accounts", { ownerId, projectId, platform: "instagram", connector: "copy", status: "active", createdAt: 1, updatedAt: 1 });
      const otherAccountId = await ctx.db.insert("social_accounts", { ownerId: otherId, projectId: otherProjectId, platform: "instagram", connector: "copy", status: "active", createdAt: 1, updatedAt: 1 });
      const ownPostId = await ctx.db.insert("social_posts", { ownerId, projectId, socialAccountId: ownAccountId, status: "draft", createdAt: 1, updatedAt: 1 });
      const forgedPostId = await ctx.db.insert("social_posts", { ownerId, projectId, socialAccountId: otherAccountId, status: "draft", createdAt: 1, updatedAt: 1 });
      const otherListId = await ctx.db.insert("outbound_lists", { ownerId: otherId, projectId: otherProjectId, name: "Other list", createdAt: 1, updatedAt: 1 });
      const forgedMessageId = await ctx.db.insert("outbound_messages", { ownerId, projectId, listId: otherListId, status: "draft", createdAt: 1, updatedAt: 1 });
      const siteConfigId = await ctx.db.insert("site_configs", { ownerId, projectId, status: "draft", createdAt: 1, updatedAt: 1 });
      const leadId = await ctx.db.insert("leads", { ownerId, projectId, siteConfigId, synthetic: true, createdAt: 1 });
      const enrollmentId = await ctx.db.insert("enrollments", { ownerId, projectId, leadId, sequenceId: ownSequenceId, nextStepAt: 1, state: "active", createdAt: 1, updatedAt: 1 });
      const otherOwnSequenceId = await ctx.db.insert("sequences", { ownerId, projectId, status: "draft", title: "Second", createdAt: 1, updatedAt: 1 });
      const mismatchedStepId = await ctx.db.insert("sequence_steps", { ownerId, projectId, sequenceId: otherOwnSequenceId, order: 1n, delayHours: 0, subject: "Hello", documentId, createdAt: 1, updatedAt: 1 });
      const mismatchedSendId = await ctx.db.insert("email_sends", { ownerId, projectId, enrollmentId, stepId: mismatchedStepId, idempotencyKey: "send-1", status: "pending", createdAt: 1, updatedAt: 1 });
      return { ownerId, otherId, sessionId, projectId, otherProjectId, ownWorkstreamId, forgedWorkstreamId, forgedStepId, ownPostId, forgedPostId, forgedMessageId, mismatchedSendId };
    });
    const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.sessionId}`, issuer: "https://local.test" });

    await expect(owner.run((ctx) => requireBusinessChild(ctx, "workstreams", ids.ownWorkstreamId, ids.projectId))).resolves.toMatchObject({ ownerId: ids.ownerId });
    await expect(owner.run((ctx) => requireBusinessChild(ctx, "social_posts", ids.ownPostId, ids.projectId))).resolves.toMatchObject({ ownerId: ids.ownerId });
    for (const [tableName, recordId] of [
      ["workstreams", ids.forgedWorkstreamId],
      ["sequence_steps", ids.forgedStepId],
      ["social_posts", ids.forgedPostId],
      ["outbound_messages", ids.forgedMessageId],
      ["email_sends", ids.mismatchedSendId],
    ] as const) {
      await expect(owner.run((ctx) => requireBusinessChild(ctx, tableName, recordId, ids.projectId)))
        .rejects.toThrow("RESOURCE_NOT_FOUND");
    }
    await expect(t.run((ctx) => requireBusinessForOwner(ctx, ids.projectId, ids.ownerId))).resolves.toMatchObject({ _id: ids.projectId });
    await expect(t.run((ctx) => requireBusinessForOwner(ctx, ids.otherProjectId, ids.ownerId))).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
});
