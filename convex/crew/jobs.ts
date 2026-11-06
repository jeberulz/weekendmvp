import { ConvexError, v, type Infer, type ObjectType } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { assertFeatureEnabledForOwner } from "../ops/settings";
import { requireBusinessForOwner } from "../platform/authz";
import { checkLimit } from "../platform/limits";
import { assertGeneratedDocumentBody } from "../platform/validators";
import { createApprovalRecord } from "../workspace/approvals";
import { parseArtifact, parseModelOutput } from "../../lib/workspace/contracts/artifacts";
import { JOB_SUBJECT_MAIN, jobKey, parseJobKey } from "../../lib/workspace/contracts/jobs";
import { parsePromptRef } from "../../lib/workspace/contracts/prompts";
import {
  FAILED_STEP_REASON,
  FAILED_STEP_REFUNDED_REASON,
  UNKNOWN_OUTCOME_ATTEMPT_STRIDE,
  classifyGatewayFailure,
  isParkingMeterCode,
  parkedReason,
  retryDecision,
  type ParkingMeterCode,
  type RetryClass,
} from "../../lib/workspace/crew/retry";
import {
  CREW_STEP_ARTIFACTS,
  crewDocumentTitle,
  isCrewStepJobType,
  planCrewTask,
  type CrewLineageTask,
  type CrewStepJobType,
} from "../../lib/workspace/crew/tasks";

/**
 * WP75-S2a — crew task lifecycle (C-JOBS), all internal. Every caller has
 * already authorised the founder (`02` §14): S1's `startLaunch`, S2b's launch
 * DAG, WP77-S2's change rounds. Owner ids here come from those callers or from
 * the task row, never from a client.
 *
 * - `insertCrewTask` / `createCrewTask`: one queued task per artifact draft.
 *   The round is computed here (C-JOBS rule, `planCrewTask`), the key is
 *   `jobKey()`, and live work under the same key is returned, not duplicated
 *   (`tasks.by_ownerId_and_jobKey`). One `checkLimit(ctx, "crewJob", owner)`
 *   per inserted task, with the limiter's current semantics (10 an hour).
 *   Whether a launch should count once or per step is still open (progress
 *   Stop-and-ask 10, Needs from Codex 9); nothing here changes the limit.
 *   First drafts and rounds 1-2 carry `creditCost: 0` and no debit; round 3+
 *   is refused here, because WP77-S2's debit site inserts paid rounds.
 * - `startCrewRun`: one `workflow_runs` row per execution of a task
 *   (`idempotencyKey = run:{taskId}:{n}`). `attempt` starts as the first
 *   gateway attempt number this execution may use: one past every number any
 *   task holding the job key has used (C-METER: attempts count across every
 *   task that held the key), read from the earlier runs and from `ai_usage`.
 * - `finishCrewStep`: the success transaction. Re-parses the output with the
 *   C-ART schema, writes the document, closes the run and the task, raises the
 *   `artifact_review` card (`createApprovalRecord`) and moves the employee and
 *   workstream to "needs you". All in one mutation (WP77 contract rule: the
 *   card and the subject link are written together).
 * - `settleCrewRun`: every other outcome. Stores the gateway's `nextAttempt`
 *   and the retry class (`errorCode`), then retries (scheduled, with backoff),
 *   fails (refund only when the task has a debit), parks (task `blocked`) or
 *   closes (nothing to undo), per `lib/workspace/crew/retry.ts`.
 * - `resumeCrewTask`: a parked task back to `queued` (the founder, or the next
 *   launch tick). Parked work is never looped automatically.
 */

// ---------------------------------------------------------------------------
// Limits and shared validators
// ---------------------------------------------------------------------------

/** Most tasks one artifact lineage (or one job key) may hold before inserts fail closed. */
export const CREW_LINEAGE_MAX = 200;

/** Executions of one task: the first run, 2 retryable retries and 1 indeterminate retry. */
export const MAX_RUNS_PER_TASK = 4;

/**
 * A run still `running` after this long was abandoned (its action died): no
 * Convex action outlives 10 minutes. Until then a second start is refused.
 */
export const RUN_LEASE_MS = 11 * 60 * 1_000;

/** Document ids kept on a workstream (newest last). */
export const WORKSTREAM_DOCUMENT_IDS_MAX = 100;

