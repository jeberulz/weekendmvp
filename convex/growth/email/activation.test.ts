import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../_generated/api";
import schema from "../../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const activate = internal.growth.email.activation.activateSequence;

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const expirationTime = Date.now() + 60_000;
    const ownerSession = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime });
    const otherSession = await ctx.db.insert("authSessions", { userId: otherId, expirationTime });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open",
      freeSignupsOpen: false, globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: true, studioVideo: true, publish: true, email: false, social: true, ads: true },
      updatedAt: 1,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId, title: "Welcome test", source: "own_idea", status: "draft",
      idempotencyKey: "wp79-activation-test", createdAt: 1, updatedAt: 1,
    });
    const sequence = {
      ownerId, projectId, title: "Welcome", status: "draft" as const, createdAt: 2, updatedAt: 2,
    };
    const sequenceId = await ctx.db.insert("sequences", sequence);
    const otherSequenceId = await ctx.db.insert("sequences", sequence);
    const documentId = await ctx.db.insert("documents", {
      ownerId, projectId, title: "Welcome email", kind: "email_sequence", format: "json",
      body: "{}", createdAt: 2, updatedAt: 2,
    });
    await ctx.db.insert("sequence_steps", {
      ownerId, projectId, sequenceId, order: 1n, subject: "Welcome", delayHours: 0, documentId,
      createdAt: 2, updatedAt: 2,
    });
    const approval = {
      ownerId, projectId, status: "approved" as const, changeRound: 0n, createdAt: 3, updatedAt: 10,
    };
    const approvalId = await ctx.db.insert("approvals", {
      ...approval, kind: "send", subjectTable: "sequences", subjectId: sequenceId,
    });
    const reviewId = await ctx.db.insert("approvals", {
      ...approval, kind: "artifact_review", subjectTable: "documents", subjectId: documentId,
    });
    return { ownerId, otherId, ownerSession, otherSession, opsId, projectId, sequenceId, otherSequenceId, approvalId, reviewId, documentId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.ownerSession}`, issuer: "https://local.test" });
  const stranger = t.withIdentity({ subject: `${ids.otherId}|${ids.otherSession}`, issuer: "https://local.test" });
  return { t, owner, stranger, ids, args: { sequenceId: ids.sequenceId, approvalId: ids.approvalId } };
}

async function expectCode(result: Promise<null>, code: string) {
  await expect(result).rejects.toMatchObject({ data: { code } });
}

describe("WP79 C-EMAIL activation fixture", () => {
  test("an exact approved request and its replay leave every email side effect untouched", async () => {
    const { t, owner, args } = await setup();
    const snapshot = () => t.run(async (ctx) => ({
      sequence: await ctx.db.get("sequences", args.sequenceId),
      steps: await ctx.db.query("sequence_steps").collect(),
      approval: await ctx.db.get("approvals", args.approvalId),
      enrollments: await ctx.db.query("enrollments").collect(),
      sends: await ctx.db.query("email_sends").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    const before = await snapshot();
    for (let attempt = 0; attempt < 2; attempt++) {
      await expectCode(owner.mutation(activate, args), "SEQUENCE_ACTIVATION_UNAVAILABLE");
    }
    expect(await snapshot()).toEqual(before);
  });

  test("refuses a stranger and an expired founder session before inspecting the approval", async () => {
    const { t, owner, stranger, ids, args } = await setup();
    await expectCode(stranger.mutation(activate, args), "RESOURCE_NOT_FOUND");
    await expectCode(t.mutation(activate, args), "UNAUTHENTICATED");
    await t.run((ctx) => ctx.db.patch("authSessions", ids.ownerSession, { expirationTime: 1 }));
    await expectCode(owner.mutation(activate, args), "UNAUTHENTICATED");
  });

  test("requires the owner in the allowlist and rejects mismatched sequence ownership", async () => {
    const { t, owner, ids, args } = await setup();
    await t.run((ctx) => ctx.db.patch("ops_settings", ids.opsId, { cohortMode: "allowlist" }));
    await expectCode(owner.mutation(activate, args), "RESOURCE_NOT_FOUND");
    await t.run((ctx) => ctx.db.insert("workspace_cohort", {
      ownerId: ids.ownerId, addedBy: ids.ownerId, addedAt: 1,
    }));
    await expectCode(owner.mutation(activate, args), "SEQUENCE_ACTIVATION_UNAVAILABLE");
    await t.run((ctx) => ctx.db.patch("sequences", ids.sequenceId, { ownerId: ids.otherId }));
    await expectCode(owner.mutation(activate, args), "RESOURCE_NOT_FOUND");
  });

  test("refuses while either workspace or email is off", async () => {
    const { t, owner, ids, args } = await setup();
    await t.run((ctx) => ctx.db.patch("ops_settings", ids.opsId, { workspaceEnabled: false }));
    await expectCode(owner.mutation(activate, args), "WORKSPACE_DISABLED");
    await t.run(async (ctx) => {
      const ops = await ctx.db.get("ops_settings", ids.opsId);
      if (!ops) throw new Error("missing fixture ops settings");
      await ctx.db.patch("ops_settings", ids.opsId, {
        workspaceEnabled: true,
        killSwitches: { ...ops.killSwitches, email: true },
      });
    });
    await expectCode(owner.mutation(activate, args), "WORKSPACE_DISABLED");
  });

  test("refuses a draft review or a send approval for a different sequence", async () => {
    const { owner, ids, args } = await setup();
    await expectCode(owner.mutation(activate, { ...args, approvalId: ids.reviewId }), "APPROVAL_KIND_MISMATCH");
    await expectCode(owner.mutation(activate, { ...args, sequenceId: ids.otherSequenceId }), "APPROVAL_SUBJECT_MISMATCH");
  });

  test("requires the approval to exist and be approved", async () => {
    const { t, owner, ids, args } = await setup();
    for (const status of ["pending", "changes_requested", "expired", "cancelled"] as const) {
      await t.run((ctx) => ctx.db.patch("approvals", ids.approvalId, { status }));
      await expectCode(owner.mutation(activate, args), "APPROVAL_NOT_APPROVED");
    }
    await t.run((ctx) => ctx.db.delete("approvals", ids.approvalId));
    await expectCode(owner.mutation(activate, args), "APPROVAL_NOT_FOUND");
  });

  test("refuses when a linked document changed after the approval was created", async () => {
    const { t, owner, ids, args } = await setup();
    await t.run((ctx) => ctx.db.patch("documents", ids.documentId, { body: "{\"changed\":true}", updatedAt: 5 }));
    await expectCode(owner.mutation(activate, args), "APPROVAL_SUBJECT_CHANGED");
  });
});
