import { register as registerResend } from "@convex-dev/resend/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { tenantResend } from "../../growth/email/provider";
import { csvCell, leadCsvRow } from "../../../lib/tenant-lead-csv";

const modules = import.meta.glob("/convex/**/*.ts");

async function seed(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSession = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: Date.now() + 60_000 });
    const otherSession = await ctx.db.insert("authSessions", { userId: otherId, expirationTime: Date.now() + 60_000 });
    await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: true,
      cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: Date.now(),
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId, title: "HydroTrail", source: "own_idea", status: "draft",
      idempotencyKey: "wp78:leads:test", createdAt: Date.now(), updatedAt: Date.now(),
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId, projectId, status: "published", hostname: "hydrotrail.weekendmvp.app",
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    const leadId = await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, synthetic: false,
      email: "lead@example.test", consentText: "Join the waitlist", consentVersion: "v1",
      source: "landing", createdAt: 1,
    });
    await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, synthetic: true, createdAt: 2,
    });
    await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, synthetic: false,
      email: "next@example.test", consentText: "Join the waitlist", consentVersion: "v1",
      createdAt: 3,
    });
    return { ownerId, ownerSession, otherId, otherSession, projectId, leadId };
  });
}

function asUser(t: TestConvex<typeof schema>, userId: Id<"users">, sessionId: Id<"authSessions">) {
  return t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
}

async function seedQueuedContactMail(
  t: TestConvex<typeof schema>,
  ids: Awaited<ReturnType<typeof seed>>,
) {
  const queuedSendEmailId = await t.mutation(components.resend.lib.createManualEmail, {
    from: "sender@example.test", to: "lead@example.test", subject: "Sequence",
  });
  const confirmationEmailId = await t.mutation(components.resend.lib.createManualEmail, {
    from: "sender@example.test", to: "lead@example.test", subject: "Confirm",
  });
  const rows = await t.run(async (ctx) => {
    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      ownerId: ids.ownerId, projectId: ids.projectId, kind: "email_sequence",
      format: "markdown", title: "Step", body: "Hello", createdAt: now, updatedAt: now,
    });
    const sequenceId = await ctx.db.insert("sequences", {
      ownerId: ids.ownerId, projectId: ids.projectId, status: "active",
      title: "Welcome", createdAt: now, updatedAt: now,
    });
    const stepId = await ctx.db.insert("sequence_steps", {
      ownerId: ids.ownerId, projectId: ids.projectId, sequenceId,
      order: 1n, delayHours: 0, subject: "Welcome", documentId,
      createdAt: now, updatedAt: now,
    });
    const enrollmentId = await ctx.db.insert("enrollments", {
      ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadId,
      sequenceId, nextStepAt: now, state: "active", createdAt: now, updatedAt: now,
    });
    const sendId = await ctx.db.insert("email_sends", {
      ownerId: ids.ownerId, projectId: ids.projectId, enrollmentId, stepId,
      idempotencyKey: "wp78:delete:send", componentEmailId: queuedSendEmailId,
      status: "queued", createdAt: now, updatedAt: now,
    });
    const tokenId = await ctx.db.insert("lead_email_tokens", {
      ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadId,
      purpose: "opt_in", tokenHash: "sha256:wp78-delete",
      componentEmailId: confirmationEmailId, expiresAt: now + 60_000, createdAt: now,
    });
    return { enrollmentId, sendId, tokenId };
  });
  return { ...rows, queuedSendEmailId, confirmationEmailId };
}