/** Most `ai_usage` rows read for one job key when finding the next attempt number. */
const USAGE_SCAN_MAX = 500;

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
  /** The task's credit debit for a paid round (WP77-S2); the meter verifies it. */
  creditDebitId: v.optional(v.id("credit_ledger")),
  /** The founder's "Ask for changes" note for a revision task; quoted as data. */
  revisionNote: v.optional(v.string()),
  timeoutMs: v.optional(v.number()),
  /**
   * `schedule` (default): a retry is scheduled by `settleCrewRun` itself.
   * `return`: the retry delay is returned and the caller re-enqueues (S2b's
   * workpool `onComplete`), so retries stay on the pool.
   */
  retryMode: v.optional(v.union(v.literal("schedule"), v.literal("return"))),
};

export type RunCrewStepArgs = ObjectType<typeof runCrewStepArgs>;

const crewStepJobTypeValidator = v.union(
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
): Promise<Doc<"tasks">[]> {
  const prefix = jobKey(projectId, jobType, subject, 0).slice(0, -1);
  // A subject never contains ':', and ';' sorts right after ':', so the range is exactly this lineage.
  const upper = `${prefix.slice(0, -1)};`;
  const rows = await ctx.db.query("tasks")
    .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", ownerId).gte("jobKey", prefix).lt("jobKey", upper))
    .take(CREW_LINEAGE_MAX + 1);
  if (rows.length > CREW_LINEAGE_MAX) refuse("CREW_TASK_CONFLICT");
  return rows;
}

function lineageTasks(rows: readonly Doc<"tasks">[], projectId: Id<"projects">, jobType: CrewStepJobType, subject: string): CrewLineageTask[] {
  return rows.map((row) => {
    const key = row.jobKey === undefined ? null : parseJobKey(row.jobKey);
    if (key === null || key.projectId !== projectId || key.jobType !== jobType || key.subject !== subject ||
      row.projectId !== projectId || row.type !== jobType) {
      refuse("CREW_TASK_CONFLICT");
    }
    return {
      id: row._id,
      status: row.status,
      revision: key.revision,
      ...(row.revisionOfTaskId === undefined ? {} : { revisionOfTaskId: row.revisionOfTaskId }),
    };
  });
}

/** The task's runs, newest first (bounded: a task has at most `MAX_RUNS_PER_TASK` plus abandoned starts). */
async function runsOf(ctx: Ctx, taskId: Id<"tasks">): Promise<Doc<"workflow_runs">[]> {
  return await ctx.db.query("workflow_runs")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", taskId))
    .order("desc")
    .take(MAX_RUNS_PER_TASK * 4);
}

/**
 * The first attempt number a new execution of this job key may use: one past
 * every number already used by any task that held the key. A finished run
 * stores the gateway's `nextAttempt`; a run still marked `running` may have
 * used two numbers from its stored start, so it counts as start + 2. The
 * `ai_usage` rows under the key are read too, so a number the meter saw is
 * never handed out again, whatever the runs say.
 */
