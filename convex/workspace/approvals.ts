import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { assertFeatureEnabled, assertFeatureEnabledForOwner, type WorkspaceFeature } from "../ops/settings";
import { requireBusinessAccess, requireBusinessForOwner } from "../platform/authz";
import {
  APPROVAL_DECISION_STATUS,
  APPROVAL_DECISIONS,
  APPROVAL_EXPIRY_BATCH_DEFAULT,
  APPROVAL_EXPIRY_BATCH_MAX,
  APPROVAL_KINDS,
  APPROVAL_LIST_LIMIT,
  APPROVAL_STATUSES,
  APPROVAL_SUBJECT_TABLE_NAMES,
  MAX_SEQUENCE_STEPS,
  approvalExpiresAt,
  isPendingApprovalStale,
  isSubjectTableAllowed,
  isSubjectUnchangedSince,
  normalizeApprovalNote,
  type ApprovalErrorCode,
  type ApprovalKind,
  type ApprovalSubject,
  type ApprovalSubjectTable,
} from "../../lib/workspace/contracts/approvals";

/**
 * WP77-S1 — C-APPROVAL. The only gate for side effects (`02` §4.2, §14).
 *
 * Founder-facing (public, dormant behind C-OPS `workspace`, owner-only via
 * C-AUTHZ per D12): `listPendingApprovals`, `decideApproval`.
 * Internal: `createApproval` (generators, Codex flows), `expireStaleApprovals`
 * (cron target), `checkApproved` (the action-side wrapper of `assertApproved`).
 * Helpers for other Convex code: `createApprovalRecord`, `assertApproved`.
 *
 * `assertApproved(ctx, approvalId, subject)` — call it inside the mutation that
 * records the side effect, BEFORE patching the subject in that mutation:
 *
 *   await assertApproved(ctx, approvalId, {
 *     projectId, kind: "publish", subjectTable: "site_versions", subjectId: siteVersionId,
 *   });
 *
 * It returns the approval row or throws `ConvexError({ code })` with a code from
 * `APPROVAL_ERROR_CODES` (or C-OPS's `WORKSPACE_DISABLED` when the workspace or
 * the kind's kill switch is off). It never consumes the approval: an approved
 * `send` may gate several step sends; exactly-once delivery is the caller's
 * idempotency key. From an action, run `internal.workspace.approvals.checkApproved`
 * for an early refusal, and re-check with `assertApproved` in the mutation that
 * records the result (an action's read is not transactional with its write).
 *
 * Version (see `APPROVAL_VERSION_POLICY` in the contract): the subject and the
 * content rows it carries must not have been written after the approval was
 * created. GAP: `approvals` has no content-fingerprint column, so on mutable
 * workflow rows a status-only patch after creation also counts as a change and
 * the approval fails closed. A subject row's `approvalId` link must be written
 * in the same mutation as `createApproval` (same timestamp) for the same reason.
 */

// ---------------------------------------------------------------------------
// Validators and types
// ---------------------------------------------------------------------------

type ReadCtx = Pick<QueryCtx, "db">;

function literals<T extends string>(values: readonly [T, T, ...T[]]) {
  const [first, second, ...rest] = values;
  return v.union(v.literal(first), v.literal(second), ...rest.map((value) => v.literal(value)));
}

export const approvalKindValidator = literals(APPROVAL_KINDS);
export const approvalStatusValidator = literals(APPROVAL_STATUSES);
export const approvalDecisionValidator = literals(APPROVAL_DECISIONS);
export const approvalSubjectTableValidator = literals(APPROVAL_SUBJECT_TABLE_NAMES);

/** The C-APPROVAL subject with server id types. */
export type ApprovalSubjectRef = ApprovalSubject<Id<"projects">, Id<"users">>;

export const approvalSubjectValidator = v.object({
  projectId: v.id("projects"),
  kind: approvalKindValidator,
  subjectTable: approvalSubjectTableValidator,
  subjectId: v.string(),
  ownerId: v.optional(v.id("users")),
});

const pendingApprovalValidator = v.object({
  _id: v.id("approvals"),
  kind: approvalKindValidator,
  subjectTable: v.string(),
  subjectId: v.string(),
  changeRound: v.int64(),
  costCredits: v.optional(v.int64()),
  createdAt: v.number(),
  expiresAt: v.number(),
});

