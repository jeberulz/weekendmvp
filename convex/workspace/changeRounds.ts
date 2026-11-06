import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { resolvePlan } from "../platform/planResolver";
import { jobKey, parseJobKey, type JobType } from "../../lib/workspace/contracts/jobs";
import {
  decideChangeRound,
  isRevisableJobType,
  nextChangeRound,
  type ChangeRoundDecision,
  type LineageTask,
} from "../../lib/workspace/changeRounds";

/**
 * WP77-S2 — change rounds (D17) on the Convex side.
 *
 * An `artifact_review` card names a crew document (or a landing site version
 * and, through it, its document). The document's `taskId` names the task that
 * made it, and that task's C-JOBS `jobKey` (`crew:{projectId}:{type}:{subject}:{revision}`)
 * names the artifact: (projectId, jobType, subject). Every task of that artifact
 * shares the key prefix, so the `by_ownerId_and_jobKey` index reads exactly the
 * artifact's lineage. The round is counted from those tasks (pure helper
 * `nextChangeRound`); no counter is stored and no card is trusted for it.
 *
 * - `resolveChangeRound` (read-only): where the artifact stands and what the
 *   next round costs (`decideChangeRound`). Used by `decideApproval` when the
 *   founder asks for changes, by `previewChangeRound` for the card, and by the
 *   paid-round debit check (`assertPaidRevisionApproved` in `approvals.ts`).
 * - `insertRevisionTask`: the queued revision job for a round. The free round
 *   inserts it from `decideApproval`; the paid round's debit site inserts it
 *   (with `creditCost` and the spend card) in the debit mutation.
 *
 * Requirement on generators (WP75, WP76): every artifact document links its
 * task (`documents.taskId`), and that task carries its C-JOBS `jobKey` and
 * `changeRound` equal to the key's revision. A document without that lineage
 * cannot start a round (`untracked`), so it never gets a free revision.
 */

// ---------------------------------------------------------------------------
// Lineage
// ---------------------------------------------------------------------------

/** Most tasks one artifact's lineage may hold (retries included) before rounds fail closed. */
export const CHANGE_ROUND_LINEAGE_MAX = 200;

export type ArtifactLineage = {
  readonly ownerId: Id<"users">;
  readonly projectId: Id<"projects">;
  readonly jobType: JobType;
  readonly subject: string;
  /** The task that made the draft under review. */
  readonly reviewedTask: Doc<"tasks">;
  /** The document a revision revises (and a paid round's `spend` card names). */
  readonly revisedDocumentId: Id<"documents">;
};

export type ChangeRoundBlock = "untracked" | "busy" | "stale" | "conflict";

export type ChangeRoundResolution =
  | { readonly ok: true; readonly lineage: ArtifactLineage; readonly decision: ChangeRoundDecision }
  | { readonly ok: false; readonly reason: ChangeRoundBlock };

type BusinessRow = { ownerId: Id<"users">; projectId: Id<"projects">; archivedAt?: number };

function inBusiness(row: BusinessRow | null, ownerId: Id<"users">, projectId: Id<"projects">): boolean {
  return row !== null && row.ownerId === ownerId && row.projectId === projectId && row.archivedAt === undefined;
}

async function revisedDocument(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  subjectTable: string,
  subjectId: string,
): Promise<Doc<"documents"> | null> {
  let documentId: Id<"documents"> | null = null;
  if (subjectTable === "documents") {
    documentId = ctx.db.normalizeId("documents", subjectId);
  } else if (subjectTable === "site_versions") {
    const versionId = ctx.db.normalizeId("site_versions", subjectId);
    const version = versionId === null ? null : await ctx.db.get("site_versions", versionId);
    if (version === null || !inBusiness(version, ownerId, projectId)) return null;
    documentId = version.documentId ?? null;
  }
  if (documentId === null) return null;
  const document = await ctx.db.get("documents", documentId);
  return document !== null && inBusiness(document, ownerId, projectId) ? document : null;
}

/**
 * The artifact a reviewed subject belongs to, or why it has none. The owner and
 * business come from an already-authorised card or business, never a client.
 */