export async function nextAttemptForJobKey(ctx: Ctx, ownerId: Id<"users">, key: string): Promise<number> {
  let next = 1;
  const holders = await ctx.db.query("tasks")
    .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", ownerId).eq("jobKey", key))
    .take(CREW_LINEAGE_MAX);
  for (const holder of holders) {
    for (const run of await runsOf(ctx, holder._id)) {
      const stored = Number(run.attempt);
      next = Math.max(next, run.status === "running" ? stored + UNKNOWN_OUTCOME_ATTEMPT_STRIDE : stored);
    }
  }
  const prefix = `${key}:`;
  const usage = await ctx.db.query("ai_usage")
    .withIndex("by_attemptKey", (q) => q.gte("attemptKey", prefix).lt("attemptKey", `${key};`))
    .take(USAGE_SCAN_MAX);
  for (const row of usage) {
    const suffix = row.attemptKey.slice(prefix.length);
    if (/^[1-9][0-9]*$/.test(suffix)) next = Math.max(next, Number(suffix) + 1);
  }
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

/** True when the task holds a live credit debit (WP73 ledger: `task-debit:{taskId}`). */
async function hasDebit(ctx: Ctx, task: Doc<"tasks">): Promise<boolean> {
  const debit = await ctx.db.query("credit_ledger")
    .withIndex("by_ownerId_and_idempotencyKey", (q) => q.eq("ownerId", task.ownerId).eq("idempotencyKey", `task-debit:${task._id}`))
    .unique();
  return debit !== null && debit.reason === "task_debit" && debit.taskId === task._id && debit.delta < 0n;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const TERMINAL_TASK_STATUSES: readonly string[] = ["succeeded", "failed", "cancelled"];

// ---------------------------------------------------------------------------
// Task insert
// ---------------------------------------------------------------------------

export type CrewTaskInput = {
  readonly ownerId: Id<"users">;
  readonly projectId: Id<"projects">;
  readonly jobType: CrewStepJobType;
  /** C-JOBS subject; every WP75 artifact is `main`. */
  readonly subject?: string;
  /** The employee's role key (`crew_members.roleKey`). */
  readonly employeeKey?: string;
  /** Set for an "Ask for changes" revision: the task that made the reviewed draft. */
  readonly revisionOfTaskId?: Id<"tasks">;
  /** The card that holds the founder's note, for a revision. */
  readonly approvalId?: Id<"approvals">;
  readonly title?: string;
};

export type CrewTaskInsert = {
  readonly taskId: Id<"tasks">;
  readonly created: boolean;
  readonly changeRound: number;
  readonly jobKey: string;
};

/**
 * Inserts (or returns) the task for one artifact draft. Throws
 * `CREW_TASK_BUSY`, `CREW_TASK_STALE`, `CREW_TASK_PAID_ROUND` or
 * `CREW_TASK_CONFLICT` when the lineage refuses it, and the limiter's or the
 * feature gate's error when the owner may not start work now.
 */
export async function insertCrewTask(ctx: MutationCtx, input: CrewTaskInput): Promise<CrewTaskInsert> {
  const subject = input.subject ?? JOB_SUBJECT_MAIN;
  await requireBusinessForOwner(ctx, input.projectId, input.ownerId);
  const rows = await readLineage(ctx, input.ownerId, input.projectId, input.jobType, subject);
  const plan = planCrewTask(lineageTasks(rows, input.projectId, input.jobType, subject), {
    ...(input.revisionOfTaskId === undefined ? {} : { revisionOfTaskId: input.revisionOfTaskId }),
  });
  if (plan.kind === "refused") refuse(`CREW_TASK_${plan.reason.toUpperCase()}`);
  if (plan.kind === "existing") {
    const existing = rows.find((row) => row._id === plan.taskId);
    if (existing === undefined || existing.jobKey === undefined) refuse("CREW_TASK_CONFLICT");
    return { taskId: existing._id, created: false, changeRound: Number(existing.changeRound ?? 0n), jobKey: existing.jobKey };
  }

  // C-LIMITS: one check per inserted task, in the mutation that starts the work.
  await checkLimit(ctx, "crewJob", input.ownerId);
  const key = jobKey(input.projectId, input.jobType, subject, plan.changeRound);
  // A retry after failed or cancelled holders gets its own idempotency key.
  const idempotencyKey = plan.priorHolders === 0 ? `crew-task:${key}` : `crew-task:${key}:retry:${plan.priorHolders}`;
  const now = Date.now();
  const taskId = await ctx.db.insert("tasks", {
    ownerId: input.ownerId,
    projectId: input.projectId,
    type: input.jobType,
    status: "queued",
    title: input.title ?? crewDocumentTitle(input.jobType, plan.changeRound),
    ...(input.employeeKey === undefined ? {} : { employeeKey: input.employeeKey }),
    // First drafts and free rounds: no credits, no debit (paid rounds are WP77-S2's).
    creditCost: 0n,
    changeRound: BigInt(plan.changeRound),
    ...(input.revisionOfTaskId === undefined ? {} : { revisionOfTaskId: input.revisionOfTaskId }),
    ...(input.approvalId === undefined ? {} : { approvalId: input.approvalId }),
    jobKey: key,
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });
  return { taskId, created: true, changeRound: plan.changeRound, jobKey: key };
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
    revisionOfTaskId: v.optional(v.id("tasks")),
    approvalId: v.optional(v.id("approvals")),
    title: v.optional(v.string()),
  },
  returns: crewTaskInsertValidator,
  handler: async (ctx, args): Promise<CrewTaskInsert> => await insertCrewTask(ctx, args),
});