const decisionResultValidator = v.object({
  approvalId: v.id("approvals"),
  status: approvalStatusValidator,
  changed: v.boolean(),
});

const approvedSummaryValidator = v.object({
  approvalId: v.id("approvals"),
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  kind: approvalKindValidator,
  changeRound: v.int64(),
  costCredits: v.optional(v.int64()),
  decidedAt: v.optional(v.number()),
});

function refuse(code: ApprovalErrorCode, extra: Record<string, string> = {}): never {
  throw new ConvexError({ ...extra, code });
}

function denyNotFound(): never {
  // Same answer as C-AUTHZ for a missing or foreign record.
  throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
}

/** The kill switch a kind's side effect sits behind, besides the workspace switch. */
const KIND_FEATURE: Record<ApprovalKind, WorkspaceFeature> = {
  artifact_review: "workspace",
  publish: "publish",
  send: "email",
  post: "social",
  ad_launch: "ads",
  spend: "workspace",
  upgrade: "workspace",
};

// ---------------------------------------------------------------------------
// Subject state (existence, business chain, version timestamps)
// ---------------------------------------------------------------------------

type SubjectState =
  | { readonly found: false; readonly reason: "invalid_id" | "missing" | "unsupported" }
  | {
    readonly found: true;
    /** Write times that must all be at or before the approval's `createdAt`. */
    readonly writeTimes: readonly number[];
    /** The approval the subject row itself links to, when it has that column. */
    readonly linkedApprovalId?: Id<"approvals">;
  };

type BusinessRow = { ownerId: Id<"users">; projectId: Id<"projects">; archivedAt?: number };

function inBusiness(row: BusinessRow | null, ownerId: Id<"users">, projectId: Id<"projects">): boolean {
  return row !== null && row.ownerId === ownerId && row.projectId === projectId && row.archivedAt === undefined;
}

const MISSING: SubjectState = { found: false, reason: "missing" };
const INVALID_ID: SubjectState = { found: false, reason: "invalid_id" };

/** A document's write time, or null when it is not in the business. */
async function documentWriteTime(
  ctx: ReadCtx,
  documentId: Id<"documents">,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
): Promise<number | null> {
  const document = await ctx.db.get("documents", documentId);
  if (document === null || !inBusiness(document, ownerId, projectId)) return null;
  if (document.taskId !== undefined) {
    const task = await ctx.db.get("tasks", document.taskId);
    if (!inBusiness(task, ownerId, projectId)) return null;
  }
  return document.updatedAt;
}

async function optionalDocumentTimes(
  ctx: ReadCtx,
  documentId: Id<"documents"> | undefined,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
): Promise<number[] | null> {
  if (documentId === undefined) return [];
  const time = await documentWriteTime(ctx, documentId, ownerId, projectId);
  return time === null ? null : [time];
}