describe("WP78 lead lifecycle", () => {
  test("owner can paginate every real lead without synthetic rows", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    let cursor: string | null = null;
    const emails: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const result: { page: Array<{ email: string }>; isDone: boolean; continueCursor: string } =
        await owner.query(api.platform.sites.leads.exportPage, {
        projectId: ids.projectId, paginationOpts: { cursor, numItems: 1 },
      });
      emails.push(...result.page.map((lead) => lead.email));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(emails).toEqual(["lead@example.test", "next@example.test"]);
    await expect(asUser(t, ids.otherId, ids.otherSession).query(
      api.platform.sites.leads.exportPage,
      { projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 10 } },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  test("per-contact delete erases PII and blocks repeat export", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    await expect(asUser(t, ids.otherId, ids.otherSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, { leadId: ids.leadId }))
      .toEqual({ deleted: true });
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, { leadId: ids.leadId }))
      .toEqual({ deleted: false });
    const lead = await t.run(async (ctx) => await ctx.db.get(ids.leadId));
    expect(lead?.email).toBeUndefined();
    expect(lead?.source).toBeUndefined();
    expect(lead?.consentText).toBeUndefined();
    expect(lead?.deletedAt).toBeTypeOf("number");
    expect(lead?.unsubscribedAt).toBe(lead?.deletedAt);
    const exportResult = await owner.query(api.platform.sites.leads.exportPage, {
      projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(exportResult.page.map((row) => row.email)).toEqual(["next@example.test"]);
  });

  test("owner export and delete remain available after workspace shutdown", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => {
      const settings = await ctx.db.query("ops_settings").first();
      if (!settings) throw new Error("missing settings fixture");
      await ctx.db.patch(settings._id, { workspaceEnabled: false, cohortMode: "allowlist" });
    });
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    const before = await owner.query(api.platform.sites.leads.exportPage, {
      projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(before.page.map((row) => row.email)).toEqual(["lead@example.test", "next@example.test"]);
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, {
      leadId: ids.leadId,
    })).toEqual({ deleted: true });
    const after = await owner.query(api.platform.sites.leads.exportPage, {
      projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(after.page.map((row) => row.email)).toEqual(["next@example.test"]);
    await expect(asUser(t, ids.otherId, ids.otherSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  test("owner deletion cancels queued sequence and confirmation mail while workspace is off", async () => {
    const t = convexTest(schema, modules);
    registerResend(t);
    const ids = await seed(t);
    const mail = await seedQueuedContactMail(t, ids);
    await t.run(async (ctx) => {
      const settings = await ctx.db.query("ops_settings").first();
      if (!settings) throw new Error("missing settings fixture");
      await ctx.db.patch(settings._id, { workspaceEnabled: false, cohortMode: "allowlist" });
    });
    await expect(asUser(t, ids.otherId, ids.otherSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect((await t.query(components.resend.lib.getStatus, {
      emailId: mail.queuedSendEmailId,
    }))?.status).toBe("queued");
    expect((await t.query(components.resend.lib.getStatus, {
      emailId: mail.confirmationEmailId,
    }))?.status).toBe("queued");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(mail.enrollmentId))?.state).toBe("active");
      expect(await ctx.db.get(mail.tokenId)).not.toBeNull();
      expect((await ctx.db.get(ids.leadId))?.email).toBe("lead@example.test");
    });

    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, {
      leadId: ids.leadId,
    })).toEqual({ deleted: true });
    expect((await t.query(components.resend.lib.getStatus, {
      emailId: mail.queuedSendEmailId,
    }))?.status).toBe("cancelled");
    expect((await t.query(components.resend.lib.getStatus, {
      emailId: mail.confirmationEmailId,
    }))?.status).toBe("cancelled");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(mail.enrollmentId))?.state).toBe("revoked");
      expect((await ctx.db.get(mail.sendId))?.status).toBe("cancelled");
      expect(await ctx.db.get(mail.tokenId)).toBeNull();
      const lead = await ctx.db.get(ids.leadId);
      expect(lead?.email).toBeUndefined();
      expect(lead?.consentText).toBeUndefined();
      expect(lead?.deletedAt).toBeTypeOf("number");
    });
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, {
      leadId: ids.leadId,
    })).toEqual({ deleted: false });
  });

  test("a component cancellation failure rolls back the owner deletion", async () => {
    const t = convexTest(schema, modules);
    registerResend(t);
    const ids = await seed(t);
    const mail = await seedQueuedContactMail(t, ids);
    const realStatus = tenantResend.status.bind(tenantResend);
    const status = vi.spyOn(tenantResend, "status")
      .mockImplementationOnce(realStatus)
      .mockRejectedValueOnce(new Error("COMPONENT_STATUS_FAILURE"));
    try {
      await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
        api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
      )).rejects.toThrow("COMPONENT_STATUS_FAILURE");
    } finally {
      status.mockRestore();
    }
    expect((await t.query(components.resend.lib.getStatus, {
      emailId: mail.queuedSendEmailId,
    }))?.status).toBe("queued");
    expect((await t.query(components.resend.lib.getStatus, {
      emailId: mail.confirmationEmailId,
    }))?.status).toBe("queued");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(mail.enrollmentId))?.state).toBe("active");
      expect((await ctx.db.get(mail.sendId))?.status).toBe("queued");
      expect(await ctx.db.get(mail.tokenId)).not.toBeNull();
      const lead = await ctx.db.get(ids.leadId);
      expect(lead?.email).toBe("lead@example.test");
      expect(lead?.deletedAt).toBeUndefined();
    });
  });

  test("a mismatched site ownership graph leaves queued mail and lead untouched", async () => {
    const t = convexTest(schema, modules);
    registerResend(t);
    const ids = await seed(t);
    const mail = await seedQueuedContactMail(t, ids);
    await t.run(async (ctx) => {
      const lead = await ctx.db.get(ids.leadId);
      if (!lead) throw new Error("missing lead fixture");
      await ctx.db.patch(lead.siteConfigId, { ownerId: ids.otherId });
    });
    await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("LEAD_OWNERSHIP_GRAPH_MISMATCH");
    expect((await t.query(components.resend.lib.getStatus, {
      emailId: mail.queuedSendEmailId,
    }))?.status).toBe("queued");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(ids.leadId))?.email).toBe("lead@example.test");
      expect((await ctx.db.get(mail.enrollmentId))?.state).toBe("active");
      expect(await ctx.db.get(mail.tokenId)).not.toBeNull();
    });
  });

  test("expired owner session cannot erase a contact", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => ctx.db.patch(ids.ownerSession, {
      expirationTime: Date.now() - 1,
    }));
    await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("UNAUTHENTICATED");
    expect((await t.run(async (ctx) => ctx.db.get(ids.leadId)))?.email).toBe("lead@example.test");
  });

  test("CSV escapes quotes, line breaks and spreadsheet formula fields", () => {
    expect(csvCell('He said "hello"\nagain')).toBe('"He said ""hello""\nagain"');
    const row = leadCsvRow({
      id: "lead-1", email: "lead@example.test", createdAt: 0,
      source: '=HYPERLINK("https://attacker.example")',
    });
    expect(row).toContain('"\'=HYPERLINK(""https://attacker.example"")"');
    expect(row.endsWith("\r\n")).toBe(true);
  });

  test("ordinary archive never authorizes lead purge, even after 30 days and workspace shutdown", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const enrollmentId = await t.run(async (ctx) => {
      await ctx.db.patch(ids.projectId, {
        archivedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      });
      const settings = await ctx.db.query("ops_settings").first();
      if (!settings) throw new Error("missing settings fixture");
      await ctx.db.patch(settings._id, { workspaceEnabled: false, cohortMode: "allowlist" });
      const now = Date.now();
      const sequenceId = await ctx.db.insert("sequences", {
        ownerId: ids.ownerId, projectId: ids.projectId, status: "active",
        title: "Waitlist", createdAt: now, updatedAt: now,
      });
      return await ctx.db.insert("enrollments", {
        ownerId: ids.ownerId, projectId: ids.projectId,
        leadId: ids.leadId, sequenceId, nextStepAt: now,
        state: "active", createdAt: now, updatedAt: now,
      });
    });
    const leads = () => t.run(async (ctx) => ctx.db.query("leads")
      .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", ids.projectId))
      .collect());
    const before = await leads();
    expect(before).toHaveLength(3);
    expect(before.some((lead) => lead.synthetic)).toBe(true);
    expect(before.some((lead) => !lead.synthetic)).toBe(true);

    await expect(t.mutation(internal.platform.sites.retention.purgeArchivedProjectLeads,
      { projectId: ids.projectId })).rejects.toThrow("LEAD_DELETE_REQUEST_REQUIRED");
    expect(await leads()).toEqual(before);
    expect((await t.run(async (ctx) => ctx.db.get(enrollmentId)))?.state).toBe("active");

    await t.run(async (ctx) => ctx.db.patch(ids.projectId, { archivedAt: undefined }));
    await expect(t.mutation(internal.platform.sites.retention.purgeArchivedProjectLeads,
      { projectId: ids.projectId })).rejects.toThrow("LEAD_DELETE_REQUEST_REQUIRED");
    expect(await leads()).toEqual(before);
  });

  test("legacy purge rejects a missing project without touching orphaned leads", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => ctx.db.delete(ids.projectId));
    await expect(t.mutation(internal.platform.sites.retention.purgeArchivedProjectLeads,
      { projectId: ids.projectId })).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect((await t.run(async (ctx) => ctx.db.get(ids.leadId)))?.email).toBe("lead@example.test");
  });
});
