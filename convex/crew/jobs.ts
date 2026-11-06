import { ConvexError, v, type Infer, type ObjectType } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { assertFeatureEnabledForOwner } from "../ops/settings";
import { requireBusinessForOwner } from "../platform/authz";
import { checkLimit } from "../platform/limits";
import { assertTaskTransition } from "../platform/transitions";
import { assertGeneratedDocumentBody } from "../platform/validators";
import { createApprovalRecord } from "../workspace/approvals";
import { revisionNoteFor } from "../workspace/changeRounds";
import type { LineageTask } from "../../lib/workspace/changeRounds";
import { parseArtifact, parseModelOutput } from "../../lib/workspace/contracts/artifacts";
import { JOB_SUBJECT_MAIN, jobKey, parseJobKey } from "../../lib/workspace/contracts/jobs";
import { parsePromptRef } from "../../lib/workspace/contracts/prompts";
import {
  FAILED_STEP_ARCHIVED_REASON,
  FAILED_STEP_REASON,
  FAILED_STEP_REFUNDED_REASON,
  MAX_INDETERMINATE_RETRIES,
  MAX_RETRYABLE_RETRIES,
  UNKNOWN_OUTCOME_ATTEMPT_STRIDE,
  classifyGatewayFailure,
  isParkingMeterCode,
  parkedReason,
  retryDecision,
  spendsRetryBudget,
  type ParkingMeterCode,
  type RetryClass,
} from "../../lib/workspace/crew/retry";
import {
  CREW_STEP_ARTIFACTS,
  crewDocumentTitle,
  isCrewStepJobType,
  planFirstDraft,
  type CrewStepJobType,
} from "../../lib/workspace/crew/tasks";

/**
 * WP75-S2a — crew task lifecycle (C-JOBS), all internal. Callers authorise the
 * founder first (`02` §14): S1's `startLaunch` and S2b's launch DAG insert first
 * drafts; WP77's `decideApproval` / paid-round debit site insert revisions.
 * Owner ids come from those callers or from the task row, never from a client.
 *
 * - `insertCrewTask` / `createCrewTask`: the queued task for an artifact's
 *   FIRST draft (round 0) only. Revisions are inserted by WP77's
 *   `insertRevisionTask` (after "Ask for changes" moved the reviewed card to
 *   `changes_requested`, or after a paid round's debit), never here. Live work
 *   under the same key is returned, not duplicated. Gates: the owner's
 *   `workspace` feature, the business, then one `checkLimit(ctx, "crewJob",
 *   owner)` per inserted task (which asserts the `ai` feature). The limit's
 *   per-step semantics are still open (progress Stop-and-ask 10, Needs 9).
 * - `startCrewRun`: one `workflow_runs` row per execution of a task
 *   (`run:{taskId}:{n}`). Reads everything the call needs from the server: the
 *   first attempt number (one past every number used under the job key), the
 *   task's debit (`task-debit:{taskId}`), and for a revision the revised draft
 *   and the founder's note (`revisionNoteFor`, the card's note). A parked task
 *   starts only with `resume: true` (blocked → running).
 * - `finishCrewStep`: the success transaction: document, task, run, the
 *   `artifact_review` card and the crew statuses, together.
 * - `settleCrewRun`: every other outcome: stores `nextAttempt` and the retry
 *   class, then retries (scheduled), fails (refund only with a debit, and only
 *   when the refund can run), parks or closes, per `lib/workspace/crew/retry.ts`.
 * - `recoverStaleCrewRuns`: settles runs left `running` past the lease (an
 *   action that died) as indeterminate, bounded and paginated. It needs a cron
 *   (Codex's file; progress Needs). Until then S2b's workpool `onComplete`
 *   re-invokes the step, and `startCrewRun` closes a stale run itself.
 *
 * Every task status write goes through `assertTaskTransition`
 * (`convex/platform/transitions.ts`).
 */

// ---------------------------------------------------------------------------
// Limits and shared validators
// ---------------------------------------------------------------------------

/** Most tasks one artifact lineage (or one job key) may hold before inserts fail closed. */
export const CREW_LINEAGE_MAX = 200;

/**
 * The retry budget backstop at start: runs whose class spends it
 * (`retryable_unbilled`, `indeterminate`). Parked, closed and permanent runs
 * never count, so park/resume cycles cannot exhaust a task. The per-class
 * limits in `retryDecision` end a task first; this only catches runs closed
 * outside a settle (abandoned runs).
 */
export const MAX_RETRY_BUDGET_RUNS = MAX_RETRYABLE_RETRIES + MAX_INDETERMINATE_RETRIES + 1;

/** Most runs read for one task. A task with more fails closed instead of being read in part. */
export const RUN_SCAN_MAX = 100;