async function readSubjectState(
  ctx: ReadCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  table: ApprovalSubjectTable,
  subjectId: string,
): Promise<SubjectState> {
  switch (table) {
    case "documents": {
      const id = ctx.db.normalizeId("documents", subjectId);
      if (id === null) return INVALID_ID;
      const time = await documentWriteTime(ctx, id, ownerId, projectId);
      return time === null ? MISSING : { found: true, writeTimes: [time] };
    }
    case "site_versions": {
      const id = ctx.db.normalizeId("site_versions", subjectId);
      if (id === null) return INVALID_ID;
      const version = await ctx.db.get("site_versions", id);
      if (version === null || !inBusiness(version, ownerId, projectId)) return MISSING;
      const site = await ctx.db.get("site_configs", version.siteConfigId);
      if (!inBusiness(site, ownerId, projectId)) return MISSING;
      const docTimes = await optionalDocumentTimes(ctx, version.documentId, ownerId, projectId);
      if (docTimes === null) return MISSING;
      // Immutable row: its id is the version; only the linked document can move.
      return { found: true, writeTimes: [version.createdAt, ...docTimes] };
    }
    case "sequences": {
      const id = ctx.db.normalizeId("sequences", subjectId);
      if (id === null) return INVALID_ID;
      const sequence = await ctx.db.get("sequences", id);
      if (sequence === null || !inBusiness(sequence, ownerId, projectId)) return MISSING;
      const steps = await ctx.db.query("sequence_steps")
        .withIndex("by_sequenceId_and_order", (q) => q.eq("sequenceId", id))
        .take(MAX_SEQUENCE_STEPS + 1);
      if (steps.length > MAX_SEQUENCE_STEPS) return { found: false, reason: "unsupported" };
      const writeTimes: number[] = [sequence.updatedAt];
      for (const step of steps) {
        if (!inBusiness(step, ownerId, projectId)) return MISSING;
        const docTime = await documentWriteTime(ctx, step.documentId, ownerId, projectId);
        if (docTime === null) return MISSING;
        writeTimes.push(step.updatedAt, docTime);
      }
      return { found: true, writeTimes };
    }
    case "sequence_steps": {
      const id = ctx.db.normalizeId("sequence_steps", subjectId);
      if (id === null) return INVALID_ID;
      const step = await ctx.db.get("sequence_steps", id);
      if (step === null || !inBusiness(step, ownerId, projectId)) return MISSING;
      const sequence = await ctx.db.get("sequences", step.sequenceId);
      if (!inBusiness(sequence, ownerId, projectId)) return MISSING;
      const docTime = await documentWriteTime(ctx, step.documentId, ownerId, projectId);
      if (docTime === null) return MISSING;
      return { found: true, writeTimes: [step.updatedAt, docTime], linkedApprovalId: step.approvalId };
    }
    case "social_posts": {
      const id = ctx.db.normalizeId("social_posts", subjectId);
      if (id === null) return INVALID_ID;
      const post = await ctx.db.get("social_posts", id);
      if (post === null || !inBusiness(post, ownerId, projectId)) return MISSING;
      if (post.socialAccountId !== undefined) {
        const account = await ctx.db.get("social_accounts", post.socialAccountId);
        if (!inBusiness(account, ownerId, projectId)) return MISSING;
      }
      const docTimes = await optionalDocumentTimes(ctx, post.documentId, ownerId, projectId);
      if (docTimes === null) return MISSING;
      return { found: true, writeTimes: [post.updatedAt, ...docTimes], linkedApprovalId: post.approvalId };
    }
    case "ad_campaigns": {
      const id = ctx.db.normalizeId("ad_campaigns", subjectId);
      if (id === null) return INVALID_ID;
      const campaign = await ctx.db.get("ad_campaigns", id);
      if (campaign === null || !inBusiness(campaign, ownerId, projectId)) return MISSING;
      return { found: true, writeTimes: [campaign.updatedAt], linkedApprovalId: campaign.approvalId };
    }
    case "outbound_messages": {
      const id = ctx.db.normalizeId("outbound_messages", subjectId);
      if (id === null) return INVALID_ID;
      const message = await ctx.db.get("outbound_messages", id);
      if (message === null || !inBusiness(message, ownerId, projectId)) return MISSING;
      const list = await ctx.db.get("outbound_lists", message.listId);
      if (list === null || !inBusiness(list, ownerId, projectId)) return MISSING;
      const docTimes = await optionalDocumentTimes(ctx, message.documentId, ownerId, projectId);
      if (docTimes === null) return MISSING;
      return {
        found: true,
        writeTimes: [message.updatedAt, list.updatedAt, ...docTimes],
        linkedApprovalId: message.approvalId,
      };
    }
    case "tasks": {
      const id = ctx.db.normalizeId("tasks", subjectId);
      if (id === null) return INVALID_ID;
      const task = await ctx.db.get("tasks", id);
      if (task === null || !inBusiness(task, ownerId, projectId)) return MISSING;
      return { found: true, writeTimes: [task.updatedAt], linkedApprovalId: task.approvalId };
    }
    case "projects": {
      const id = ctx.db.normalizeId("projects", subjectId);
      if (id === null) return INVALID_ID;
      if (id !== projectId) return MISSING;
      const project = await ctx.db.get("projects", id);
      if (project === null || project.ownerId !== ownerId || project.archivedAt !== undefined) return MISSING;
      // Identity policy: the business itself, not its content.
      return { found: true, writeTimes: [] };
    }
  }
}

// ---------------------------------------------------------------------------
// C-APPROVAL: assertApproved
// ---------------------------------------------------------------------------

/**
 * Fails closed unless `approvalId` is an `approved` approval of exactly this
 * subject, in the same live business and owner, and the subject has not changed
 * since the approval was created. Usable from queries and mutations.
 */
