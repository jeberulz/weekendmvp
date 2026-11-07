import { v, type Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { ARTIFACT_KINDS, type ArtifactKind } from "../../lib/workspace/contracts/artifacts";
import {
  EMPLOYEE_ARTIFACT_KINDS,
  EMPLOYEE_CARDS_PER_DOCUMENT_MAX,
  EMPLOYEE_DELIVERABLES_MAX,
  EMPLOYEE_DOCUMENTS_PER_TASK_MAX,
  EMPLOYEE_LEDGER_SCAN_MAX,
  EMPLOYEE_RUNS_PER_TASK_MAX,
  EMPLOYEE_TASK_SCAN_MAX,
  EMPLOYEE_TASKS_MAX,
  SPECIALIST_ROLE_KEYS,
  type SpecialistRoleKey,
} from "../../lib/workspace/employees";

/**
 * WP67 employee pages — one specialist's real record for one business: their
 * crew member row, the jobs they ran (with tries, the drafts each wrote and the
 * founder's decision on them), and every draft of the artifact they own with
 * its newest review card. The page derives status, "now and next" and the
 * open reviews from the queries Team HQ already reads, so the counts agree.
 *
 * Owner only, behind C-OPS `workspace` (the `pendingReviews` guard; it calls no
 * model, so AI need not be on). Every row is read through a project index and
 * re-checked against the project's owner, so another owner's or another
 * business's rows can never appear. Every list is bounded (`lib/workspace/employees.ts`).
 * No ids, no raw error codes, no model or token data. Queries never read the clock.
 */

const roleKeyValidator = v.union(...SPECIALIST_ROLE_KEYS.map((key) => v.literal(key)));

const decisionValidator = v.object({
  status: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("changes_requested"),
    v.literal("expired"),
    v.literal("cancelled"),
  ),
  changeRound: v.int64(),
  /** The founder's own change note, shown back to them. */
  note: v.optional(v.string()),
  createdAt: v.number(),
  decidedAt: v.optional(v.number()),
});

const taskEntryValidator = v.object({
  title: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("blocked"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("cancelled"),
  ),
  changeRound: v.int64(),
  /** A revision asked for by a change request. */
  revision: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  /** Runs (tries) started for the job, at most `EMPLOYEE_RUNS_PER_TASK_MAX`. */
  attempts: v.number(),
  /** Of those, the ones that failed. */
  failedAttempts: v.number(),
  /** Credits the job was priced at (0 for every launch job in L1). */
  creditCost: v.int64(),
  /** Credits charged and refunded on the ledger for this job; only read when `creditCost` > 0. */
  charged: v.int64(),
  refunded: v.int64(),
  /** Drafts this job wrote. */
  drafts: v.array(v.object({ kind: v.string(), title: v.string(), createdAt: v.number() })),
  /** The founder's decisions on those drafts, newest first. */
  decisions: v.array(decisionValidator),
});

const deliverableValidator = v.object({
  kind: v.union(...ARTIFACT_KINDS.map((kind) => v.literal(kind))),
  title: v.string(),
  createdAt: v.number(),
  /** The newest review card on this draft, or null when it never had one. */
  review: v.union(v.null(), decisionValidator),
});

export const employeeActivityValidator = v.object({
  /** The roster's row for this role on this business; null until the team is written. */
  member: v.union(
    v.null(),
    v.object({
      status: v.union(v.literal("queued"), v.literal("working"), v.literal("needs_you"), v.literal("done"), v.literal("skipped")),
      hiredBy: v.union(v.literal("rule"), v.literal("founder")),
      hiredAt: v.number(),
    }),
  ),
  tasks: v.array(taskEntryValidator),
  /** True when the trail may be missing older jobs (the scan or the per-employee cap was reached). */
  tasksTruncated: v.boolean(),
  deliverables: v.array(deliverableValidator),
  deliverablesTruncated: v.boolean(),
});

export type EmployeeActivity = Infer<typeof employeeActivityValidator>;
type Decision = Infer<typeof decisionValidator>;

function decisionOf(card: Doc<"approvals">): Decision {
  return {
    status: card.status,
    changeRound: card.changeRound,
    ...(card.note === undefined ? {} : { note: card.note }),
    createdAt: card.createdAt,
    ...(card.decidedAt === undefined ? {} : { decidedAt: card.decidedAt }),
  };
}

/** This business's review cards on one document, newest first. */
async function reviewCards(ctx: QueryCtx, project: Doc<"projects">, documentId: Id<"documents">): Promise<Doc<"approvals">[]> {
  const cards = await ctx.db.query("approvals")
    .withIndex("by_subjectId", (q) => q.eq("subjectId", documentId))
    .order("desc")
    .take(EMPLOYEE_CARDS_PER_DOCUMENT_MAX);
  return cards.filter((card) =>
    card.ownerId === project.ownerId && card.projectId === project._id &&
    card.kind === "artifact_review" && card.subjectTable === "documents");
}

function isOwnLiveDocument(document: Doc<"documents">, project: Doc<"projects">): boolean {
  return document.ownerId === project.ownerId && document.projectId === project._id && document.archivedAt === undefined;
}

