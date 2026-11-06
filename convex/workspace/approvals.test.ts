/// <reference types="vite/client" />
/**
 * WP77-S1 — C-APPROVAL in convex-test: create, decide (exactly once), expire,
 * and `assertApproved` failing closed on every mismatch. No network, no model.
 */
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { assertApproved, type ApprovalSubjectRef } from "./approvals";
import { APPROVAL_NOTE_MAX_LENGTH, APPROVAL_PENDING_TTL_MS } from "../../lib/workspace/contracts/approvals";

const modules = import.meta.glob("/convex/**/*.ts");
type T = TestConvex<typeof schema>;

type SeedOptions = { workspaceEnabled?: boolean; publishKillSwitch?: boolean };

async function seed(options: SeedOptions = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    const otherSessionId = await ctx.db.insert("authSessions", { userId: otherId, expirationTime: 9_999_999_999_999 });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: options.workspaceEnabled ?? true,
      cohortMode: "open",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n,
      paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: {
        ai: true, studioVideo: true, publish: options.publishKillSwitch ?? false, email: false, social: false, ads: false,
      },
      updatedAt: 1,
    });
    const business = async (userId: Id<"users">, label: string) => {
      const wizardSessionId = await ctx.db.insert("wizard_sessions", {
        ownerId: userId, step: "idea", answers: {}, startedAt: 1, updatedAt: 1,
      });
      return await ctx.db.insert("projects", {
        ownerId: userId,
        source: "own_idea",
        title: label,
        status: "draft",
        idempotencyKey: `wp77-${label}`,
        workspace: {
          version: 1, name: label, slug: label.toLowerCase(), ownIdeaText: "A hydration app for hikers",
          platform: "web", commercialModel: "free", goal: "waitlist",
          partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
        },
        createdAt: 1,
        updatedAt: 1,
      });
    };
    const projectId = await business(ownerId, "HydroTrail");
    const projectBId = await business(ownerId, "SecondBiz");
    const otherProjectId = await business(otherId, "OtherBiz");

    const doc = (pid: Id<"projects">, uid: Id<"users">, kind: "brand_kit" | "landing_spec" | "email_sequence") =>
      ctx.db.insert("documents", {
        ownerId: uid, projectId: pid, kind, format: "json", title: kind, body: "{}", createdAt: 2, updatedAt: 2,
      });
    const docId = await doc(projectId, ownerId, "brand_kit");
    const landingDocId = await doc(projectId, ownerId, "landing_spec");
    const docBId = await doc(projectBId, ownerId, "brand_kit");
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId, projectId, status: "draft", createdAt: 2, updatedAt: 2,
    });
    const siteVersionId = await ctx.db.insert("site_versions", {
      ownerId, projectId, siteConfigId, status: "ready", version: 1n, documentId: landingDocId, createdAt: 2,
    });
    const siteVersion2Id = await ctx.db.insert("site_versions", {
      ownerId, projectId, siteConfigId, status: "ready", version: 2n, documentId: landingDocId, createdAt: 2,
    });
    const draftVersionId = await ctx.db.insert("site_versions", {
      ownerId, projectId, siteConfigId, status: "draft", version: 3n, documentId: landingDocId, createdAt: 2,
    });
    const retiredVersionId = await ctx.db.insert("site_versions", {
      ownerId, projectId, siteConfigId, status: "retired", version: 4n, documentId: landingDocId, createdAt: 2, retiredAt: 2,
    });
    const sequenceId = await ctx.db.insert("sequences", {
      ownerId, projectId, status: "draft", title: "Welcome", createdAt: 2, updatedAt: 2,
    });
    const stepDocId = await doc(projectId, ownerId, "email_sequence");
    const stepId = await ctx.db.insert("sequence_steps", {
      ownerId, projectId, sequenceId, order: 1n, delayHours: 0, subject: "Hi", documentId: stepDocId,
      createdAt: 2, updatedAt: 2,
    });
    const adId = await ctx.db.insert("ad_campaigns", {
      ownerId, projectId, platform: "meta", objective: "leads", dailyBudgetCents: 500n, status: "draft",
      readiness: [], decisionLog: [], createdAt: 2, updatedAt: 2,
    });
    return {
      ownerId, otherId, ownerSessionId, otherSessionId, opsId, projectId, projectBId, otherProjectId,
      docId, landingDocId, docBId, siteConfigId, siteVersionId, siteVersion2Id, draftVersionId, retiredVersionId, sequenceId, stepDocId, stepId, adId,
    };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.ownerSessionId}`, issuer: "https://local.test" });
  const other = t.withIdentity({ subject: `${ids.otherId}|${ids.otherSessionId}`, issuer: "https://local.test" });
  return { t, owner, other, ids };
}

type Seeded = Awaited<ReturnType<typeof seed>>;

function publishSubject(ids: Seeded["ids"], overrides: Partial<ApprovalSubjectRef> = {}): ApprovalSubjectRef {
  return { projectId: ids.projectId, kind: "publish", subjectTable: "site_versions", subjectId: ids.siteVersionId, ...overrides };
}

async function create(t: T, ids: Seeded["ids"], subject: ApprovalSubjectRef, extra: { changeRound?: bigint; costCredits?: bigint } = {}) {
  return await t.mutation(internal.workspace.approvals.createApproval, {
    ownerId: ids.ownerId,
    projectId: subject.projectId,
    kind: subject.kind,
    subjectTable: subject.subjectTable,
    subjectId: subject.subjectId,
    ...extra,
  });
}

/** Raises and approves a card for the subject; returns its id. */
async function approved({ t, owner, ids }: Seeded, subject: ApprovalSubjectRef): Promise<Id<"approvals">> {
  const { approvalId } = await create(t, ids, subject);
  await owner.mutation(api.workspace.approvals.decideApproval, { projectId: subject.projectId, approvalId, decision: "approve" });
  return approvalId;
}

function check(t: T, approvalId: Id<"approvals">, subject: ApprovalSubjectRef) {
  return t.query(internal.workspace.approvals.checkApproved, { approvalId, subject });
}

async function setWorkspace(t: T, opsId: Id<"ops_settings">, workspaceEnabled: boolean) {
  await t.run(async (ctx) => ctx.db.patch("ops_settings", opsId, { workspaceEnabled }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("WP77-S1 create, list, approve, assertApproved", () => {
  test("create → listed → approve → assertApproved passes (query and mutation contexts)", async () => {
    const seeded = await seed();
    const { t, owner, ids } = seeded;
    const subject = publishSubject(ids);
    const { approvalId, created } = await create(t, ids, subject);
    expect(created).toBe(true);

    const pending = await owner.query(api.workspace.approvals.listPendingApprovals, { projectId: ids.projectId });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ _id: approvalId, kind: "publish", subjectTable: "site_versions", changeRound: 0n });
    expect(pending[0].expiresAt - pending[0].createdAt).toBe(APPROVAL_PENDING_TTL_MS);

    await expect(owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "approve" }))
      .resolves.toEqual({ approvalId, status: "approved", changed: true });
    await expect(owner.query(api.workspace.approvals.listPendingApprovals, { projectId: ids.projectId })).resolves.toEqual([]);

    await expect(check(t, approvalId, subject)).resolves.toMatchObject({ approvalId, kind: "publish", projectId: ids.projectId });
    await expect(check(t, approvalId, { ...subject, ownerId: ids.ownerId })).resolves.toMatchObject({ approvalId });

    const sendSubject: ApprovalSubjectRef = { projectId: ids.projectId, kind: "send", subjectTable: "sequences", subjectId: ids.sequenceId };
    const sendId = await approved(seeded, sendSubject);
    const row = await t.run(async (ctx) => await assertApproved(ctx, sendId, sendSubject));
    expect(row.status).toBe("approved");
  });

  test("creating the same card twice reuses it; a new round supersedes the old one", async () => {
    const { t, ids } = await seed();
    const subject: ApprovalSubjectRef = { projectId: ids.projectId, kind: "artifact_review", subjectTable: "documents", subjectId: ids.docId };
    const first = await create(t, ids, subject);
    await expect(create(t, ids, subject)).resolves.toEqual({ approvalId: first.approvalId, created: false });
    const second = await create(t, ids, subject, { changeRound: 1n });
    expect(second.created).toBe(true);
    const old = await t.run(async (ctx) => await ctx.db.get("approvals", first.approvalId));
    expect(old?.status).toBe("cancelled");
  });

  test("creation refuses bad subjects, inputs and businesses", async () => {
    const { t, ids } = await seed();
    const base = { ownerId: ids.ownerId, projectId: ids.projectId };
    await expect(t.mutation(internal.workspace.approvals.createApproval, {
      ...base, kind: "publish", subjectTable: "documents", subjectId: ids.docId,
    })).rejects.toThrow("APPROVAL_INVALID_SUBJECT");
    await expect(t.mutation(internal.workspace.approvals.createApproval, {
      ...base, kind: "publish", subjectTable: "site_versions", subjectId: ids.docId,
    })).rejects.toThrow("APPROVAL_INVALID_SUBJECT");
    await expect(t.mutation(internal.workspace.approvals.createApproval, {
      ...base, kind: "artifact_review", subjectTable: "documents", subjectId: ids.docBId,
    })).rejects.toThrow("APPROVAL_SUBJECT_NOT_FOUND");
    await expect(t.mutation(internal.workspace.approvals.createApproval, {
      ...base, kind: "artifact_review", subjectTable: "documents", subjectId: ids.docId, changeRound: -1n,
    })).rejects.toThrow("APPROVAL_INVALID_INPUT");
    await expect(t.mutation(internal.workspace.approvals.createApproval, {
      ownerId: ids.ownerId, projectId: ids.otherProjectId, kind: "upgrade", subjectTable: "projects", subjectId: ids.otherProjectId,
    })).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
});

describe("WP77-S1 decisions are exactly once", () => {
  test("a repeated approve is a no-op and a different later decision is refused", async () => {
    const seeded = await seed();
    const { t, owner, ids } = seeded;
    const approvalId = await approved(seeded, publishSubject(ids));
    const args = { projectId: ids.projectId, approvalId };
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { ...args, decision: "approve" }))
      .resolves.toEqual({ approvalId, status: "approved", changed: false });
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { ...args, decision: "request_changes", note: "x" }))
      .rejects.toThrow("APPROVAL_ALREADY_DECIDED");
    const { row, audits } = await t.run(async (ctx) => ({
      row: await ctx.db.get("approvals", approvalId),
      audits: await ctx.db.query("audit_events")
        .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", ids.projectId)).take(10),
    }));
    expect(row?.status).toBe("approved");
    expect(audits.filter((event) => event.subjectId === approvalId)).toHaveLength(1);
  });

  test("request changes stores the trimmed note; an over-long note is refused", async () => {
    const { t, owner, ids } = await seed();
    const subject = publishSubject(ids);
    const { approvalId } = await create(t, ids, subject);
    await expect(owner.mutation(api.workspace.approvals.decideApproval, {
      projectId: ids.projectId, approvalId, decision: "request_changes", note: "x".repeat(APPROVAL_NOTE_MAX_LENGTH + 1),
    })).rejects.toThrow("APPROVAL_INVALID_NOTE");
    await owner.mutation(api.workspace.approvals.decideApproval, {
      projectId: ids.projectId, approvalId, decision: "request_changes", note: "  Warmer headline  ",
    });
    const row = await t.run(async (ctx) => await ctx.db.get("approvals", approvalId));
    expect(row).toMatchObject({ status: "changes_requested", note: "Warmer headline" });
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_NOT_APPROVED");
  });

  test("approving a card whose subject changed since it was raised refuses without a transition", async () => {
    const { t, owner, ids } = await seed();
    const subject = publishSubject(ids);
    const { approvalId } = await create(t, ids, subject);
    await t.run(async (ctx) => ctx.db.patch("documents", ids.landingDocId, { body: "{\"v\":2}", updatedAt: Date.now() + 60_000 }));
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "approve" }))
      .rejects.toThrow("APPROVAL_SUBJECT_CHANGED");
    const row = await t.run(async (ctx) => await ctx.db.get("approvals", approvalId));
    expect(row?.status).toBe("pending");
    // Raising the card again for the new version closes the stale one.
    const fresh = await create(t, ids, subject);
    expect(fresh.created).toBe(true);
  });

  test("a card past its TTL expires on decision instead of being approved", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00.000Z"));
    const { t, owner, ids } = await seed();
    const subject = publishSubject(ids);
    const { approvalId } = await create(t, ids, subject);
    vi.setSystemTime(Date.now() + APPROVAL_PENDING_TTL_MS);
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "approve" }))
      .resolves.toEqual({ approvalId, status: "expired", changed: true });
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "approve" }))
      .rejects.toThrow("APPROVAL_ALREADY_DECIDED");
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_NOT_APPROVED");
  });
});

describe("WP77-S1 assertApproved fails closed", () => {
  test("cancelled and pending approvals are not approved", async () => {
    const { t, owner, ids } = await seed();
    const subject = publishSubject(ids);
    const { approvalId } = await create(t, ids, subject);
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_NOT_APPROVED");
    await owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "cancel" });
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_NOT_APPROVED");
  });

  test("wrong kind, project, owner, subject or missing approval", async () => {
    const seeded = await seed();
    const { t, ids } = seeded;
    const subject = publishSubject(ids);
    const approvalId = await approved(seeded, subject);

    await expect(check(t, approvalId, { ...subject, kind: "artifact_review" })).rejects.toThrow("APPROVAL_KIND_MISMATCH");
    await expect(check(t, approvalId, { ...subject, projectId: ids.projectBId })).rejects.toThrow("APPROVAL_PROJECT_MISMATCH");
    await expect(check(t, approvalId, { ...subject, ownerId: ids.otherId })).rejects.toThrow("APPROVAL_PROJECT_MISMATCH");
    await expect(check(t, approvalId, { ...subject, subjectId: ids.siteVersion2Id })).rejects.toThrow("APPROVAL_SUBJECT_MISMATCH");
    await expect(check(t, approvalId, { ...subject, subjectTable: "documents", subjectId: ids.landingDocId }))
      .rejects.toThrow("APPROVAL_SUBJECT_MISMATCH");

    // A row whose owner does not own the business (corrupt or forged) is refused.
    const forged = await t.run(async (ctx) => await ctx.db.insert("approvals", {
      ownerId: ids.otherId, projectId: ids.projectId, kind: "publish", subjectTable: "site_versions",
      subjectId: ids.siteVersionId, status: "approved", changeRound: 0n, createdAt: Date.now(), updatedAt: Date.now(),
    }));
    await expect(check(t, forged, subject)).rejects.toThrow("APPROVAL_PROJECT_MISMATCH");

    const deleted = await t.run(async (ctx) => {
      const id = await ctx.db.insert("approvals", {
        ownerId: ids.ownerId, projectId: ids.projectId, kind: "publish", subjectTable: "site_versions",
        subjectId: ids.siteVersionId, status: "approved", changeRound: 0n, createdAt: 1, updatedAt: 1,
      });
      await ctx.db.delete("approvals", id);
      return id;
    });
    await expect(check(t, deleted, subject)).rejects.toThrow("APPROVAL_NOT_FOUND");

    await t.run(async (ctx) => ctx.db.patch("projects", ids.projectId, { archivedAt: Date.now() }));
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_PROJECT_MISMATCH");
  });

  test("a later write to a timestamped subject fails closed: document, a site version's document, an added sequence step, ad budget", async () => {
    const seeded = await seed();
    const { t, ids } = seeded;
    const later = () => Date.now() + 60_000;

    const docSubject: ApprovalSubjectRef = { projectId: ids.projectId, kind: "artifact_review", subjectTable: "documents", subjectId: ids.docId };
    const docApproval = await approved(seeded, docSubject);
    await expect(check(t, docApproval, docSubject)).resolves.toMatchObject({ approvalId: docApproval });
    await t.run(async (ctx) => ctx.db.patch("documents", ids.docId, { body: "{\"edited\":true}", updatedAt: later() }));
    await expect(check(t, docApproval, docSubject)).rejects.toThrow("APPROVAL_SUBJECT_CHANGED");

    const publish = publishSubject(ids);
    const publishApproval = await approved(seeded, publish);
    await t.run(async (ctx) => ctx.db.patch("documents", ids.landingDocId, { updatedAt: later() }));
    await expect(check(t, publishApproval, publish)).rejects.toThrow("APPROVAL_SUBJECT_CHANGED");

    const send: ApprovalSubjectRef = { projectId: ids.projectId, kind: "send", subjectTable: "sequences", subjectId: ids.sequenceId };
    const sendApproval = await approved(seeded, send);
    await t.run(async (ctx) => ctx.db.insert("sequence_steps", {
      ownerId: ids.ownerId, projectId: ids.projectId, sequenceId: ids.sequenceId, order: 2n, delayHours: 24,
      subject: "Added later", documentId: ids.stepDocId, createdAt: later(), updatedAt: later(),
    }));
    await expect(check(t, sendApproval, send)).rejects.toThrow("APPROVAL_SUBJECT_CHANGED");

    const ad: ApprovalSubjectRef = { projectId: ids.projectId, kind: "ad_launch", subjectTable: "ad_campaigns", subjectId: ids.adId };
    const adApproval = await approved(seeded, ad);
    await t.run(async (ctx) => ctx.db.patch("ad_campaigns", ids.adId, { dailyBudgetCents: 50_000n, updatedAt: later() }));
    await expect(check(t, adApproval, ad)).rejects.toThrow("APPROVAL_SUBJECT_CHANGED");
  });

  test("a deleted subject, or a subject linked to another approval, is refused", async () => {
    const seeded = await seed();
    const { t, ids } = seeded;
    const step: ApprovalSubjectRef = { projectId: ids.projectId, kind: "send", subjectTable: "sequence_steps", subjectId: ids.stepId };
    const stepApproval = await approved(seeded, step);
    await expect(check(t, stepApproval, step)).resolves.toMatchObject({ approvalId: stepApproval });
    const otherApproval = await t.run(async (ctx) => await ctx.db.insert("approvals", {
      ownerId: ids.ownerId, projectId: ids.projectId, kind: "send", subjectTable: "sequence_steps",
      subjectId: ids.stepId, status: "cancelled", changeRound: 0n, createdAt: 1, updatedAt: 1,
    }));
    // Linking without bumping updatedAt isolates the link check from the version check.
    await t.run(async (ctx) => ctx.db.patch("sequence_steps", ids.stepId, { approvalId: otherApproval }));
    await expect(check(t, stepApproval, step)).rejects.toThrow("APPROVAL_SUBJECT_MISMATCH");

    const ad: ApprovalSubjectRef = { projectId: ids.projectId, kind: "ad_launch", subjectTable: "ad_campaigns", subjectId: ids.adId };
    const adApproval = await approved(seeded, ad);
    await t.run(async (ctx) => ctx.db.delete("ad_campaigns", ids.adId));
    await expect(check(t, adApproval, ad)).rejects.toThrow("APPROVAL_SUBJECT_NOT_FOUND");
  });
});

describe("WP77-S1 owner only and dormant", () => {
  test("a non-owner or signed-out caller cannot list or decide", async () => {
    const { t, owner, other, ids } = await seed();
    const { approvalId } = await create(t, ids, publishSubject(ids));
    await expect(other.query(api.workspace.approvals.listPendingApprovals, { projectId: ids.projectId }))
      .rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(other.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "approve" }))
      .rejects.toThrow("RESOURCE_NOT_FOUND");
    // The other founder's own business does not unlock this approval either.
    await expect(other.mutation(api.workspace.approvals.decideApproval, { projectId: ids.otherProjectId, approvalId, decision: "approve" }))
      .rejects.toThrow("RESOURCE_NOT_FOUND");
    // Nor does the owner's other business.
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectBId, approvalId, decision: "approve" }))
      .rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(t.query(api.workspace.approvals.listPendingApprovals, { projectId: ids.projectId }))
      .rejects.toThrow("UNAUTHENTICATED");
    await expect(t.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "approve" }))
      .rejects.toThrow("UNAUTHENTICATED");
    const row = await t.run(async (ctx) => await ctx.db.get("approvals", approvalId));
    expect(row?.status).toBe("pending");
  });

  test("with the workspace switch off everything refuses", async () => {
    const seeded = await seed();
    const { t, owner, ids } = seeded;
    const subject = publishSubject(ids);
    const approvalId = await approved(seeded, subject);
    const { approvalId: pendingId } = await create(t, ids, { ...subject, subjectId: ids.siteVersion2Id });
    await setWorkspace(t, ids.opsId, false);

    await expect(owner.query(api.workspace.approvals.listPendingApprovals, { projectId: ids.projectId }))
      .rejects.toThrow("WORKSPACE_DISABLED");
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId: pendingId, decision: "approve" }))
      .rejects.toThrow("WORKSPACE_DISABLED");
    await expect(create(t, ids, { projectId: ids.projectId, kind: "artifact_review", subjectTable: "documents", subjectId: ids.docId }))
      .rejects.toThrow("WORKSPACE_DISABLED");
    await expect(check(t, approvalId, subject)).rejects.toThrow("WORKSPACE_DISABLED");
  });

  test("the kind's kill switch refuses its side effect but not other kinds", async () => {
    const seeded = await seed({ publishKillSwitch: true });
    const { t, ids } = seeded;
    const publish = publishSubject(ids);
    const publishApproval = await approved(seeded, publish);
    await expect(check(t, publishApproval, publish)).rejects.toThrow("WORKSPACE_DISABLED");
    const review: ApprovalSubjectRef = { projectId: ids.projectId, kind: "artifact_review", subjectTable: "site_versions", subjectId: ids.siteVersionId };
    const reviewApproval = await approved(seeded, review);
    await expect(check(t, reviewApproval, review)).resolves.toMatchObject({ approvalId: reviewApproval });
  });
});

describe("WP77-S1 expiry", () => {
  test("one batch is bounded; a run finishes the table; a second run is a no-op", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00.000Z"));
    const { t, ids } = await seed();
    const now = Date.now();
    const stale = now - APPROVAL_PENDING_TTL_MS - 1;
    const insert = (status: "pending" | "approved", createdAt: number) =>
      t.run(async (ctx) => await ctx.db.insert("approvals", {
        ownerId: ids.ownerId, projectId: ids.projectId, kind: "artifact_review", subjectTable: "documents",
        subjectId: ids.docId, status, changeRound: 0n, createdAt, updatedAt: createdAt,
      }));
    const staleIds: Id<"approvals">[] = [];
    for (let index = 0; index < 5; index += 1) staleIds.push(await insert("pending", stale));
    const freshId = await insert("pending", now);
    const approvedId = await insert("approved", stale);

    // Newest first: the first page is the two most recent rows (approved, fresh), neither expirable.
    const first = await t.mutation(internal.workspace.approvals.expireStaleApprovalsBatch, { batchSize: 2 });
    expect(first).toMatchObject({ scanned: 2, expired: 0, isDone: false });

    await expect(t.action(internal.workspace.approvals.expireStaleApprovals, { batchSize: 2 }))
      .resolves.toEqual({ scanned: 7, expired: 5, batches: 4, isDone: true });
    const rows = await t.run(async (ctx) => await Promise.all(
      [...staleIds, freshId, approvedId].map((id) => ctx.db.get("approvals", id)),
    ));
    expect(rows.slice(0, 5).every((row) => row?.status === "expired")).toBe(true);
    expect(rows[5]?.status).toBe("pending");
    expect(rows[6]?.status).toBe("approved");

    await expect(t.action(internal.workspace.approvals.expireStaleApprovals, {}))
      .resolves.toEqual({ scanned: 7, expired: 0, batches: 1, isDone: true });
  });

  test("a bounded batch reaches the newest stale card first", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00.000Z"));
    const { t, ids } = await seed();
    const stale = Date.now() - APPROVAL_PENDING_TTL_MS - 1;
    const insert = () => t.run(async (ctx) => await ctx.db.insert("approvals", {
      ownerId: ids.ownerId, projectId: ids.projectId, kind: "artifact_review", subjectTable: "documents",
      subjectId: ids.docId, status: "pending", changeRound: 0n, createdAt: stale, updatedAt: stale,
    }));
    const olderId = await insert();
    const newerId = await insert();
    await expect(t.mutation(internal.workspace.approvals.expireStaleApprovalsBatch, { batchSize: 1 }))
      .resolves.toMatchObject({ scanned: 1, expired: 1, isDone: false });
    const [older, newer] = await t.run(async (ctx) => [await ctx.db.get("approvals", olderId), await ctx.db.get("approvals", newerId)]);
    expect(newer?.status).toBe("expired");
    expect(older?.status).toBe("pending");
  });

  test("expiry still runs with the workspace off (it only removes permission)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00.000Z"));
    const { t, ids } = await seed({ workspaceEnabled: false });
    await t.run(async (ctx) => await ctx.db.insert("approvals", {
      ownerId: ids.ownerId, projectId: ids.projectId, kind: "publish", subjectTable: "site_versions",
      subjectId: ids.siteVersionId, status: "pending", changeRound: 0n, createdAt: 1, updatedAt: 1,
    }));
    await expect(t.action(internal.workspace.approvals.expireStaleApprovals, {}))
      .resolves.toEqual({ scanned: 1, expired: 1, batches: 1, isDone: true });
  });
});

describe("WP77-S1 review fixes", () => {
  test("publish refuses a draft or retired version and a taken-down site, at creation, approval and check", async () => {
    const seeded = await seed();
    const { t, owner, ids } = seeded;
    await expect(create(t, ids, publishSubject(ids, { subjectId: ids.draftVersionId })))
      .rejects.toThrow("APPROVAL_SUBJECT_NOT_PUBLISHABLE");
    await expect(create(t, ids, publishSubject(ids, { subjectId: ids.retiredVersionId })))
      .rejects.toThrow("APPROVAL_SUBJECT_NOT_PUBLISHABLE");
    // A review card for a retired version is fine: only publish needs a publishable version.
    await expect(create(t, ids, { ...publishSubject(ids, { subjectId: ids.retiredVersionId }), kind: "artifact_review" }))
      .resolves.toMatchObject({ created: true });

    const subject = publishSubject(ids);
    const approvalId = await approved(seeded, subject);
    const { approvalId: pendingId } = await create(t, ids, publishSubject(ids, { subjectId: ids.siteVersion2Id }));
    await t.run(async (ctx) => ctx.db.patch("site_configs", ids.siteConfigId, { takedownAt: 5, takedownReason: "policy" }));
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_SUBJECT_NOT_PUBLISHABLE");
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId: pendingId, decision: "approve" }))
      .rejects.toThrow("APPROVAL_SUBJECT_NOT_PUBLISHABLE");
    await t.run(async (ctx) => ctx.db.patch("site_configs", ids.siteConfigId, { takedownAt: undefined, takedownReason: undefined }));
    await expect(check(t, approvalId, subject)).resolves.toMatchObject({ approvalId });
    // A status move to retired (allowed, insert-only content) also stops publishing.
    await t.run(async (ctx) => ctx.db.patch("site_versions", ids.siteVersionId, { status: "retired", retiredAt: 6 }));
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_SUBJECT_NOT_PUBLISHABLE");
  });

  test("a new card for the same subject cancels an older approved card, with an audit row", async () => {
    const seeded = await seed();
    const { t, ids } = seeded;
    const subject = publishSubject(ids);
    const oldId = await approved(seeded, subject);
    // Pad the subject's history past the old 50-row scan window; the old card is the oldest row.
    await t.run(async (ctx) => {
      for (let index = 0; index < 60; index += 1) {
        await ctx.db.insert("approvals", {
          ownerId: ids.ownerId, projectId: ids.projectId, kind: "publish", subjectTable: "site_versions",
          subjectId: ids.siteVersionId, status: "cancelled", changeRound: 0n, createdAt: 3, updatedAt: 3,
        });
      }
    });
    const fresh = await create(t, ids, subject);
    expect(fresh.created).toBe(true);
    await expect(check(t, oldId, subject)).rejects.toThrow("APPROVAL_NOT_APPROVED");
    const audits = await t.run(async (ctx) => await ctx.db.query("audit_events")
      .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", ids.projectId)).take(20));
    expect(audits.filter((event) => event.subjectId === oldId).map((event) => event.action))
      .toEqual(["approval.approved", "approval.superseded"]);
  });

  test("the owner can revoke an approved card exactly once; others cannot", async () => {
    const seeded = await seed();
    const { t, owner, other, ids } = seeded;
    const subject = publishSubject(ids);
    const approvalId = await approved(seeded, subject);
    const args = { projectId: ids.projectId, approvalId };
    await expect(other.mutation(api.workspace.approvals.decideApproval, { ...args, decision: "cancel" }))
      .rejects.toThrow("RESOURCE_NOT_FOUND");
    const approvedRow = await t.run(async (ctx) => await ctx.db.get("approvals", approvalId));
    vi.useFakeTimers();
    vi.setSystemTime((approvedRow?.decidedAt ?? 0) + 60_000);
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { ...args, decision: "cancel" }))
      .resolves.toEqual({ approvalId, status: "cancelled", changed: true });
    vi.useRealTimers();
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { ...args, decision: "cancel" }))
      .resolves.toEqual({ approvalId, status: "cancelled", changed: false });
    const revokedRow = await t.run(async (ctx) => await ctx.db.get("approvals", approvalId));
    // The approve time is kept; only status and updatedAt move.
    expect(revokedRow?.decidedAt).toBe(approvedRow?.decidedAt);
    expect(revokedRow?.updatedAt).toBe((approvedRow?.decidedAt ?? 0) + 60_000);
    await expect(owner.mutation(api.workspace.approvals.decideApproval, { ...args, decision: "approve" }))
      .rejects.toThrow("APPROVAL_ALREADY_DECIDED");
    await expect(check(t, approvalId, subject)).rejects.toThrow("APPROVAL_NOT_APPROVED");
    const audits = await t.run(async (ctx) => await ctx.db.query("audit_events")
      .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", ids.projectId)).take(20));
    const trail = audits.filter((event) => event.subjectId === approvalId);
    expect(trail.map((event) => event.action)).toEqual(["approval.approved", "approval.revoked"]);
    expect(trail[1].createdAt).toBe(revokedRow?.updatedAt);
  });

  test("spend cards are bound to their price and round", async () => {
    const seeded = await seed();
    const { t, ids } = seeded;
    const spend: ApprovalSubjectRef = { projectId: ids.projectId, kind: "spend", subjectTable: "documents", subjectId: ids.docId };
    await expect(create(t, ids, spend)).rejects.toThrow("APPROVAL_INVALID_INPUT");
    await expect(create(t, ids, spend, { costCredits: 0n })).rejects.toThrow("APPROVAL_INVALID_INPUT");
    await expect(create(t, ids, publishSubject(ids), { costCredits: 5n })).rejects.toThrow("APPROVAL_INVALID_INPUT");

    const { approvalId } = await create(t, ids, spend, { changeRound: 3n, costCredits: 10n });
    await seeded.owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId, decision: "approve" });
    await expect(check(t, approvalId, spend)).rejects.toThrow("APPROVAL_TERMS_MISMATCH");
    await expect(check(t, approvalId, { ...spend, expectedCostCredits: 10n })).rejects.toThrow("APPROVAL_TERMS_MISMATCH");
    await expect(check(t, approvalId, { ...spend, expectedCostCredits: 50n, expectedChangeRound: 3n }))
      .rejects.toThrow("APPROVAL_TERMS_MISMATCH");
    await expect(check(t, approvalId, { ...spend, expectedCostCredits: 10n, expectedChangeRound: 4n }))
      .rejects.toThrow("APPROVAL_TERMS_MISMATCH");
    await expect(check(t, approvalId, { ...spend, expectedCostCredits: 10n, expectedChangeRound: 3n }))
      .resolves.toMatchObject({ approvalId, costCredits: 10n, changeRound: 3n });

    // A forged pending spend card without a price cannot be approved: same code as assertApproved.
    const forged = await t.run(async (ctx) => await ctx.db.insert("approvals", {
      ownerId: ids.ownerId, projectId: ids.projectId, kind: "spend", subjectTable: "documents",
      subjectId: ids.docId, status: "pending", changeRound: 3n, createdAt: Date.now(), updatedAt: Date.now(),
    }));
    await expect(seeded.owner.mutation(api.workspace.approvals.decideApproval, { projectId: ids.projectId, approvalId: forged, decision: "approve" }))
      .rejects.toThrow("APPROVAL_TERMS_MISMATCH");
  });
});