export async function assertApproved(
  ctx: ReadCtx,
  approvalId: Id<"approvals">,
  subject: ApprovalSubjectRef,
): Promise<Doc<"approvals">> {
  const normalized = ctx.db.normalizeId("approvals", approvalId);
  const approval = normalized === null ? null : await ctx.db.get("approvals", normalized);
  if (approval === null) return refuse("APPROVAL_NOT_FOUND");

  // Runtime switches first: a switched-off workspace or side effect refuses everything.
  await assertFeatureEnabledForOwner(ctx, "workspace", approval.ownerId);
  const feature = KIND_FEATURE[subject.kind];
  if (feature !== "workspace") await assertFeatureEnabledForOwner(ctx, feature, approval.ownerId);

  if (approval.projectId !== subject.projectId) return refuse("APPROVAL_PROJECT_MISMATCH");
  if (subject.ownerId !== undefined && subject.ownerId !== approval.ownerId) {
    return refuse("APPROVAL_PROJECT_MISMATCH");
  }
  const project = await ctx.db.get("projects", approval.projectId);
  if (project === null || project.ownerId !== approval.ownerId || project.archivedAt !== undefined) {
    return refuse("APPROVAL_PROJECT_MISMATCH");
  }

  if (approval.kind !== subject.kind) return refuse("APPROVAL_KIND_MISMATCH");
  if (
    !isSubjectTableAllowed(subject.kind, subject.subjectTable) ||
    approval.subjectTable !== subject.subjectTable ||
    approval.subjectId !== subject.subjectId
  ) {
    return refuse("APPROVAL_SUBJECT_MISMATCH");
  }

  if (approval.status !== "approved") return refuse("APPROVAL_NOT_APPROVED", { status: approval.status });

  const state = await readSubjectState(ctx, approval.ownerId, approval.projectId, subject.subjectTable, subject.subjectId);
  if (!state.found) {
    return refuse(state.reason === "unsupported" ? "APPROVAL_SUBJECT_MISMATCH" : "APPROVAL_SUBJECT_NOT_FOUND");
  }
  if (state.linkedApprovalId !== undefined && state.linkedApprovalId !== approval._id) {
    return refuse("APPROVAL_SUBJECT_MISMATCH");
  }
  if (!isSubjectUnchangedSince(state.writeTimes, approval.createdAt)) return refuse("APPROVAL_SUBJECT_CHANGED");
  return approval;
}

/** Action-side wrapper: `ctx.runQuery(internal.workspace.approvals.checkApproved, ...)`. */
export const checkApproved = internalQuery({
  args: { approvalId: v.id("approvals"), subject: approvalSubjectValidator },
  returns: approvedSummaryValidator,
  handler: async (ctx, args) => {
    const approval = await assertApproved(ctx, args.approvalId, args.subject);
    return {
      approvalId: approval._id,
      ownerId: approval.ownerId,
      projectId: approval.projectId,
      kind: approval.kind,
      changeRound: approval.changeRound,
      ...(approval.costCredits === undefined ? {} : { costCredits: approval.costCredits }),
      ...(approval.decidedAt === undefined ? {} : { decidedAt: approval.decidedAt }),
    };
  },
});

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export type CreateApprovalInput = {
  readonly ownerId: Id<"users">;
  readonly projectId: Id<"projects">;
  readonly kind: ApprovalKind;
  readonly subjectTable: ApprovalSubjectTable;
  readonly subjectId: string;
  /** D17 round of the artifact this card reviews; default 0 (first draft). */
  readonly changeRound?: bigint;
  /** Credits the card will debit when approved (`spend`), from C-JOBS. */
  readonly costCredits?: bigint;
};

/** Pending approvals for the same subject that a creation may reuse or supersede. */
const SUPERSEDE_SCAN_LIMIT = 50;

/**
 * Raises (or reuses) the pending card for one subject. The owner id must come
 * from an already-authorised business or trusted system work, never a client.
 * One live pending card per (business, kind, subject): an identical fresh one
 * is returned (`created: false`); a stale one (subject changed, past its TTL,
 * or a different round or price) is closed first.
 */