// ---------------------------------------------------------------------------
// Outcomes shared by the success and failure paths
// ---------------------------------------------------------------------------

/** Fails the task for good; schedules the refund only when the task has a debit. */
async function failTask(ctx: MutationCtx, task: Doc<"tasks">, now: number): Promise<{ refundScheduled: boolean }> {
  await ctx.db.patch("tasks", task._id, { status: "failed", updatedAt: now });
  const refundScheduled = await hasDebit(ctx, task);
  if (refundScheduled) {
    // Same transaction as the failure: the refund cannot be lost between them.
    await ctx.scheduler.runAfter(0, internal.platform.billing.ledger.refundFailedTask, {
      taskId: task._id,
      projectId: task.projectId,
    });
  }
  await setCrewStatus(ctx, task, {
    member: "needs_you",
    workstream: "failed",
    blocker: refundScheduled ? FAILED_STEP_REFUNDED_REASON : FAILED_STEP_REASON,
  }, now);
  return { refundScheduled };
}

async function parkTask(ctx: MutationCtx, task: Doc<"tasks">, code: ParkingMeterCode, now: number): Promise<void> {
  await ctx.db.patch("tasks", task._id, { status: "blocked", updatedAt: now });
  await setCrewStatus(ctx, task, { member: "needs_you", workstream: "blocked", blocker: parkedReason(code) }, now);
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
  if (!Number.isSafeInteger(value) || value < 1) refuse("CREW_RUN_INVALID_ATTEMPT");
  return value;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

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
    /** The revised draft's stored artifact (JSON), for a revision task. */
    previousArtifactJson: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("skip"),
    reason: v.union(
      v.literal("missing"),
      v.literal("not_crew_step"),
      v.literal("terminal"),
      v.literal("blocked"),
      v.literal("in_flight"),
      v.literal("exhausted"),
    ),
  }),
);

export type StartCrewRunResult = Infer<typeof startCrewRunResult>;

/**
 * Opens one execution of a task. A task that is terminal, parked or already
 * executing is skipped (a replay of the same step is a no-op).
 */
export const startCrewRun = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: startCrewRunResult,
  handler: async (ctx, args): Promise<StartCrewRunResult> => {
    const task = await ctx.db.get("tasks", args.taskId);
    if (task === null || task.archivedAt !== undefined) return { kind: "skip", reason: "missing" };
    const key = task.jobKey === undefined ? null : parseJobKey(task.jobKey);
    if (!isCrewStepJobType(task.type) || key === null || key.jobType !== task.type || key.projectId !== task.projectId ||
      task.jobKey === undefined) {
      return { kind: "skip", reason: "not_crew_step" };
    }
    if (TERMINAL_TASK_STATUSES.includes(task.status)) return { kind: "skip", reason: "terminal" };
    if (task.status === "blocked") return { kind: "skip", reason: "blocked" };

    const now = Date.now();
    const runs = await runsOf(ctx, task._id);
    for (const run of runs) {
      if (run.status !== "running") continue;
      if (now - (run.startedAt ?? run.createdAt) < RUN_LEASE_MS) return { kind: "skip", reason: "in_flight" };
      // Abandoned: its outcome is unknown, so it may have used two attempt numbers.
      await closeRun(ctx, run, "failed", "indeterminate", Number(run.attempt) + UNKNOWN_OUTCOME_ATTEMPT_STRIDE, now);
    }
    if (runs.length >= MAX_RUNS_PER_TASK) {
      await failTask(ctx, task, now);
      return { kind: "skip", reason: "exhausted" };
    }

    const attempt = await nextAttemptForJobKey(ctx, task.ownerId, task.jobKey);
    const runNumber = runs.length + 1;
    const runId = await ctx.db.insert("workflow_runs", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      type: task.type,
      status: "running",
      idempotencyKey: `run:${task._id}:${runNumber}`,
      attempt: BigInt(attempt),
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    });
    if (task.status !== "running") await ctx.db.patch("tasks", task._id, { status: "running", updatedAt: now });
    await setCrewStatus(ctx, task, { member: "working", workstream: "working", blocker: null }, now);

    const previous = await revisedDocument(ctx, task, CREW_STEP_ARTIFACTS[task.type].kind);
    return {
      kind: "run",
      runId,
      runNumber,
      attempt,
      jobKey: task.jobKey,
      jobType: task.type,
      ownerId: task.ownerId,
      projectId: task.projectId,
      changeRound: Number(task.changeRound ?? 0n),
      ...(previous?.body === undefined ? {} : { previousArtifactJson: previous.body }),
    };
  },
});

