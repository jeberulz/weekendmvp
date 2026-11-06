import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalAction,
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
  APPROVAL_EXPIRY_MAX_BATCHES_PER_RUN,
  APPROVAL_KINDS,
  APPROVAL_LIST_LIMIT,
  APPROVAL_STATUSES,
  APPROVAL_SUBJECT_TABLE_NAMES,
  MAX_SEQUENCE_STEPS,
  approvalCostFitsKind,
  approvalExpiresAt,
  isPendingApprovalStale,
  isPricedApprovalKind,
  isPublishableSiteVersion,
  isSubjectTableAllowed,
  isSubjectUnchangedSince,
  normalizeApprovalNote,
  type ApprovalErrorCode,
  type ApprovalKind,
  type ApprovalSubject,
  type ApprovalSubjectTable,
} from "../../lib/workspace/contracts/approvals";
import { jobKey, type CreditActionKey, type JobType } from "../../lib/workspace/contracts/jobs";
import { spendTermsFor, type ChangeRoundDecision } from "../../lib/workspace/changeRounds";
import {
  changeRoundOutcomeValidator,
  insertRevisionTask,
  resolveChangeRound,
  type ArtifactLineage,
  type ChangeRoundOutcome,
} from "./changeRounds";

/**
 * WP77-S1 — C-APPROVAL. The only gate for side effects (`02` §4.2, §14).
 *
 * Founder-facing (public, dormant behind C-OPS `workspace`, owner-only via
 * C-AUTHZ per D12): `listPendingApprovals`, `decideApproval`.
 * Internal: `createApproval` (generators, Codex flows), `expireStaleApprovals`
 * (cron target, an action looping `expireStaleApprovalsBatch`), `checkApproved`
 * (the action-side wrapper of `assertApproved`).
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
 * `site_versions` carry no write time: their content fields are insert-only,
 * enforced by `tests/security/wp77-site-versions-insert-only.test.mjs`. The real
 * fix is `approvals.subjectVersion`; once it exists, an approval without one
 * must fail closed.
 *
 * Single-use kinds (publish, send activation, ad_launch, spend, upgrade) must be
 * consumed by the side-effect mutation; until `approvals.consumedAt` exists the
 * caller's own idempotency is the only consumption. `spend` subjects must carry
 * `expectedCostCredits` and `expectedChangeRound`, matched against the card.
 *
 * WP77-S2 change rounds (D17): "Ask for changes" on an `artifact_review` card
 * runs `resolveChangeRound` in the same mutation. Rounds 1 and 2 close the card
 * (`changes_requested`, the founder's note kept as data) and queue a free
 * revision task. Round 3+ closes the card and raises (or reuses) one `spend`
 * card on the revised document with the C-JOBS price and the round; nothing is
 * debited here; the spend card carries the founder's note. Asking again on a
 * `changes_requested` review card raises a fresh spend card only when the round
 * is still paid and no live, unchanged one exists (after a decline, an expiry
 * or a document change). A round that is not available (`PRICE_NOT_SET`, plan gated, a
 * draft still in progress, a stale draft, no task lineage) changes nothing and
 * returns `not_available`. The paid round's debit site calls
 * `assertPaidRevisionApproved` (below) in the debit mutation.
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
  expectedCostCredits: v.optional(v.int64()),
  expectedChangeRound: v.optional(v.int64()),
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
  /** WP77-S2: set when "Ask for changes" on an `artifact_review` card ran the round logic. */
  changeRound: v.optional(changeRoundOutcomeValidator),
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
    /** Site versions only: publishable status and the site is not taken down. */
    readonly publishable?: boolean;
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
      // Insert-only content (static scan): the id is the version; only the
      // linked document can move. Status transitions do not count as changes.
      return {
        found: true,
        writeTimes: [version.createdAt, ...docTimes],
        publishable: isPublishableSiteVersion(version.status, site?.takedownAt),
      };
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

/**
 * Why a subject cannot be (or no longer is) approved for `kind`, or null.
 * `approvedAt` is the approval's `createdAt` for the version check; pass the
 * approval id to also refuse a subject row that links to a different approval.
 */