export async function createApprovalRecord(
  ctx: MutationCtx,
  input: CreateApprovalInput,
): Promise<{ approvalId: Id<"approvals">; created: boolean }> {
  const changeRound = input.changeRound ?? 0n;
  if (changeRound < 0n || (input.costCredits !== undefined && input.costCredits < 0n)) {
    return refuse("APPROVAL_INVALID_INPUT");
  }
  await requireBusinessForOwner(ctx, input.projectId, input.ownerId);
  await assertFeatureEnabledForOwner(ctx, "workspace", input.ownerId);
  if (!isSubjectTableAllowed(input.kind, input.subjectTable)) return refuse("APPROVAL_INVALID_SUBJECT");

  const state = await readSubjectState(ctx, input.ownerId, input.projectId, input.subjectTable, input.subjectId);
  if (!state.found) {
    return refuse(state.reason === "missing" ? "APPROVAL_SUBJECT_NOT_FOUND" : "APPROVAL_INVALID_SUBJECT");
  }

  const now = Date.now();
  const sameSubject = await ctx.db.query("approvals")
    .withIndex("by_subjectId", (q) => q.eq("subjectId", input.subjectId))
    .order("desc")
    .take(SUPERSEDE_SCAN_LIMIT);
  for (const existing of sameSubject) {
    if (
      existing.status !== "pending" ||
      existing.projectId !== input.projectId ||
      existing.ownerId !== input.ownerId ||
      existing.kind !== input.kind ||
      existing.subjectTable !== input.subjectTable
    ) continue;
    const stale = isPendingApprovalStale(existing.createdAt, now);
    const reusable = !stale &&
      isSubjectUnchangedSince(state.writeTimes, existing.createdAt) &&
      existing.changeRound === changeRound &&
      existing.costCredits === input.costCredits;
    if (reusable) return { approvalId: existing._id, created: false };
    await ctx.db.patch("approvals", existing._id, {
      status: stale ? "expired" : "cancelled",
      decidedAt: now,
      updatedAt: now,
    });
  }

  const approvalId = await ctx.db.insert("approvals", {
    ownerId: input.ownerId,
    projectId: input.projectId,
    kind: input.kind,
    subjectTable: input.subjectTable,
    subjectId: input.subjectId,
    status: "pending",
    changeRound,
    ...(input.costCredits === undefined ? {} : { costCredits: input.costCredits }),
    createdAt: now,
    updatedAt: now,
  });
  return { approvalId, created: true };
}

export const createApproval = internalMutation({
  args: {
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    kind: approvalKindValidator,
    subjectTable: approvalSubjectTableValidator,
    subjectId: v.string(),
    changeRound: v.optional(v.int64()),
    costCredits: v.optional(v.int64()),
  },
  returns: v.object({ approvalId: v.id("approvals"), created: v.boolean() }),
  handler: async (ctx, args) => await createApprovalRecord(ctx, args),
});

// ---------------------------------------------------------------------------
// Founder-facing
// ---------------------------------------------------------------------------

/** The business's pending cards, newest first, at most `APPROVAL_LIST_LIMIT`. */
export const listPendingApprovals = query({
  args: { projectId: v.id("projects") },
  returns: v.array(pendingApprovalValidator),
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const rows = await ctx.db.query("approvals")
      .withIndex("by_projectId_and_status", (q) => q.eq("projectId", project._id).eq("status", "pending"))
      .order("desc")
      .take(APPROVAL_LIST_LIMIT);
    return rows
      .filter((row) => row.ownerId === project.ownerId)
      .map((row) => ({
        _id: row._id,
        kind: row.kind,
        subjectTable: row.subjectTable,
        subjectId: row.subjectId,
        changeRound: row.changeRound,
        ...(row.costCredits === undefined ? {} : { costCredits: row.costCredits }),
        createdAt: row.createdAt,
        // Queries never read the clock; the client hides cards past this time.
        expiresAt: approvalExpiresAt(row.createdAt),
      }));
  },
});

/** Kinds whose decisions go to the security log (`02` §4.1: approvals that send or spend). */
const AUDITED_KINDS: ReadonlySet<ApprovalKind> = new Set(["send", "post", "publish", "spend", "ad_launch", "upgrade"]);

/**
 * Approve, ask for changes (optional note) or cancel one pending card.
 * Exactly once: repeating the decision that already happened is a no-op
 * (`changed: false`); any other decision on a decided card throws
 * `APPROVAL_ALREADY_DECIDED`. A card past its TTL becomes `expired` instead.
 * Approving re-checks the subject and refuses (no transition) when it has
 * changed or gone since the card was raised.
 */