/**
 * A run still `running` after this long was abandoned (its action died): no
 * Convex action outlives 10 minutes. Until then a second start is refused.
 */
export const RUN_LEASE_MS = 11 * 60 * 1_000;

/** Document ids kept on a workstream (newest last). */
export const WORKSTREAM_DOCUMENT_IDS_MAX = 100;

/** Most `ai_usage` rows read for one job key. More fails closed (attempts are bounded far below this). */
const USAGE_SCAN_MAX = 500;

/** The largest attempt number handed out; beyond it the key fails closed. */
export const MAX_ATTEMPT = 1_000_000;

/** Stale runs settled per `recoverStaleCrewRuns` page. */
export const RECOVERY_PAGE_MAX = 50;

/** A prompt input value, as `runPrompt` accepts it. */
export const crewPromptInputValue = v.union(v.string(), v.number(), v.boolean(), v.null(), v.array(v.string()));

/** `runCrewStep`'s arguments. Kept here so `settleCrewRun` can schedule the retry with them. */
export const runCrewStepArgs = {
  taskId: v.id("tasks"),
  /** A registered `id@version`; the gateway resolves the spec (never a spec or model from the caller). */
  promptRef: v.string(),
  inputs: v.record(v.string(), crewPromptInputValue),
  /** The per-business context block (`02` §5.4), for `per_business` specs. */
  businessContext: v.optional(v.string()),
  timeoutMs: v.optional(v.number()),
  /** Start a parked (`blocked`) task: the founder's resume or the next launch tick. Never set on automatic retries' behalf. */
  resume: v.optional(v.boolean()),
  /**
   * `schedule` (default): a retry is scheduled by `settleCrewRun` itself.
   * `return`: the retry delay is returned and the caller re-enqueues (S2b's
   * workpool `onComplete`), so retries stay on the pool.
   */
  retryMode: v.optional(v.union(v.literal("schedule"), v.literal("return"))),
};

export type RunCrewStepArgs = ObjectType<typeof runCrewStepArgs>;

export const crewStepJobTypeValidator = v.union(
  v.literal("crew_blueprint"),
  v.literal("crew_brand_kit"),
  v.literal("crew_landing"),
  v.literal("crew_email_sequence"),
  v.literal("crew_social_pack"),
  v.literal("crew_seo_pack"),
  v.literal("crew_launch_plan"),
  v.literal("crew_ads_drafts"),
  v.literal("crew_build_pack"),
);

export const retryClassValidator = v.union(
  v.literal("retryable_unbilled"),
  v.literal("indeterminate"),
  v.literal("permanent"),
  v.literal("parked"),
  v.literal("closed"),
);

const billedValidator = v.union(v.literal("none"), v.literal("possible"), v.literal("actual"));

/**
 * A gateway run's failure, as `runPrompt` returns it (`gatewayRunResultValidator`
 * in `convex/ai/gatewayActions.ts`, a `"use node"` file this runtime may not
 * import). Codes and providers are strings here; the classifier decides.
 */
export const crewGatewayFailureValidator = v.union(
  v.object({ kind: v.literal("config"), message: v.string() }),
  v.object({
    kind: v.literal("meter_refused"),
    error: v.object({ code: v.string(), scope: v.optional(v.string()), message: v.optional(v.string()) }),
  }),
  v.object({
    kind: v.literal("duplicate_attempt"),
    attemptKey: v.string(),
    usageId: v.optional(v.string()),
    reason: v.optional(v.literal("key_reused_for_different_call")),
    message: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("refusal"),
    provider: v.string(),
    category: v.union(v.string(), v.null()),
    explanation: v.union(v.string(), v.null()),
  }),
  v.object({ kind: v.literal("schema_invalid"), issues: v.array(v.string()) }),
  v.object({
    kind: v.literal("provider"),
    provider: v.string(),
    providerKind: v.string(),
    errorClass: v.string(),
    billed: billedValidator,
    retryable: v.boolean(),
    message: v.string(),
  }),
  v.object({ kind: v.literal("internal"), message: v.string(), usageId: v.optional(v.string()) }),
);

export type CrewGatewayFailureArg = Infer<typeof crewGatewayFailureValidator>;

function refuse(code: string): never {
  throw new ConvexError({ code });
}