async function readLineage(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  subjectTable: string,
  subjectId: string,
): Promise<{ lineage: ArtifactLineage; tasks: LineageTask[] } | { block: ChangeRoundBlock }> {
  const document = await revisedDocument(ctx, ownerId, projectId, subjectTable, subjectId);
  if (document === null || document.taskId === undefined) return { block: "untracked" };
  const reviewedTask = await ctx.db.get("tasks", document.taskId);
  if (reviewedTask === null || !inBusiness(reviewedTask, ownerId, projectId) || reviewedTask.jobKey === undefined) {
    return { block: "untracked" };
  }
  const parsed = parseJobKey(reviewedTask.jobKey);
  if (parsed === null || parsed.projectId !== projectId || parsed.jobType !== reviewedTask.type) {
    return { block: "untracked" };
  }

  // Every key of this artifact: `crew:{projectId}:{type}:{subject}:` + revision.
  // A subject never contains ':', and ';' sorts right after ':', so the range
  // holds exactly this lineage.
  const prefix = jobKey(projectId, parsed.jobType, parsed.subject, 0).slice(0, -1);
  const upper = `${prefix.slice(0, -1)};`;
  const rows = await ctx.db.query("tasks")
    .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", ownerId).gte("jobKey", prefix).lt("jobKey", upper))
    .take(CHANGE_ROUND_LINEAGE_MAX + 1);
  if (rows.length > CHANGE_ROUND_LINEAGE_MAX) return { block: "conflict" };

  const tasks: LineageTask[] = [];
  for (const row of rows) {
    const key = row.jobKey === undefined ? null : parseJobKey(row.jobKey);
    if (
      key === null ||
      key.projectId !== projectId ||
      key.jobType !== parsed.jobType ||
      key.subject !== parsed.subject ||
      row.projectId !== projectId ||
      row.type !== parsed.jobType
    ) {
      // A row under this artifact's key that is not cleanly part of it.
      return { block: "conflict" };
    }
    // Archived tasks still count: archiving cannot hand a round back.
    tasks.push({ id: row._id, status: row.status, revision: key.revision });
  }

  return {
    lineage: {
      ownerId,
      projectId,
      jobType: parsed.jobType,
      subject: parsed.subject,
      reviewedTask,
      revisedDocumentId: document._id,
    },
    tasks,
  };
}

/**
 * Where the reviewed artifact stands and what its next round costs. Read-only.
 * `ctx` is a query or mutation context; call it in the same mutation that acts
 * on the answer so the read and the write are one transaction.
 */
export async function resolveChangeRound(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  subjectTable: string,
  subjectId: string,
): Promise<ChangeRoundResolution> {
  const read = await readLineage(ctx, ownerId, projectId, subjectTable, subjectId);
  if ("block" in read) return { ok: false, reason: read.block };
  const position = nextChangeRound(read.tasks, read.lineage.reviewedTask._id);
  if (position.state !== "ready") return { ok: false, reason: position.state };
  const plan = await resolvePlan(ctx, ownerId);
  const decision = decideChangeRound({ jobType: read.lineage.jobType, changeRound: position.changeRound, plan });
  return { ok: true, lineage: read.lineage, decision };
}

// ---------------------------------------------------------------------------
// The revision job
// ---------------------------------------------------------------------------

export type RevisionTaskInput = {
  readonly lineage: ArtifactLineage;
  readonly changeRound: number;
  /** 0 for a free round; the C-JOBS price for a paid one. */
  readonly creditCost: bigint;
  /**
   * Free round: the `artifact_review` card that holds the founder's note.
   * Paid round: the approved `spend` card the debit checked.
   */
  readonly approvalId: Id<"approvals">;
  readonly now: number;
};