function subjectRefusal(
  state: SubjectState,
  kind: ApprovalKind,
  approvedAt: number,
  approvalId?: Id<"approvals">,
): ApprovalErrorCode | null {
  if (!state.found) return state.reason === "missing" ? "APPROVAL_SUBJECT_NOT_FOUND" : "APPROVAL_SUBJECT_MISMATCH";
  if (kind === "publish" && state.publishable !== true) return "APPROVAL_SUBJECT_NOT_PUBLISHABLE";
  if (approvalId !== undefined && state.linkedApprovalId !== undefined && state.linkedApprovalId !== approvalId) {
    return "APPROVAL_SUBJECT_MISMATCH";
  }
  if (!isSubjectUnchangedSince(state.writeTimes, approvedAt)) return "APPROVAL_SUBJECT_CHANGED";
  return null;
}

async function auditApproval(
  ctx: MutationCtx,
  approval: Doc<"approvals">,
  action: string,
  actor: { type: "user"; userId: Id<"users"> } | { type: "system" },
  now: number,
): Promise<void> {
  await ctx.db.insert("audit_events", {
    ownerId: approval.ownerId,
    projectId: approval.projectId,
    actorType: actor.type,
    ...(actor.type === "user" ? { actorUserId: actor.userId } : {}),
    action,
    subjectType: "approval",
    subjectId: approval._id,
    metadata: JSON.stringify({ kind: approval.kind, subjectTable: approval.subjectTable, subjectId: approval.subjectId }),
    createdAt: now,
  });
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

  // Terms: a priced card is bound to the exact price and round the caller debits.
  if (
    (isPricedApprovalKind(subject.kind) &&
      (subject.expectedCostCredits === undefined || subject.expectedChangeRound === undefined)) ||
    (subject.expectedCostCredits !== undefined && subject.expectedCostCredits !== approval.costCredits) ||
    (subject.expectedChangeRound !== undefined && subject.expectedChangeRound !== approval.changeRound) ||
    !approvalCostFitsKind(approval.kind, approval.costCredits)
  ) {
    return refuse("APPROVAL_TERMS_MISMATCH");
  }

  const state = await readSubjectState(ctx, approval.ownerId, approval.projectId, subject.subjectTable, subject.subjectId);
  const refusal = subjectRefusal(state, subject.kind, approval.createdAt, approval._id);
  if (refusal !== null) return refuse(refusal);
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
  /** Required (positive) for `spend`, refused on every other kind: the C-JOBS price. */
  readonly costCredits?: bigint;
  /**
   * WP77-S2: `spend` only. The founder's "Ask for changes" note copied from the
   * review card, so the paid revision task's card holds its note (data, never
   * instructions). Normalised like a decision note; refused on other kinds.
   */
  readonly note?: string;
};

/**
 * Raises (or reuses) the pending card for one subject. The owner id must come
 * from an already-authorised business or trusted system work, never a client.
 * One live card per (business, kind, subject): an identical fresh pending card
 * is returned (`created: false`). Otherwise every older pending card is closed
 * (expired past its TTL, else cancelled) and every older approved card is
 * cancelled with an audit row, so an old approval cannot outlive a new card.
 */