/** The run and its task, when the run is still open and the task is executing it. */
async function openRun(
  ctx: Ctx,
  runId: Id<"workflow_runs">,
): Promise<{ run: Doc<"workflow_runs">; task: Doc<"tasks"> & { type: CrewStepJobType } } | null> {
  const run = await ctx.db.get("workflow_runs", runId);
  if (run === null || run.status !== "running" || run.taskId === undefined) return null;
  const task = await ctx.db.get("tasks", run.taskId);
  if (task === null || !isCrewStepJobType(task.type) || task.ownerId !== run.ownerId) return null;
  return { run, task: task as Doc<"tasks"> & { type: CrewStepJobType } };
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
    const { run, task } = open;
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

    const { kind } = CREW_STEP_ARTIFACTS[task.type];
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
      title: crewDocumentTitle(task.type, Number(task.changeRound ?? 0n)),
      ...(previous === null ? {} : { supersedesDocumentId: previous._id }),
      schemaVersion: "1",
      promptRef: args.promptRef,
      body,
      contentSha256: await sha256Hex(body),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("tasks", task._id, { status: "succeeded", updatedAt: now });
    await closeRun(ctx, run, "succeeded", undefined, nextAttempt, now);
    const { approvalId } = await createApprovalRecord(ctx, {
      ownerId: task.ownerId,
      projectId: task.projectId,
      kind: "artifact_review",
      subjectTable: "documents",
      subjectId: documentId,
      changeRound: task.changeRound ?? 0n,
    });
    await setCrewStatus(ctx, task, {
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
  v.object({ kind: v.literal("retry"), retryClass: v.string(), delayMs: v.number(), scheduled: v.boolean() }),
  v.object({ kind: v.literal("failed"), retryClass: v.string(), exhausted: v.boolean(), refundScheduled: v.boolean() }),
  v.object({ kind: v.literal("parked"), retryClass: v.string() }),
  v.object({ kind: v.literal("closed"), retryClass: v.string() }),
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
    const terminal = TERMINAL_TASK_STATUSES.includes(task.status);
    const retryClass = classifyGatewayFailure(args.failure, { taskTerminal: terminal });
    const earlier = (await runsOf(ctx, task._id)).filter((row) => row._id !== run._id).map((row) => row.errorCode);
    const decision = retryDecision(retryClass, earlier);

    // A task closed meanwhile (cancelled, say) is never retried, failed or parked from here.
    if (decision.action === "close" || terminal) {
      await closeRun(ctx, run, "cancelled", retryClass, nextAttempt, now);
      return { kind: "closed", retryClass };
    }
    await closeRun(ctx, run, "failed", retryClass, nextAttempt, now);
    switch (decision.action) {
      case "retry": {
        await ctx.db.patch("tasks", task._id, { updatedAt: now });
        if (args.retry !== undefined) {
          await ctx.scheduler.runAfter(decision.delayMs, internal.crew.runner.runCrewStep, args.retry);
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
// Resume
// ---------------------------------------------------------------------------

/** A parked (`blocked`) task back to `queued`. The caller then runs the step again. */
export const resumeCrewTask = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.object({ resumed: v.boolean() }),
  handler: async (ctx, args): Promise<{ resumed: boolean }> => {
    const task = await ctx.db.get("tasks", args.taskId);
    if (task === null || task.archivedAt !== undefined || task.status !== "blocked" || !isCrewStepJobType(task.type)) {
      return { resumed: false };
    }
    const now = Date.now();
    await ctx.db.patch("tasks", task._id, { status: "queued", updatedAt: now });
    await setCrewStatus(ctx, task, { member: "queued", workstream: "queued", blocker: null }, now);
    return { resumed: true };
  },
});