function errorCodeOf(error: unknown): string | null {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data) {
    const code: unknown = (error.data as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

type TaskStatus = Doc<"tasks">["status"];

const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ["succeeded", "failed", "cancelled"];

function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type Ctx = Pick<MutationCtx, "db">;

/** Every task under an artifact's key prefix (`crew:{projectId}:{type}:{subject}:`). */
async function readLineage(
  ctx: Ctx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  jobType: CrewStepJobType,
  subject: string,
): Promise<{ rows: Doc<"tasks">[]; lineage: LineageTask[] }> {
  const prefix = jobKey(projectId, jobType, subject, 0).slice(0, -1);
  // A subject never contains ':', and ';' sorts right after ':', so the range is exactly this lineage.
  const upper = `${prefix.slice(0, -1)};`;
  const rows = await ctx.db.query("tasks")
    .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", ownerId).gte("jobKey", prefix).lt("jobKey", upper))
    .take(CREW_LINEAGE_MAX + 1);
  if (rows.length > CREW_LINEAGE_MAX) refuse("CREW_TASK_CONFLICT");
  const lineage = rows.map((row): LineageTask => {
    const key = row.jobKey === undefined ? null : parseJobKey(row.jobKey);
    if (key === null || key.projectId !== projectId || key.jobType !== jobType || key.subject !== subject ||
      row.projectId !== projectId || row.type !== jobType) {
      refuse("CREW_TASK_CONFLICT");
    }
    return { id: row._id, status: row.status, revision: key.revision };
  });
  return { rows, lineage };
}

/** The task's runs, newest first, at most `RUN_SCAN_MAX + 1` (the caller fails closed past the cap). */
async function runsOf(ctx: Ctx, taskId: Id<"tasks">): Promise<Doc<"workflow_runs">[]> {
  return await ctx.db.query("workflow_runs")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", taskId))
    .order("desc")
    .take(RUN_SCAN_MAX + 1);
}

/** A positive attempt number parsed from an attempt key's suffix, or null. */
function attemptSuffix(attemptKey: string, prefix: string): number | null {
  if (!attemptKey.startsWith(prefix)) return null;
  const suffix = attemptKey.slice(prefix.length);
  if (!/^[1-9][0-9]{0,15}$/.test(suffix)) return null;
  const value = Number(suffix);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * The first attempt number a new execution of this job key may use: one past
 * every number already used by any task that held the key. A finished run
 * stores the gateway's `nextAttempt`; a run still marked `running` may have
 * used two numbers from its stored start, so it counts as start + 2. The
 * `ai_usage` rows under the key are read too, each suffix parsed as a number
 * (never compared as text), so a number the meter saw is never handed out
 * again. Fails closed past the scan caps or `MAX_ATTEMPT`.
 */
export async function nextAttemptForJobKey(ctx: Ctx, ownerId: Id<"users">, key: string): Promise<number> {
  let next = 1;
  const holders = await ctx.db.query("tasks")
    .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", ownerId).eq("jobKey", key))
    .take(CREW_LINEAGE_MAX + 1);
  if (holders.length > CREW_LINEAGE_MAX) refuse("CREW_ATTEMPTS_EXHAUSTED");
  for (const holder of holders) {
    const runs = await runsOf(ctx, holder._id);
    if (runs.length > RUN_SCAN_MAX) refuse("CREW_ATTEMPTS_EXHAUSTED");
    for (const run of runs) {
      const stored = Number(run.attempt);
      next = Math.max(next, run.status === "running" ? stored + UNKNOWN_OUTCOME_ATTEMPT_STRIDE : stored);
    }
  }
  const prefix = `${key}:`;
  const usage = await ctx.db.query("ai_usage")
    .withIndex("by_attemptKey", (q) => q.gte("attemptKey", prefix).lt("attemptKey", `${key};`))
    .take(USAGE_SCAN_MAX + 1);
  if (usage.length > USAGE_SCAN_MAX) refuse("CREW_ATTEMPTS_EXHAUSTED");
  for (const row of usage) {
    const used = attemptSuffix(row.attemptKey, prefix);
    if (used !== null) next = Math.max(next, used + 1);
  }
  if (!Number.isSafeInteger(next) || next > MAX_ATTEMPT) refuse("CREW_ATTEMPTS_EXHAUSTED");
  return next;
}

/** The task's employee (by role key) and that employee's workstream, when the roster has them. */
async function crewOf(
  ctx: Ctx,
  task: Doc<"tasks">,
): Promise<{ member: Doc<"crew_members"> | null; workstream: Doc<"workstreams"> | null }> {
  if (task.employeeKey === undefined) return { member: null, workstream: null };
  const roleKey = task.employeeKey;
  const members = await ctx.db.query("crew_members")
    .withIndex("by_projectId_and_roleKey", (q) => q.eq("projectId", task.projectId).eq("roleKey", roleKey))
    .take(4);
  const member = members.find((row) => row.ownerId === task.ownerId && row.status !== "skipped") ?? null;
  if (member === null) return { member: null, workstream: null };
  const workstream = await ctx.db.query("workstreams")
    .withIndex("by_projectId_and_employeeId", (q) => q.eq("projectId", task.projectId).eq("employeeId", member._id))
    .first();
  return { member, workstream: workstream !== null && workstream.ownerId === task.ownerId ? workstream : null };
}

type CrewStatus = {
  readonly member?: Doc<"crew_members">["status"];
  readonly workstream?: string;
  /** `null` clears the blocker. */
  readonly blocker?: string | null;
  readonly addDocumentId?: Id<"documents">;
  readonly askApprovalId?: Id<"approvals">;
};

async function setCrewStatus(ctx: MutationCtx, task: Doc<"tasks">, status: CrewStatus, now: number): Promise<void> {
  const { member, workstream } = await crewOf(ctx, task);
  if (member !== null && status.member !== undefined && member.status !== status.member) {
    await ctx.db.patch("crew_members", member._id, { status: status.member, updatedAt: now });
  }
  if (workstream === null) return;
  const documentIds = status.addDocumentId === undefined
    ? undefined
    : [...workstream.documentIds.filter((id) => id !== status.addDocumentId), status.addDocumentId].slice(-WORKSTREAM_DOCUMENT_IDS_MAX);
  await ctx.db.patch("workstreams", workstream._id, {
    ...(status.workstream === undefined ? {} : { status: status.workstream }),
    ...(status.blocker === undefined ? {} : { blocker: status.blocker ?? undefined }),
    ...(documentIds === undefined ? {} : { documentIds }),
    ...(status.askApprovalId === undefined ? {} : { askApprovalId: status.askApprovalId }),
    updatedAt: now,
  });
}

/** The newest document the revised task wrote, when this task is a revision. */
async function revisedDocument(ctx: Ctx, task: Doc<"tasks">, kind: string): Promise<Doc<"documents"> | null> {
  if (task.revisionOfTaskId === undefined) return null;
  const revisedTaskId = task.revisionOfTaskId;
  const document = await ctx.db.query("documents")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", revisedTaskId))
    .order("desc")
    .first();
  return document !== null && document.ownerId === task.ownerId && document.projectId === task.projectId &&
    document.kind === kind && document.archivedAt === undefined ? document : null;
}

/** The task's live credit debit (WP73 ledger: `task-debit:{taskId}`), read on the server. */
async function debitOf(ctx: Ctx, task: Doc<"tasks">): Promise<Doc<"credit_ledger"> | null> {
  const debit = await ctx.db.query("credit_ledger")
    .withIndex("by_ownerId_and_idempotencyKey", (q) => q.eq("ownerId", task.ownerId).eq("idempotencyKey", `task-debit:${task._id}`))
    .unique();
  return debit !== null && debit.reason === "task_debit" && debit.taskId === task._id &&
    debit.projectId === task.projectId && debit.delta < 0n ? debit : null;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Task insert (first drafts only)
// ---------------------------------------------------------------------------

export type CrewTaskInput = {
  readonly ownerId: Id<"users">;
  readonly projectId: Id<"projects">;
  readonly jobType: CrewStepJobType;
  /** C-JOBS subject; every WP75 artifact is `main`. */
  readonly subject?: string;
  /** The employee's role key (`crew_members.roleKey`). */
  readonly employeeKey?: string;
  readonly title?: string;
};

export type CrewTaskInsert = {
  readonly taskId: Id<"tasks">;
  readonly created: boolean;
  readonly changeRound: number;
  readonly jobKey: string;
};

/**
 * Inserts (or returns) the task for an artifact's first draft. Throws
 * `CREW_TASK_CONFLICT` when the lineage already has revisions without a live
 * first draft, and the feature gate's, business guard's or limiter's error
 * when the owner may not start work now.
 */
export async function insertCrewTask(ctx: MutationCtx, input: CrewTaskInput): Promise<CrewTaskInsert> {
  const subject = input.subject ?? JOB_SUBJECT_MAIN;
  await assertFeatureEnabledForOwner(ctx, "workspace", input.ownerId);
  await requireBusinessForOwner(ctx, input.projectId, input.ownerId);
  const { rows, lineage } = await readLineage(ctx, input.ownerId, input.projectId, input.jobType, subject);
  const plan = planFirstDraft(lineage);
  if (plan.kind === "refused") refuse("CREW_TASK_CONFLICT");
  if (plan.kind === "existing") {
    const existing = rows.find((row) => row._id === plan.taskId);
    if (existing === undefined || existing.jobKey === undefined) refuse("CREW_TASK_CONFLICT");
    return { taskId: existing._id, created: false, changeRound: 0, jobKey: existing.jobKey };
  }

  // C-LIMITS: one check per inserted task, in the mutation that starts the work.
  await checkLimit(ctx, "crewJob", input.ownerId);
  const key = jobKey(input.projectId, input.jobType, subject, 0);
  // A retry after failed or cancelled first drafts gets its own idempotency key.
  const idempotencyKey = plan.priorHolders === 0 ? `crew-task:${key}` : `crew-task:${key}:retry:${plan.priorHolders}`;
  const now = Date.now();
  const taskId = await ctx.db.insert("tasks", {
    ownerId: input.ownerId,
    projectId: input.projectId,
    type: input.jobType,
    status: "queued",
    title: input.title ?? crewDocumentTitle(input.jobType, 0),
    ...(input.employeeKey === undefined ? {} : { employeeKey: input.employeeKey }),
    // First drafts are free (C-JOBS): no credits, no debit.
    creditCost: 0n,
    changeRound: 0n,
    jobKey: key,
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });
  return { taskId, created: true, changeRound: 0, jobKey: key };
}

const crewTaskInsertValidator = v.object({
  taskId: v.id("tasks"),
  created: v.boolean(),
  changeRound: v.number(),
  jobKey: v.string(),
});

export const createCrewTask = internalMutation({
  args: {
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    jobType: crewStepJobTypeValidator,
    subject: v.optional(v.string()),
    employeeKey: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  returns: crewTaskInsertValidator,
  handler: async (ctx, args): Promise<CrewTaskInsert> => await insertCrewTask(ctx, args),
});

// ---------------------------------------------------------------------------
// Outcomes shared by every path
// ---------------------------------------------------------------------------

/** Every task status write: checked against the platform transition table. */
async function setTaskStatus(ctx: MutationCtx, task: Doc<"tasks">, next: TaskStatus, now: number): Promise<Doc<"tasks">> {
  assertTaskTransition(task.status, next);
  await ctx.db.patch("tasks", task._id, { status: next, updatedAt: now });
  return { ...task, status: next, updatedAt: now };
}

/**
 * Fails the task for good. The refund is scheduled (same transaction) only
 * when the task has a debit AND the refund can run: the ledger refuses an
 * archived task or business (`RESOURCE_NOT_FOUND`), so there the credits stay
 * spent and the note says so instead of promising a refund.
 */
async function failTask(ctx: MutationCtx, task: Doc<"tasks">, now: number): Promise<{ refundScheduled: boolean }> {
  const failed = await setTaskStatus(ctx, task, "failed", now);
  const debit = await debitOf(ctx, failed);
  const project = await ctx.db.get("projects", failed.projectId);
  const archived = failed.archivedAt !== undefined || project === null || project.archivedAt !== undefined;
  const refundScheduled = debit !== null && !archived;
  if (refundScheduled) {
    await ctx.scheduler.runAfter(0, internal.platform.billing.ledger.refundFailedTask, {
      taskId: failed._id,
      projectId: failed.projectId,
    });
  }
  await setCrewStatus(ctx, failed, {
    member: "needs_you",
    workstream: "failed",
    blocker: refundScheduled ? FAILED_STEP_REFUNDED_REASON : debit !== null ? FAILED_STEP_ARCHIVED_REASON : FAILED_STEP_REASON,
  }, now);
  return { refundScheduled };
}

async function parkTask(ctx: MutationCtx, task: Doc<"tasks">, code: ParkingMeterCode, now: number): Promise<void> {
  const parked = await setTaskStatus(ctx, task, "blocked", now);
  await setCrewStatus(ctx, parked, { member: "needs_you", workstream: "blocked", blocker: parkedReason(code) }, now);
}

async function closeRun(
  ctx: MutationCtx,
  run: Doc<"workflow_runs">,
  status: "succeeded" | "failed" | "cancelled",
  errorCode: RetryClass | undefined,
  nextAttempt: number,
  now: number,
): Promise<void> {
  await ctx.db.patch("workflow_runs", run._id, {
    status,
    errorCode,
    // Never move backwards: a smaller reported number cannot reopen a used key.
    attempt: BigInt(Math.max(Number(run.attempt), nextAttempt)),
    completedAt: now,
    updatedAt: now,
  });
}

function validNextAttempt(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_ATTEMPT + UNKNOWN_OUTCOME_ATTEMPT_STRIDE) {
    refuse("CREW_RUN_INVALID_ATTEMPT");
  }
  return value;
}

function isStale(run: Doc<"workflow_runs">, now: number): boolean {
  return run.status === "running" && now - (run.startedAt ?? run.createdAt) >= RUN_LEASE_MS;
}

/** Closes an abandoned run: its outcome is unknown, so it may have used two attempt numbers and may have billed. */
async function closeAbandonedRun(ctx: MutationCtx, run: Doc<"workflow_runs">, now: number): Promise<void> {
  await closeRun(ctx, run, "failed", "indeterminate", Number(run.attempt) + UNKNOWN_OUTCOME_ATTEMPT_STRIDE, now);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const startSkipReason = v.union(
  v.literal("missing"),
  v.literal("not_crew_step"),
  v.literal("terminal"),
  v.literal("blocked"),
  v.literal("in_flight"),
  v.literal("exhausted"),
);

const startCrewRunResult = v.union(
  v.object({
    kind: v.literal("run"),
    runId: v.id("workflow_runs"),
    runNumber: v.number(),
    attempt: v.number(),
    jobKey: v.string(),
    jobType: crewStepJobTypeValidator,
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    changeRound: v.number(),
    /** The task's live debit, read on the server (a paid round); the meter verifies it. */
    creditDebitId: v.optional(v.id("credit_ledger")),
    /** The revised draft's stored artifact (JSON), for a revision task. */
    previousArtifactJson: v.optional(v.string()),
    /** The founder's note from the revision's card (`revisionNoteFor`); never from caller args. */
    revisionNote: v.optional(v.string()),
  }),
  v.object({ kind: v.literal("skip"), reason: startSkipReason }),
);

export type StartCrewRunResult = Infer<typeof startCrewRunResult>;

/**
 * Opens one execution of a task. A task that is terminal or already executing
 * is skipped (a replay of the same step is a no-op); a parked task is skipped
 * unless `resume` is set.
 */
export const startCrewRun = internalMutation({
  args: { taskId: v.id("tasks"), resume: v.optional(v.boolean()) },
  returns: startCrewRunResult,
  handler: async (ctx, args): Promise<StartCrewRunResult> => {
    const found = await ctx.db.get("tasks", args.taskId);
    if (found === null || found.archivedAt !== undefined) return { kind: "skip", reason: "missing" };
    const key = found.jobKey === undefined ? null : parseJobKey(found.jobKey);
    if (!isCrewStepJobType(found.type) || key === null || key.jobType !== found.type || key.projectId !== found.projectId ||
      found.jobKey === undefined) {
      return { kind: "skip", reason: "not_crew_step" };
    }
    const jobType: CrewStepJobType = found.type;
    const taskJobKey = found.jobKey;
    if (isTerminal(found.status)) return { kind: "skip", reason: "terminal" };
    if (found.status === "blocked" && args.resume !== true) return { kind: "skip", reason: "blocked" };

    const now = Date.now();
    const runs = await runsOf(ctx, found._id);
    const errorCodes: (string | undefined)[] = [];
    for (const run of runs) {
      if (run.status === "running") {
        if (!isStale(run, now)) return { kind: "skip", reason: "in_flight" };
        await closeAbandonedRun(ctx, run, now);
        errorCodes.push("indeterminate");
      } else {
        errorCodes.push(run.errorCode);
      }
    }

    // queued → running, or blocked → running on a resume.
    const task = found.status === "running" ? found : await setTaskStatus(ctx, found, "running", now);
    if (runs.length > RUN_SCAN_MAX || errorCodes.filter(spendsRetryBudget).length >= MAX_RETRY_BUDGET_RUNS) {
      await failTask(ctx, task, now);
      return { kind: "skip", reason: "exhausted" };
    }

    const attempt = await nextAttemptForJobKey(ctx, task.ownerId, taskJobKey);
    const runNumber = runs.length + 1;
    const runId = await ctx.db.insert("workflow_runs", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      type: jobType,
      status: "running",
      idempotencyKey: `run:${task._id}:${runNumber}`,
      attempt: BigInt(attempt),
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    });
    await setCrewStatus(ctx, task, { member: "working", workstream: "working", blocker: null }, now);

    const previous = await revisedDocument(ctx, task, CREW_STEP_ARTIFACTS[jobType].kind);
    const note = task.revisionOfTaskId === undefined ? null : await revisionNoteFor(ctx, task._id);
    const debit = await debitOf(ctx, task);
    return {
      kind: "run",
      runId,
      runNumber,
      attempt,
      jobKey: taskJobKey,
      jobType,
      ownerId: task.ownerId,
      projectId: task.projectId,
      changeRound: Number(task.changeRound ?? 0n),
      ...(debit === null ? {} : { creditDebitId: debit._id }),
      ...(previous?.body === undefined ? {} : { previousArtifactJson: previous.body }),
      ...(note === null ? {} : { revisionNote: note }),
    };
  },
});

/** The run and its task, when the run is still open. */
async function openRun(
  ctx: Ctx,
  runId: Id<"workflow_runs">,
): Promise<{ run: Doc<"workflow_runs">; task: Doc<"tasks">; jobType: CrewStepJobType } | null> {
  const run = await ctx.db.get("workflow_runs", runId);
  if (run === null || run.status !== "running" || run.taskId === undefined) return null;
  const task = await ctx.db.get("tasks", run.taskId);
  if (task === null || !isCrewStepJobType(task.type) || task.ownerId !== run.ownerId) return null;
  return { run, task, jobType: task.type };
}

// ---------------------------------------------------------------------------
// Finish (success)
// ---------------------------------------------------------------------------

export const finishCrewStepResult = v.union(
  v.object({ kind: v.literal("finished"), documentId: v.id("documents"), approvalId: v.id("approvals") }),
  v.object({ kind: v.literal("failed"), refundScheduled: v.boolean() }),
  v.object({ kind: v.literal("parked") }),
  v.object({ kind: v.literal("stale") }),
);

export type FinishCrewStepResult = Infer<typeof finishCrewStepResult>;

/**
 * The success transaction of one step: document, task, run, `artifact_review`
 * card, employee and workstream, together. An output that passed the prompt's
 * schema but fails the C-ART artifact schema fails the task (permanent); a
 * workspace switched off since the call parks it.
 */
export const finishCrewStep = internalMutation({
  args: {
    runId: v.id("workflow_runs"),
    promptRef: v.string(),
    outputJson: v.string(),
    nextAttempt: v.number(),
  },
  returns: finishCrewStepResult,
  handler: async (ctx, args): Promise<FinishCrewStepResult> => {
    const nextAttempt = validNextAttempt(args.nextAttempt);
    if (parsePromptRef(args.promptRef) === null) refuse("CREW_RUN_INVALID_PROMPT_REF");
    const open = await openRun(ctx, args.runId);
    if (open === null) return { kind: "stale" };
    const { run, task, jobType } = open;
    const now = Date.now();
    if (task.status !== "running") {
      await closeRun(ctx, run, "cancelled", "closed", nextAttempt, now);
      return { kind: "stale" };
    }

    // The card needs the workspace on and the business live; check before any write.
    try {
      await assertFeatureEnabledForOwner(ctx, "workspace", task.ownerId);
      await requireBusinessForOwner(ctx, task.projectId, task.ownerId);
    } catch (error) {
      const code = errorCodeOf(error);
      if (isParkingMeterCode(code)) {
        await closeRun(ctx, run, "failed", "parked", nextAttempt, now);
        await parkTask(ctx, task, code, now);
        return { kind: "parked" };
      }
      await closeRun(ctx, run, "failed", "permanent", nextAttempt, now);
      return { kind: "failed", ...(await failTask(ctx, task, now)) };
    }

    const { kind } = CREW_STEP_ARTIFACTS[jobType];
    const previous = await revisedDocument(ctx, task, kind);
    let body: string | null = null;
    try {
      const raw: unknown = JSON.parse(args.outputJson);
      // The revised draft, re-validated: a LandingSpec revision keeps the stored proof slots.
      const stored = previous?.body === undefined ? null : parseArtifact(kind, JSON.parse(previous.body));
      const parsed = parseModelOutput(kind, raw, stored?.success === true ? stored.data : null);
      if (parsed.success) body = assertGeneratedDocumentBody(JSON.stringify(parsed.data));
    } catch {
      body = null;
    }
    if (body === null) {
      await closeRun(ctx, run, "failed", "permanent", nextAttempt, now);
      return { kind: "failed", ...(await failTask(ctx, task, now)) };
    }

    const documentId = await ctx.db.insert("documents", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      kind,
      format: "json",
      title: crewDocumentTitle(jobType, Number(task.changeRound ?? 0n)),
      ...(previous === null ? {} : { supersedesDocumentId: previous._id }),
      schemaVersion: "1",
      promptRef: args.promptRef,
      body,
      contentSha256: await sha256Hex(body),
      createdAt: now,
      updatedAt: now,
    });
    const succeeded = await setTaskStatus(ctx, task, "succeeded", now);
    await closeRun(ctx, run, "succeeded", undefined, nextAttempt, now);
    const { approvalId } = await createApprovalRecord(ctx, {
      ownerId: task.ownerId,
      projectId: task.projectId,
      kind: "artifact_review",
      subjectTable: "documents",
      subjectId: documentId,
      changeRound: task.changeRound ?? 0n,
    });
    await setCrewStatus(ctx, succeeded, {
      member: "needs_you",
      workstream: "needs_review",
      blocker: null,
      addDocumentId: documentId,
      askApprovalId: approvalId,
    }, now);
    return { kind: "finished", documentId, approvalId };
  },
});

// ---------------------------------------------------------------------------
// Settle (every other outcome)
// ---------------------------------------------------------------------------

export const settleCrewRunResult = v.union(
  v.object({ kind: v.literal("retry"), retryClass: retryClassValidator, delayMs: v.number(), scheduled: v.boolean() }),
  v.object({ kind: v.literal("failed"), retryClass: retryClassValidator, exhausted: v.boolean(), refundScheduled: v.boolean() }),
  v.object({ kind: v.literal("parked"), retryClass: retryClassValidator }),
  v.object({ kind: v.literal("closed"), retryClass: retryClassValidator }),
  v.object({ kind: v.literal("stale") }),
);

export type SettleCrewRunResult = Infer<typeof settleCrewRunResult>;

/**
 * Records a failed execution: the gateway's `nextAttempt` (so the next
 * execution never reuses `{jobKey}:{attempt}`), the retry class in
 * `errorCode`, and what the class decides. A retry is scheduled in this same
 * transaction unless `retry` is absent (the caller re-enqueues).
 */
export const settleCrewRun = internalMutation({
  args: {
    runId: v.id("workflow_runs"),
    failure: crewGatewayFailureValidator,
    nextAttempt: v.number(),
    retry: v.optional(v.object(runCrewStepArgs)),
  },
  returns: settleCrewRunResult,
  handler: async (ctx, args): Promise<SettleCrewRunResult> => {
    const nextAttempt = validNextAttempt(args.nextAttempt);
    const open = await openRun(ctx, args.runId);
    if (open === null) return { kind: "stale" };
    const { run, task } = open;
    if (args.retry !== undefined && args.retry.taskId !== task._id) refuse("CREW_RUN_TASK_MISMATCH");
    const now = Date.now();
    const terminal = isTerminal(task.status);
    const retryClass = classifyGatewayFailure(args.failure, { taskTerminal: terminal });
    const earlier = (await runsOf(ctx, task._id)).filter((row) => row._id !== run._id).map((row) => row.errorCode);
    const decision = retryDecision(retryClass, earlier);

    // A task closed meanwhile (cancelled, say) is never retried, failed or parked from here.
    if (decision.action === "close" || task.status !== "running") {
      await closeRun(ctx, run, "cancelled", "closed", nextAttempt, now);
      return { kind: "closed", retryClass: "closed" };
    }
    await closeRun(ctx, run, "failed", retryClass, nextAttempt, now);
    switch (decision.action) {
      case "retry": {
        await ctx.db.patch("tasks", task._id, { updatedAt: now });
        if (args.retry !== undefined) {
          // A retry never resumes a parked task on its own.
          const retry: RunCrewStepArgs = { ...args.retry };
          delete retry.resume;
          await ctx.scheduler.runAfter(decision.delayMs, internal.crew.runner.runCrewStep, retry);
        }
        return { kind: "retry", retryClass, delayMs: decision.delayMs, scheduled: args.retry !== undefined };
      }
      case "fail":
        return { kind: "failed", retryClass, exhausted: decision.exhausted, ...(await failTask(ctx, task, now)) };
      case "park": {
        const code = args.failure.kind === "meter_refused" ? args.failure.error.code : null;
        await parkTask(ctx, task, isParkingMeterCode(code) ? code : "AI_DISABLED", now);
        return { kind: "parked", retryClass };
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Recovery (runs whose action died)
// ---------------------------------------------------------------------------

const recoverStaleCrewRunsResult = v.object({
  recovered: v.number(),
  failedTasks: v.number(),
  isDone: v.boolean(),
});

/**
 * Settles crew runs left `running` past the lease as indeterminate, the same
 * way `startCrewRun` closes one, then applies the retry budget: a task out of
 * indeterminate retries fails (refund rules as above); otherwise it stays
 * `running` with no open run, for its re-invoker (S2b's workpool `onComplete`)
 * to start again. One page per call (`RECOVERY_PAGE_MAX`); the next page is
 * scheduled with the same cutoff until the index range is done.
 *
 * Needs a cron (Codex's `convex/crons.ts`; progress Needs from Codex).
 */
export const recoverStaleCrewRuns = internalMutation({
  args: {
    cutoff: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  returns: recoverStaleCrewRunsResult,
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = args.cutoff ?? now - RUN_LEASE_MS;
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? RECOVERY_PAGE_MAX), RECOVERY_PAGE_MAX));
    const page = await ctx.db.query("workflow_runs")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "running").lt("createdAt", cutoff))
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    let recovered = 0;
    let failedTasks = 0;
    for (const run of page.page) {
      if (run.taskId === undefined || !isCrewStepJobType(run.type) || !isStale(run, now)) continue;
      await closeAbandonedRun(ctx, run, now);
      recovered += 1;
      const task = await ctx.db.get("tasks", run.taskId);
      if (task === null || task.status !== "running") continue;
      const earlier = (await runsOf(ctx, task._id)).filter((row) => row._id !== run._id).map((row) => row.errorCode);
      if (retryDecision("indeterminate", earlier).action === "fail") {
        await failTask(ctx, task, now);
        failedTasks += 1;
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crew.jobs.recoverStaleCrewRuns, { cutoff, cursor: page.continueCursor, limit });
    }
    return { recovered, failedTasks, isDone: page.isDone };
  },
});