export async function createApprovalRecord(
  ctx: MutationCtx,
  input: CreateApprovalInput,
): Promise<{ approvalId: Id<"approvals">; created: boolean }> {
  const changeRound = input.changeRound ?? 0n;
  if (changeRound < 0n || !approvalCostFitsKind(input.kind, input.costCredits)) return refuse("APPROVAL_INVALID_INPUT");
  const note = normalizeApprovalNote(input.note);
  if (note === null) return refuse("APPROVAL_INVALID_NOTE");
  if (note !== undefined && input.kind !== "spend") return refuse("APPROVAL_INVALID_INPUT");
  await requireBusinessForOwner(ctx, input.projectId, input.ownerId);
  await assertFeatureEnabledForOwner(ctx, "workspace", input.ownerId);
  if (!isSubjectTableAllowed(input.kind, input.subjectTable)) return refuse("APPROVAL_INVALID_SUBJECT");

  const state = await readSubjectState(ctx, input.ownerId, input.projectId, input.subjectTable, input.subjectId);
  if (!state.found) {
    return refuse(state.reason === "missing" ? "APPROVAL_SUBJECT_NOT_FOUND" : "APPROVAL_INVALID_SUBJECT");
  }
  if (input.kind === "publish" && state.publishable !== true) return refuse("APPROVAL_SUBJECT_NOT_PUBLISHABLE");

  const now = Date.now();
  // Read every card for this subject id (the index is exact, so this is the
  // subject's whole history, not a table scan) before writing anything.
  const live: Doc<"approvals">[] = [];
  for await (const existing of ctx.db.query("approvals")
    .withIndex("by_subjectId", (q) => q.eq("subjectId", input.subjectId))) {
    if (
      (existing.status === "pending" || existing.status === "approved") &&
      existing.projectId === input.projectId &&
      existing.ownerId === input.ownerId &&
      existing.kind === input.kind &&
      existing.subjectTable === input.subjectTable
    ) live.push(existing);
  }
  const reusable = live.find((existing) =>
    existing.status === "pending" &&
    !isPendingApprovalStale(existing.createdAt, now) &&
    isSubjectUnchangedSince(state.writeTimes, existing.createdAt) &&
    existing.changeRound === changeRound &&
    existing.costCredits === input.costCredits);
  if (reusable !== undefined) return { approvalId: reusable._id, created: false };

  for (const existing of live) {
    if (existing.status === "approved") {
      await ctx.db.patch("approvals", existing._id, { status: "cancelled", decidedAt: now, updatedAt: now });
      await auditApproval(ctx, existing, "approval.superseded", { type: "system" }, now);
    } else {
      await ctx.db.patch("approvals", existing._id, {
        status: isPendingApprovalStale(existing.createdAt, now) ? "expired" : "cancelled",
        decidedAt: now,
        updatedAt: now,
      });
    }
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
    ...(note === undefined ? {} : { note }),
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

// ---------------------------------------------------------------------------
// WP77-S2: change rounds
// ---------------------------------------------------------------------------

type DecisionResult = {
  approvalId: Id<"approvals">;
  status: Doc<"approvals">["status"];
  changed: boolean;
  changeRound?: ChangeRoundOutcome;
};

/** Most approval rows one revised document's history may hold before a paid round fails closed. */
export const SPEND_CARD_HISTORY_MAX = 100;

/**
 * The live `spend` card for this exact paid round, if one exists: same revised
 * document, round and price, still pending (fresh) or approved, and the
 * document unchanged since the card was raised. Reusing it (instead of
 * `createApprovalRecord`, which would supersede an approved card) keeps a
 * repeated request from raising a second card or revoking an approved one. A
 * card whose document changed is not reused; `createApprovalRecord` then
 * supersedes it. The read is capped at `SPEND_CARD_HISTORY_MAX` rows of the
 * document's approval history and fails closed past it
 * (`CHANGE_ROUND_HISTORY_LIMIT`) until Codex's `by_subjectId_and_kind` index lets
 * it read spend cards only.
 */
async function liveSpendCard(
  ctx: MutationCtx,
  lineage: ArtifactLineage,
  changeRound: bigint,
  costCredits: bigint,
  now: number,
): Promise<Doc<"approvals"> | null> {
  const history = await ctx.db.query("approvals")
    .withIndex("by_subjectId", (q) => q.eq("subjectId", lineage.revisedDocumentId))
    .take(SPEND_CARD_HISTORY_MAX + 1);
  if (history.length > SPEND_CARD_HISTORY_MAX) throw new ConvexError({ code: "CHANGE_ROUND_HISTORY_LIMIT" });
  const state = await readSubjectState(ctx, lineage.ownerId, lineage.projectId, "documents", lineage.revisedDocumentId);
  if (!state.found) return null;
  return history.find((card) =>
    card.kind === "spend" &&
    card.subjectTable === "documents" &&
    card.projectId === lineage.projectId &&
    card.ownerId === lineage.ownerId &&
    card.changeRound === changeRound &&
    card.costCredits === costCredits &&
    (card.status === "approved" || (card.status === "pending" && !isPendingApprovalStale(card.createdAt, now))) &&
    isSubjectUnchangedSince(state.writeTimes, card.createdAt)) ?? null;
}

/**
 * Raises (or reuses) the `spend` card for a paid round. `changed` is true when
 * a new card was written. The founder's note is copied onto a new card.
 */
async function raiseSpendCard(
  ctx: MutationCtx,
  lineage: ArtifactLineage,
  decision: Extract<ChangeRoundDecision, { decision: "spend" }>,
  note: string | undefined,
  founder: { type: "user"; userId: Id<"users"> },
  now: number,
): Promise<{ spendApprovalId: Id<"approvals">; created: boolean }> {
  const terms = spendTermsFor(decision);
  const existing = await liveSpendCard(ctx, lineage, terms.expectedChangeRound, terms.expectedCostCredits, now);
  if (existing !== null) return { spendApprovalId: existing._id, created: false };
  const { approvalId, created } = await createApprovalRecord(ctx, {
    ownerId: lineage.ownerId,
    projectId: lineage.projectId,
    kind: "spend",
    subjectTable: "documents",
    subjectId: lineage.revisedDocumentId,
    changeRound: terms.expectedChangeRound,
    costCredits: terms.expectedCostCredits,
    ...(note === undefined ? {} : { note }),
  });
  if (created) {
    const spendCard = await ctx.db.get("approvals", approvalId);
    if (spendCard !== null) await auditApproval(ctx, spendCard, "approval.spend_raised", founder, now);
  }
  return { spendApprovalId: approvalId, created };
}

/**
 * "Ask for changes" on a pending, fresh `artifact_review` card. Exactly once:
 * the card moves out of `pending` in the same transaction as the round starts.
 * Two requests on different cards of the same artifact conflict on the lineage
 * read, and the second finds the first round queued (`busy`).
 */
async function requestArtifactChanges(
  ctx: MutationCtx,
  approval: Doc<"approvals">,
  note: string | undefined,
  founder: { type: "user"; userId: Id<"users"> },
  now: number,
): Promise<DecisionResult> {
  const resolution = await resolveChangeRound(ctx, approval.ownerId, approval.projectId, approval.subjectTable, approval.subjectId);
  if (!resolution.ok) {
    return { approvalId: approval._id, status: approval.status, changed: false, changeRound: { outcome: "not_available", reason: resolution.reason } };
  }
  const { lineage, decision } = resolution;
  if (decision.decision === "not_available") {
    return {
      approvalId: approval._id,
      status: approval.status,
      changed: false,
      changeRound: { outcome: "not_available", reason: decision.reason, changeRound: decision.changeRound },
    };
  }

  await ctx.db.patch("approvals", approval._id, {
    status: "changes_requested",
    decidedAt: now,
    updatedAt: now,
    ...(note === undefined ? {} : { note }),
  });

  if (decision.decision === "free") {
    const taskId = await insertRevisionTask(ctx, {
      lineage, changeRound: decision.changeRound, creditCost: 0n, approvalId: approval._id, now,
    });
    return {
      approvalId: approval._id,
      status: "changes_requested",
      changed: true,
      changeRound: { outcome: "free", changeRound: decision.changeRound, freeRoundsLeft: decision.freeRoundsLeft, taskId },
    };
  }

  const { spendApprovalId } = await raiseSpendCard(ctx, lineage, decision, note, founder, now);
  return {
    approvalId: approval._id,
    status: "changes_requested",
    changed: true,
    changeRound: { outcome: "spend_required", changeRound: decision.changeRound, costCredits: decision.costCredits, spendApprovalId },
  };
}

/**
 * "Ask for changes" again on a `changes_requested` review card. The only thing
 * it can do is give a paid round its spend card back after the founder declined
 * it, it expired, or the document changed: when the round is still paid and no
 * live, unchanged spend card exists, it raises a fresh one (the new note, else
 * the review card's note). With a live card it returns that card and writes
 * nothing. Every other case (a free round, a draft in progress, a newer draft,
 * not available) is S1's plain no-op, so a double click never starts a second
 * round.
 */
async function reaskPaidRound(
  ctx: MutationCtx,
  approval: Doc<"approvals">,
  note: string | undefined,
  founder: { type: "user"; userId: Id<"users"> },
  now: number,
): Promise<DecisionResult> {
  const noop: DecisionResult = { approvalId: approval._id, status: approval.status, changed: false };
  const resolution = await resolveChangeRound(ctx, approval.ownerId, approval.projectId, approval.subjectTable, approval.subjectId);
  if (!resolution.ok || resolution.decision.decision !== "spend") return noop;
  const decision = resolution.decision;
  const { spendApprovalId, created } = await raiseSpendCard(ctx, resolution.lineage, decision, note ?? approval.note, founder, now);
  return {
    approvalId: approval._id,
    status: approval.status,
    changed: created,
    changeRound: { outcome: "spend_required", changeRound: decision.changeRound, costCredits: decision.costCredits, spendApprovalId },
  };
}

export type PaidRevisionTerms = {
  readonly approval: Doc<"approvals">;
  readonly lineage: ArtifactLineage;
  readonly jobType: JobType;
  readonly changeRound: number;
  readonly costCredits: number;
  readonly action: CreditActionKey;
  /** The C-JOBS key the paid revision task must use. */
  readonly jobKey: string;
};

/**
 * The check a paid change round's debit site runs, in the SAME mutation that
 * inserts the revision task and debits it (C-JOBS: debit at job start):
 *
 *   const paid = await assertPaidRevisionApproved(ctx, spendApprovalId, { projectId, documentId });
 *   const taskId = await insertRevisionTask(ctx, {
 *     lineage: paid.lineage, changeRound: paid.changeRound, creditCost: BigInt(paid.costCredits),
 *     approvalId: paid.approval._id, now,
 *   });
 *   // then Codex's debit for taskId (`task-debit:{taskId}`), same mutation.
 *
 * It recomputes the round and the C-JOBS price from the artifact's tasks (never
 * from the card) and passes them to `assertApproved` as the spend terms, so the
 * card must be an approved `spend` card for exactly this document, round and
 * price. Once the paid task is inserted the artifact is `busy` and then on the
 * next round, so the same card can never pay twice; if the job fails and is
 * refunded, the round is given back and a retry may debit again under it.
 * Throws `APPROVAL_TERMS_MISMATCH` when the round is no longer a paid round
 * with these terms, and every `assertApproved` refusal otherwise.
 */
export async function assertPaidRevisionApproved(
  ctx: QueryCtx,
  spendApprovalId: Id<"approvals">,
  target: { readonly projectId: Id<"projects">; readonly documentId: Id<"documents"> },
): Promise<PaidRevisionTerms> {
  const normalized = ctx.db.normalizeId("approvals", spendApprovalId);
  const card = normalized === null ? null : await ctx.db.get("approvals", normalized);
  if (card === null) return refuse("APPROVAL_NOT_FOUND");
  await assertFeatureEnabledForOwner(ctx, "workspace", card.ownerId);
  if (card.projectId !== target.projectId) return refuse("APPROVAL_PROJECT_MISMATCH");

  const resolution = await resolveChangeRound(ctx, card.ownerId, target.projectId, "documents", target.documentId);
  if (!resolution.ok || resolution.decision.decision !== "spend" || resolution.lineage.revisedDocumentId !== target.documentId) {
    return refuse("APPROVAL_TERMS_MISMATCH");
  }
  const decision = resolution.decision;
  const approval = await assertApproved(ctx, card._id, {
    projectId: target.projectId,
    kind: "spend",
    subjectTable: "documents",
    subjectId: target.documentId,
    ownerId: card.ownerId,
    ...spendTermsFor(decision),
  });
  const { lineage } = resolution;
  return {
    approval,
    lineage,
    jobType: lineage.jobType,
    changeRound: decision.changeRound,
    costCredits: decision.costCredits,
    action: decision.action,
    jobKey: jobKey(lineage.projectId, lineage.jobType, lineage.subject, decision.changeRound),
  };
}

/** Kinds whose decisions go to the security log (`02` §4.1: approvals that send or spend). */
const AUDITED_KINDS: ReadonlySet<ApprovalKind> = new Set(["send", "post", "publish", "spend", "ad_launch", "upgrade"]);

/**
 * Approve, ask for changes (optional note) or cancel one pending card, or revoke
 * an approved card (`cancel`). Exactly once: repeating the decision that already
 * happened is a no-op (`changed: false`); approved → cancelled is the only move
 * out of a decided state; anything else throws `APPROVAL_ALREADY_DECIDED`. A
 * pending card past its TTL becomes `expired` instead. Approving re-checks the
 * subject and refuses (no transition) when it has changed, gone, or (publish)
 * stopped being publishable since the card was raised.
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
    const founder = { type: "user" as const, userId: project.ownerId };

    // The note is founder-written data. S2 hands it to the revision job as
    // quoted user content inside the prompt's data block, never as instructions.
    const note = args.decision === "request_changes" ? normalizeApprovalNote(args.note) : undefined;
    if (note === null) return refuse("APPROVAL_INVALID_NOTE");

    const target = APPROVAL_DECISION_STATUS[args.decision];
    const now = Date.now();
    if (approval.status !== "pending") {
      if (approval.status === "changes_requested" && approval.kind === "artifact_review" && args.decision === "request_changes") {
        return await reaskPaidRound(ctx, approval, note, founder, now);
      }
      if (approval.status === target) return { approvalId: approval._id, status: approval.status, changed: false };
      if (approval.status === "approved" && args.decision === "cancel") {
        // Revocation: blocks every later side effect; one already performed stays done.
        // `decidedAt` keeps the approve time; the audit row carries the revoke time.
        await ctx.db.patch("approvals", approval._id, { status: "cancelled", updatedAt: now });
        await auditApproval(ctx, approval, "approval.revoked", founder, now);
        return { approvalId: approval._id, status: "cancelled" as const, changed: true };
      }
      return refuse("APPROVAL_ALREADY_DECIDED", { status: approval.status });
    }

    if (isPendingApprovalStale(approval.createdAt, now)) {
      await ctx.db.patch("approvals", approval._id, { status: "expired", decidedAt: now, updatedAt: now });
      return { approvalId: approval._id, status: "expired" as const, changed: true };
    }

    if (args.decision === "request_changes" && approval.kind === "artifact_review") {
      return await requestArtifactChanges(ctx, approval, note, founder, now);
    }

    if (args.decision === "approve") {
      if (!isSubjectTableAllowed(approval.kind, approval.subjectTable)) return refuse("APPROVAL_SUBJECT_MISMATCH");
      // Same code as assertApproved: a cost that does not fit the kind is a terms fault.
      if (!approvalCostFitsKind(approval.kind, approval.costCredits)) return refuse("APPROVAL_TERMS_MISMATCH");
      const state = await readSubjectState(ctx, approval.ownerId, approval.projectId, approval.subjectTable, approval.subjectId);
      const refusal = subjectRefusal(state, approval.kind, approval.createdAt, approval._id);
      if (refusal !== null) return refuse(refusal);
    }

    await ctx.db.patch("approvals", approval._id, {
      status: target,
      decidedAt: now,
      updatedAt: now,
      ...(note === undefined ? {} : { note }),
    });
    if (AUDITED_KINDS.has(approval.kind)) await auditApproval(ctx, approval, `approval.${target}`, founder, now);
    return { approvalId: approval._id, status: target, changed: true };
  },
});

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

const expiryBatchResultValidator = v.object({
  scanned: v.number(),
  expired: v.number(),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

type ExpiryBatchResult = { scanned: number; expired: number; isDone: boolean; continueCursor: string };

function expiryBatchSize(requested: number | undefined): number {
  const size = requested !== undefined && Number.isFinite(requested) ? Math.floor(requested) : APPROVAL_EXPIRY_BATCH_DEFAULT;
  return Math.min(Math.max(size, 1), APPROVAL_EXPIRY_BATCH_MAX);
}

/**
 * One bounded page of expiry: pending cards past `APPROVAL_PENDING_TTL_MS`
 * become `expired`. Idempotent (touches only rows still pending and stale) and
 * never schedules anything. Newest first: until Codex's `by_status_and_createdAt`
 * index lands it pages the whole table, so each run reaches the recent cards
 * (where pending ones live) before older, already-decided history.
 */
export const expireStaleApprovalsBatch = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: expiryBatchResultValidator,
  handler: async (ctx, args): Promise<ExpiryBatchResult> => {
    const now = Date.now();
    const page = await ctx.db.query("approvals")
      .order("desc")
      .paginate({ numItems: expiryBatchSize(args.batchSize), cursor: args.cursor ?? null });
    let expired = 0;
    for (const row of page.page) {
      if (row.status !== "pending" || !isPendingApprovalStale(row.createdAt, now)) continue;
      await ctx.db.patch("approvals", row._id, { status: "expired", decidedAt: now, updatedAt: now });
      expired += 1;
    }
    return { scanned: page.page.length, expired, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/**
 * Cron target (Codex wires it in `convex/crons.ts`, hourly). Walks the table in
 * bounded batches, at most `APPROVAL_EXPIRY_MAX_BATCHES_PER_RUN` per run, inside
 * this one action and schedules nothing, so runs cannot overlap (a cron job runs
 * one instance at a time). It runs while the workspace is off, because closing
 * stale cards only removes permission (same reasoning as the 2026-11-06 C-METER
 * shutdown-cleanup ruling).
 */
export const expireStaleApprovals = internalAction({
  args: { batchSize: v.optional(v.number()) },
  returns: v.object({ scanned: v.number(), expired: v.number(), batches: v.number(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    let cursor: string | null = null;
    let scanned = 0;
    let expired = 0;
    for (let batches = 1; batches <= APPROVAL_EXPIRY_MAX_BATCHES_PER_RUN; batches += 1) {
      const result: ExpiryBatchResult = await ctx.runMutation(internal.workspace.approvals.expireStaleApprovalsBatch, {
        cursor,
        batchSize: args.batchSize,
      });
      scanned += result.scanned;
      expired += result.expired;
      if (result.isDone) return { scanned, expired, batches, isDone: true };
      cursor = result.continueCursor;
    }
    return { scanned, expired, batches: APPROVAL_EXPIRY_MAX_BATCHES_PER_RUN, isDone: false };
  },
});
