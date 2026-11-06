import { register as registerResend } from "@convex-dev/resend/test";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { components } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { tenantResend } from "./provider";

const modules = import.meta.glob("/convex/**/*.ts");
const revoke = makeFunctionReference<"mutation", { leadId: Id<"leads"> }>(
  "growth/email/contacts:revokeLeadContact",
);

function setup() {
  const t = convexTest(schema, modules);
  registerResend(t);
  return { t, component: components.resend };
}

async function seedLead(t: ReturnType<typeof setup>["t"]) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const projectId = await ctx.db.insert("projects", {
      ownerId, source: "own_idea", title: "Test", status: "draft",
      idempotencyKey: "wp79-contact-test", createdAt: now, updatedAt: now,
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId, projectId, status: "published", createdAt: now, updatedAt: now,
    });
    const leadId = await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, email: "contact@example.test",
      payload: "{}", synthetic: false, createdAt: now,
    });
    const documentId = await ctx.db.insert("documents", {
      ownerId, projectId, kind: "email_sequence", format: "markdown", title: "Step", body: "Hello",
      createdAt: now, updatedAt: now,
    });
    const sequenceId = await ctx.db.insert("sequences", {
      ownerId, projectId, status: "active", title: "Welcome", createdAt: now, updatedAt: now,
    });
    const stepId = await ctx.db.insert("sequence_steps", {
      ownerId, projectId, sequenceId, order: 1n, delayHours: 0, subject: "Hello",
      documentId, createdAt: now, updatedAt: now,
    });
    return { ownerId, projectId, leadId, sequenceId, stepId };
  });
}

async function manualEmail(
  t: ReturnType<typeof setup>["t"],
  component: ReturnType<typeof setup>["component"],
) {
  return await t.mutation(component.lib.createManualEmail, {
    from: "sender@example.test", to: "contact@example.test", subject: "Test",
  });
}

async function seedEnrollment(
  t: ReturnType<typeof setup>["t"],
  ids: Awaited<ReturnType<typeof seedLead>>,
  state: string,
) {
  return await t.run((ctx) => ctx.db.insert("enrollments", {
    ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadId,
    sequenceId: ids.sequenceId, nextStepAt: Date.now(), state,
    createdAt: Date.now(), updatedAt: Date.now(),
  }));
}

async function seedSend(
  t: ReturnType<typeof setup>["t"],
  ids: Awaited<ReturnType<typeof seedLead>>,
  enrollmentId: Id<"enrollments">,
  componentEmailId: string,
  status: string,
  key: string,
) {
  return await t.run((ctx) => ctx.db.insert("email_sends", {
    ownerId: ids.ownerId, projectId: ids.projectId, enrollmentId,
    stepId: ids.stepId, idempotencyKey: key, componentEmailId, status,
    createdAt: Date.now(), updatedAt: Date.now(),
  }));
}