/** Credits charged and refunded per costed task, from the owner's newest ledger rows. */
async function ledgerByTask(
  ctx: QueryCtx,
  project: Doc<"projects">,
  taskIds: ReadonlySet<Id<"tasks">>,
): Promise<Map<Id<"tasks">, { charged: bigint; refunded: bigint }>> {
  const totals = new Map<Id<"tasks">, { charged: bigint; refunded: bigint }>();
  if (taskIds.size === 0) return totals;
  const account = await ctx.db.query("credit_accounts")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", project.ownerId))
    .unique();
  if (account === null) return totals;
  const rows = await ctx.db.query("credit_ledger")
    .withIndex("by_accountId_and_createdAt", (q) => q.eq("accountId", account._id))
    .order("desc")
    .take(EMPLOYEE_LEDGER_SCAN_MAX);
  for (const row of rows) {
    if (row.ownerId !== project.ownerId || row.taskId === undefined || !taskIds.has(row.taskId)) continue;
    const entry = totals.get(row.taskId) ?? { charged: 0n, refunded: 0n };
    if (row.reason === "task_debit") entry.charged += -row.delta;
    if (row.reason === "task_refund") entry.refunded += row.delta;
    totals.set(row.taskId, entry);
  }
  return totals;
}

async function readTasks(ctx: QueryCtx, project: Doc<"projects">, roleKey: SpecialistRoleKey) {
  const scanned = await ctx.db.query("tasks")
    .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", project._id))
    .order("desc")
    .take(EMPLOYEE_TASK_SCAN_MAX);
  const mine = scanned.filter((task) =>
    task.ownerId === project.ownerId && task.employeeKey === roleKey && task.archivedAt === undefined);
  const kept = mine.slice(0, EMPLOYEE_TASKS_MAX);
  const truncated = mine.length > EMPLOYEE_TASKS_MAX || scanned.length === EMPLOYEE_TASK_SCAN_MAX;

  const costed = new Set(kept.filter((task) => (task.creditCost ?? 0n) > 0n).map((task) => task._id));
  const ledger = await ledgerByTask(ctx, project, costed);

  const tasks = [];
  for (const task of kept) {
    const runs = (await ctx.db.query("workflow_runs")
      .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", task._id))
      .take(EMPLOYEE_RUNS_PER_TASK_MAX))
      .filter((run) => run.ownerId === project.ownerId && run.projectId === project._id);
    const documents = (await ctx.db.query("documents")
      .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", task._id))
      .take(EMPLOYEE_DOCUMENTS_PER_TASK_MAX))
      .filter((document) => isOwnLiveDocument(document, project));
    const decisions: Decision[] = [];
    for (const document of documents) {
      for (const card of await reviewCards(ctx, project, document._id)) decisions.push(decisionOf(card));
    }
    decisions.sort((a, b) => b.createdAt - a.createdAt);
    const money = ledger.get(task._id) ?? { charged: 0n, refunded: 0n };
    tasks.push({
      title: task.title,
      status: task.status,
      changeRound: task.changeRound ?? 0n,
      revision: task.revisionOfTaskId !== undefined || (task.changeRound ?? 0n) > 0n,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      attempts: runs.length,
      failedAttempts: runs.filter((run) => run.status === "failed").length,
      creditCost: task.creditCost ?? 0n,
      charged: money.charged,
      refunded: money.refunded,
      drafts: documents.map((document) => ({ kind: document.kind, title: document.title, createdAt: document.createdAt })),
      decisions,
    });
  }
  return { tasks, truncated };
}

async function readDeliverables(ctx: QueryCtx, project: Doc<"projects">, kinds: readonly ArtifactKind[]) {
  const deliverables = [];
  let truncated = false;
  for (const kind of kinds) {
    const rows = await ctx.db.query("documents")
      .withIndex("by_projectId_and_kind_and_updatedAt", (q) => q.eq("projectId", project._id).eq("kind", kind))
      .order("desc")
      .take(EMPLOYEE_DELIVERABLES_MAX);
    if (rows.length === EMPLOYEE_DELIVERABLES_MAX) truncated = true;
    for (const document of rows) {
      if (!isOwnLiveDocument(document, project)) continue;
      const [newest] = await reviewCards(ctx, project, document._id);
      deliverables.push({
        kind,
        title: document.title,
        createdAt: document.createdAt,
        review: newest === undefined ? null : decisionOf(newest),
      });
    }
  }
  deliverables.sort((a, b) => b.createdAt - a.createdAt);
  return { deliverables, truncated };
}

export const employeeActivity = query({
  args: { projectId: v.id("projects"), roleKey: roleKeyValidator },
  returns: employeeActivityValidator,
  handler: async (ctx, args): Promise<EmployeeActivity> => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const member = await ctx.db.query("crew_members")
      .withIndex("by_projectId_and_roleKey", (q) => q.eq("projectId", project._id).eq("roleKey", args.roleKey))
      .order("desc")
      .first();
    const ownMember = member !== null && member.ownerId === project.ownerId ? member : null;
    const { tasks, truncated: tasksTruncated } = await readTasks(ctx, project, args.roleKey);
    const { deliverables, truncated: deliverablesTruncated } = await readDeliverables(
      ctx,
      project,
      EMPLOYEE_ARTIFACT_KINDS[args.roleKey],
    );
    return {
      member: ownMember === null
        ? null
        : { status: ownMember.status, hiredBy: ownMember.hiredBy, hiredAt: ownMember.createdAt },
      tasks,
      tasksTruncated,
      deliverables,
      deliverablesTruncated,
    };
  },
});