export const decideApproval = mutation({
  args: {
    projectId: v.id("projects"),
    approvalId: v.id("approvals"),
    decision: approvalDecisionValidator,
    note: v.optional(v.string()),
  },
  returns: decisionResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const approval = await ctx.db.get("approvals", args.approvalId);
    if (approval === null || approval.projectId !== project._id || approval.ownerId !== project.ownerId) {
      return denyNotFound();
    }

    const note = args.decision === "request_changes" ? normalizeApprovalNote(args.note) : undefined;
    if (note === null) return refuse("APPROVAL_INVALID_NOTE");

    const target = APPROVAL_DECISION_STATUS[args.decision];
    if (approval.status !== "pending") {
      if (approval.status === target) return { approvalId: approval._id, status: approval.status, changed: false };
      return refuse("APPROVAL_ALREADY_DECIDED", { status: approval.status });
    }

    const now = Date.now();
    if (isPendingApprovalStale(approval.createdAt, now)) {
      await ctx.db.patch("approvals", approval._id, { status: "expired", decidedAt: now, updatedAt: now });
      return { approvalId: approval._id, status: "expired" as const, changed: true };
    }

    if (args.decision === "approve") {
      if (!isSubjectTableAllowed(approval.kind, approval.subjectTable)) return refuse("APPROVAL_SUBJECT_MISMATCH");
      const state = await readSubjectState(ctx, approval.ownerId, approval.projectId, approval.subjectTable, approval.subjectId);
      if (!state.found) return refuse("APPROVAL_SUBJECT_NOT_FOUND");
      if (state.linkedApprovalId !== undefined && state.linkedApprovalId !== approval._id) {
        return refuse("APPROVAL_SUBJECT_MISMATCH");
      }
      if (!isSubjectUnchangedSince(state.writeTimes, approval.createdAt)) return refuse("APPROVAL_SUBJECT_CHANGED");
    }

    await ctx.db.patch("approvals", approval._id, {
      status: target,
      decidedAt: now,
      updatedAt: now,
      ...(note === undefined ? {} : { note }),
    });
    if (AUDITED_KINDS.has(approval.kind)) {
      await ctx.db.insert("audit_events", {
        ownerId: approval.ownerId,
        projectId: approval.projectId,
        actorType: "user",
        actorUserId: project.ownerId,
        action: `approval.${target}`,
        subjectType: "approval",
        subjectId: approval._id,
        metadata: JSON.stringify({ kind: approval.kind, subjectTable: approval.subjectTable, subjectId: approval.subjectId }),
        createdAt: now,
      });
    }
    return { approvalId: approval._id, status: target, changed: true };
  },
});

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/**
 * Cron target (Codex wires it in `convex/crons.ts`). Expires pending cards past
 * `APPROVAL_PENDING_TTL_MS`, one bounded page per transaction, and schedules
 * the next page until the table is done. Idempotent: it only touches rows
 * still pending and stale. It runs while the workspace is off, because closing
 * stale cards only removes permission (same reasoning as the 2026-11-06 C-METER
 * shutdown-cleanup ruling). Without a status index it pages the whole table;
 * Codex is asked for `by_status_and_createdAt`.
 */
export const expireStaleApprovals = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scanned: v.number(), expired: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const requested = args.batchSize !== undefined && Number.isFinite(args.batchSize)
      ? Math.floor(args.batchSize)
      : APPROVAL_EXPIRY_BATCH_DEFAULT;
    const batchSize = Math.min(Math.max(requested, 1), APPROVAL_EXPIRY_BATCH_MAX);
    const now = Date.now();
    const page = await ctx.db.query("approvals").paginate({ numItems: batchSize, cursor: args.cursor ?? null });
    let expired = 0;
    for (const row of page.page) {
      if (row.status !== "pending" || !isPendingApprovalStale(row.createdAt, now)) continue;
      await ctx.db.patch("approvals", row._id, { status: "expired", decidedAt: now, updatedAt: now });
      expired += 1;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.workspace.approvals.expireStaleApprovals, {
        cursor: page.continueCursor,
        batchSize,
      });
    }
    return { scanned: page.page.length, expired, isDone: page.isDone };
  },
});