describe("WP79 contact revocation", () => {
  it("cancels queued mail across active enrollment and opt-in token, leaves finalized mail, and retries safely", async () => {
    const { t, component } = setup();
    const ids = await seedLead(t);
    const historical = await seedEnrollment(t, ids, "completed");
    const active = await seedEnrollment(t, ids, "active");
    const queuedId = await manualEmail(t, component);
    const sentId = await manualEmail(t, component);
    await t.mutation(component.lib.updateManualEmail, { emailId: sentId, status: "sent" });
    const confirmationId = await manualEmail(t, component);
    const queuedSend = await seedSend(t, ids, active, queuedId, "queued", "send:active:1");
    const sentSend = await seedSend(t, ids, active, sentId, "sent", "send:active:2");
    await seedSend(t, ids, historical, sentId, "sent", "send:old:1");
    await t.run((ctx) => ctx.db.insert("lead_email_tokens", {
      ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadId,
      purpose: "opt_in", tokenHash: "sha256:test", componentEmailId: confirmationId,
      expiresAt: Date.now() + 60_000, createdAt: Date.now(),
    }));

    await expect(t.mutation(revoke, { leadId: ids.leadId })).resolves.toMatchObject({
      tokensDeleted: 1, enrollmentsRevoked: 1, sendsChecked: 2,
      queuedEmailsCancelled: 2, submittedEmails: 1,
    });
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status).toBe("cancelled");
    expect((await t.query(component.lib.getStatus, { emailId: confirmationId }))?.status).toBe("cancelled");
    expect((await t.query(component.lib.getStatus, { emailId: sentId }))?.status).toBe("sent");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(active))?.state).toBe("revoked");
      expect((await ctx.db.get(historical))?.state).toBe("completed");
      expect((await ctx.db.get(queuedSend))?.status).toBe("cancelled");
      expect((await ctx.db.get(sentSend))?.status).toBe("sent");
      expect(await ctx.db.query("lead_email_tokens").collect()).toHaveLength(0);
      expect((await ctx.db.get(ids.leadId))?.email).toBe("contact@example.test");
    });
    await expect(t.mutation(revoke, { leadId: ids.leadId })).resolves.toMatchObject({
      tokensDeleted: 0, enrollmentsRevoked: 0, queuedEmailsCancelled: 0,
    });
  });

  it("treats a cleaned-up component row as removed and cancels remaining queued mail", async () => {
    const { t, component } = setup();
    const ids = await seedLead(t);
    const active = await seedEnrollment(t, ids, "active");
    const staleConfirmationId = await manualEmail(t, component);
    await t.mutation(component.lib.cleanupAbandonedEmails, { olderThan: -1 });
    const queuedId = await manualEmail(t, component);
    const sendId = await seedSend(t, ids, active, queuedId, "queued", "send:rollback:1");
    await t.run((ctx) => ctx.db.insert("lead_email_tokens", {
      ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadId,
      purpose: "opt_in", tokenHash: "sha256:stale", componentEmailId: staleConfirmationId,
      expiresAt: Date.now() + 60_000, createdAt: Date.now(),
    }));

    await expect(t.mutation(revoke, { leadId: ids.leadId })).resolves.toMatchObject({
      tokensDeleted: 1, enrollmentsRevoked: 1, queuedEmailsCancelled: 1,
    });
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status).toBe("cancelled");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(active))?.state).toBe("revoked");
      expect((await ctx.db.get(sendId))?.status).toBe("cancelled");
      expect(await ctx.db.query("lead_email_tokens").collect()).toHaveLength(0);
    });
  });

  it("rolls back a queued cancellation when a component status query fails", async () => {
    const { t, component } = setup();
    const ids = await seedLead(t);
    const active = await seedEnrollment(t, ids, "active");
    const queuedId = await manualEmail(t, component);
    const confirmationId = await manualEmail(t, component);
    const sendId = await seedSend(t, ids, active, queuedId, "queued", "send:rollback:1");
    await t.run((ctx) => ctx.db.insert("lead_email_tokens", {
      ownerId: ids.ownerId, projectId: ids.projectId, leadId: ids.leadId,
      purpose: "opt_in", tokenHash: "sha256:rollback", componentEmailId: confirmationId,
      expiresAt: Date.now() + 60_000, createdAt: Date.now(),
    }));
    const realStatus = tenantResend.status.bind(tenantResend);
    const status = vi.spyOn(tenantResend, "status")
      .mockImplementationOnce(realStatus)
      .mockRejectedValueOnce(new Error("COMPONENT_STATUS_FAILURE"));
    try {
      await expect(t.mutation(revoke, { leadId: ids.leadId }))
        .rejects.toThrow("COMPONENT_STATUS_FAILURE");
    } finally {
      status.mockRestore();
    }
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status).toBe("queued");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(active))?.state).toBe("active");
      expect((await ctx.db.get(sendId))?.status).toBe("queued");
      expect(await ctx.db.query("lead_email_tokens").collect()).toHaveLength(1);
    });
  });

  it("does not claim cancellation for a queued send without a component ID", async () => {
    const { t, component } = setup();
    const ids = await seedLead(t);
    const active = await seedEnrollment(t, ids, "active");
    const queuedId = await manualEmail(t, component);
    const first = await seedSend(t, ids, active, queuedId, "queued", "send:no-id:1");
    const second = await t.run((ctx) => ctx.db.insert("email_sends", {
      ownerId: ids.ownerId, projectId: ids.projectId, enrollmentId: active,
      stepId: ids.stepId, idempotencyKey: "send:no-id:2", status: "queued",
      createdAt: Date.now(), updatedAt: Date.now(),
    }));
    await expect(t.mutation(revoke, { leadId: ids.leadId }))
      .rejects.toThrow("COMPONENT_EMAIL_ID_MISSING");
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status).toBe("queued");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(active))?.state).toBe("active");
      expect((await ctx.db.get(first))?.status).toBe("queued");
      expect((await ctx.db.get(second))?.status).toBe("queued");
    });
  });

  it("rejects a cross-tenant lead graph before touching queued mail", async () => {
    const { t, component } = setup();
    const ids = await seedLead(t);
    const active = await seedEnrollment(t, ids, "active");
    const queuedId = await manualEmail(t, component);
    await seedSend(t, ids, active, queuedId, "queued", "send:cross-tenant:1");
    await t.run(async (ctx) => {
      const otherOwnerId = await ctx.db.insert("users", { email: "other@example.test" });
      const lead = await ctx.db.get(ids.leadId);
      if (!lead) throw new Error("missing fixture lead");
      await ctx.db.patch(lead.siteConfigId, { ownerId: otherOwnerId });
    });
    await expect(t.mutation(revoke, { leadId: ids.leadId }))
      .rejects.toThrow("LEAD_OWNERSHIP_GRAPH_MISMATCH");
    expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status).toBe("queued");
  });

  it("fails closed when more than one active enrollment is present", async () => {
    const { t } = setup();
    const ids = await seedLead(t);
    const first = await seedEnrollment(t, ids, "active");
    const second = await seedEnrollment(t, ids, "active");
    await expect(t.mutation(revoke, { leadId: ids.leadId }))
      .rejects.toThrow("LEAD_ACTIVE_ENROLLMENT_LIMIT_EXCEEDED");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(first))?.state).toBe("active");
      expect((await ctx.db.get(second))?.state).toBe("active");
    });
  });

  it("refuses an active enrollment with more than the four frozen send rows", async () => {
    const { t } = setup();
    const ids = await seedLead(t);
    const active = await seedEnrollment(t, ids, "active");
    await t.run(async (ctx) => {
      for (let n = 0; n < 5; n += 1) {
        await ctx.db.insert("email_sends", {
          ownerId: ids.ownerId, projectId: ids.projectId, enrollmentId: active,
          stepId: ids.stepId, idempotencyKey: `send:overflow:${n}`, status: "reserved",
          createdAt: Date.now(), updatedAt: Date.now(),
        });
      }
    });
    await expect(t.mutation(revoke, { leadId: ids.leadId }))
      .rejects.toThrow("LEAD_SEND_LIMIT_EXCEEDED");
    await t.run(async (ctx) => {
      expect((await ctx.db.get(active))?.state).toBe("active");
      expect(await ctx.db.query("email_sends").collect()).toHaveLength(5);
    });
  });
});