function revisionTitle(jobType: JobType, changeRound: number): string {
  const name = jobType.replace(/^crew_/, "").replace(/_/g, " ");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}, change round ${changeRound}`;
}

/**
 * Inserts the queued revision job for one round. Callers must have just
 * resolved the round in the same mutation (`resolveChangeRound` returned it as
 * the next round), so the job key is new for live work. The founder's note is
 * not copied: the generator reads it from the `changes_requested`
 * `artifact_review` card on the revised subject, as quoted founder data inside
 * the prompt's data block, never as instructions.
 */
export async function insertRevisionTask(ctx: MutationCtx, input: RevisionTaskInput): Promise<Id<"tasks">> {
  const { lineage, changeRound, creditCost, approvalId, now } = input;
  if (!isRevisableJobType(lineage.jobType) || !Number.isSafeInteger(changeRound) || changeRound < 1 || creditCost < 0n) {
    throw new ConvexError({ code: "CHANGE_ROUND_INVALID_INPUT" });
  }
  const key = jobKey(lineage.projectId, lineage.jobType, lineage.subject, changeRound);
  return await ctx.db.insert("tasks", {
    ownerId: lineage.ownerId,
    projectId: lineage.projectId,
    type: lineage.jobType,
    status: "queued",
    title: revisionTitle(lineage.jobType, changeRound),
    ...(lineage.reviewedTask.employeeKey === undefined ? {} : { employeeKey: lineage.reviewedTask.employeeKey }),
    creditCost,
    changeRound: BigInt(changeRound),
    revisionOfTaskId: lineage.reviewedTask._id,
    approvalId,
    jobKey: key,
    idempotencyKey: `change-round:${approvalId}:${key}`,
    createdAt: now,
    updatedAt: now,
  });
}

// ---------------------------------------------------------------------------
// Founder-facing outcomes
// ---------------------------------------------------------------------------

export const CHANGE_ROUND_UNAVAILABLE_REASONS = [
  "price_not_set",
  "plan_gated",
  "not_revisable",
  "untracked",
  "busy",
  "stale",
  "conflict",
] as const;
export type ChangeRoundUnavailable = (typeof CHANGE_ROUND_UNAVAILABLE_REASONS)[number];

const unavailableReasonValidator = v.union(
  v.literal("price_not_set"),
  v.literal("plan_gated"),
  v.literal("not_revisable"),
  v.literal("untracked"),
  v.literal("busy"),
  v.literal("stale"),
  v.literal("conflict"),
);

/**
 * What an "Ask for changes" did. `not_available` leaves the card pending and
 * starts nothing: `price_not_set` is the "not available yet" answer.
 */
export const changeRoundOutcomeValidator = v.union(
  v.object({ outcome: v.literal("free"), changeRound: v.number(), freeRoundsLeft: v.number(), taskId: v.id("tasks") }),
  v.object({
    outcome: v.literal("spend_required"),
    changeRound: v.number(),
    costCredits: v.number(),
    spendApprovalId: v.id("approvals"),
  }),
  v.object({ outcome: v.literal("not_available"), reason: unavailableReasonValidator, changeRound: v.optional(v.number()) }),
);

export type ChangeRoundOutcome =
  | { outcome: "free"; changeRound: number; freeRoundsLeft: number; taskId: Id<"tasks"> }
  | { outcome: "spend_required"; changeRound: number; costCredits: number; spendApprovalId: Id<"approvals"> }
  | { outcome: "not_available"; reason: ChangeRoundUnavailable; changeRound?: number };

const changeRoundPreviewValidator = v.union(
  v.object({ outcome: v.literal("free"), changeRound: v.number(), freeRoundsLeft: v.number() }),
  v.object({ outcome: v.literal("spend_required"), changeRound: v.number(), costCredits: v.number() }),
  v.object({ outcome: v.literal("not_available"), reason: unavailableReasonValidator, changeRound: v.optional(v.number()) }),
);

/**
 * What "Ask for changes" on this `artifact_review` card would be, so the card
 * and Wren can say which round it is and what it costs before the founder
 * clicks (D17). Owner-only, dormant behind `workspace`; reads only.
 */
export const previewChangeRound = query({
  args: { projectId: v.id("projects"), approvalId: v.id("approvals") },
  returns: changeRoundPreviewValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const card = await ctx.db.get("approvals", args.approvalId);
    if (
      card === null ||
      card.projectId !== project._id ||
      card.ownerId !== project.ownerId ||
      card.kind !== "artifact_review"
    ) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    const resolution = await resolveChangeRound(ctx, card.ownerId, card.projectId, card.subjectTable, card.subjectId);
    if (!resolution.ok) return { outcome: "not_available" as const, reason: resolution.reason };
    const decision = resolution.decision;
    switch (decision.decision) {
      case "free":
        return { outcome: "free" as const, changeRound: decision.changeRound, freeRoundsLeft: decision.freeRoundsLeft };
      case "spend":
        return { outcome: "spend_required" as const, changeRound: decision.changeRound, costCredits: decision.costCredits };
      case "not_available":
        return { outcome: "not_available" as const, reason: decision.reason, changeRound: decision.changeRound };
    }
  },
});
