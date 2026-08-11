import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import {
  assertStepTransition,
  assertTaskTransition,
  assertWorkflowRunTransition,
} from "../transitions";
import { PIPELINE, stepIdempotencyKey } from "./pipeline";

/**
 * WP26-S3. Durable run and step state for the Validation Report pipeline.
 *
 * **Everything here derives identity from stored rows, never from arguments.**
 * The workflow runs with no end-user auth context, so these mutations take a
 * `taskId` and read `ownerId`/`projectId` off the task itself — the same
 * trusted-chain shape `billing/ledger.ts` uses. No caller supplies an owner.
 *
 * **Three frozen-schema constraints shape this module** (see
 * `docs/wp/wp26-progress.md`):
 *
 * 1. `task_steps.type` has five coarse values for a seven-step pipeline, so
 *    `position` is the step's identity.
 * 2. `stepTransitions.failed` is terminal, so the retry-once policy cannot mark
 *    a step failed and reopen it. A step stays `running` across both attempts
 *    and transitions once, at the end.
 * 3. `task_steps` has no attempt counter, idempotency key, or result pointer, so
 *    the per-attempt provider-call record lives in `workflow_runs` — the only
 *    frozen table carrying `idempotencyKey`, `attempt`, and `errorCode`.
 */

/** `workflow_runs.type` is a workflow type; every row here belongs to this one. */
const WORKFLOW_TYPE = "validation_report" as const;

/** Bounds the attempt-record scan: 7 steps x at most 2 attempts, plus slack. */
const MAX_ATTEMPT_ROWS = 64;

function attemptKey(
  taskIdempotencyKey: string,
  position: number,
  attempt: number,
): string {
  return `${stepIdempotencyKey(taskIdempotencyKey, position)}:attempt:${attempt}`;
}

function attemptKeyPrefix(taskIdempotencyKey: string, position: number): string {
  return `${stepIdempotencyKey(taskIdempotencyKey, position)}:attempt:`;
}

async function requireTask(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">,
): Promise<Doc<"tasks">> {
  const task = await ctx.db.get("tasks", taskId);
  if (!task || task.archivedAt !== undefined) {
    throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  }
  return task;
}

async function requireStep(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">,
  position: number,
): Promise<Doc<"task_steps">> {
  const step = await ctx.db
    .query("task_steps")
    .withIndex("by_taskId_and_position", (query) =>
      query.eq("taskId", taskId).eq("position", BigInt(position)),
    )
    .unique();
  if (!step) {
    throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  }
  return step;
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates the task and its seven step rows in one transaction.
 *
 * Idempotent on `(ownerId, idempotencyKey)`: a duplicate start returns the
 * existing run rather than opening a second one that would be charged twice.
 */
export const createRun = internalMutation({
  args: {
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    idempotencyKey: v.string(),
    title: v.string(),
  },
  returns: v.object({ taskId: v.id("tasks"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    if (
      !project ||
      project.ownerId !== args.ownerId ||
      project.archivedAt !== undefined
    ) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }

    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_ownerId_and_idempotencyKey", (query) =>
        query.eq("ownerId", args.ownerId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      return { taskId: existing._id, created: false };
    }

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      ownerId: args.ownerId,
      projectId: args.projectId,
      type: WORKFLOW_TYPE,
      status: "queued",
      title: args.title,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    for (const step of PIPELINE) {
      await ctx.db.insert("task_steps", {
        ownerId: args.ownerId,
        projectId: args.projectId,
        taskId,
        type: step.type,
        status: "pending",
        position: BigInt(step.position),
        createdAt: now,
        updatedAt: now,
      });
    }

    return { taskId, created: true };
  },
});

export const markRunning = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    // A run cancelled while still queued must stay cancelled.
    if (task.status !== "queued") return null;
    await ctx.db.patch("tasks", task._id, {
      status: assertTaskTransition(task.status, "running"),
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Cooperative cancellation.
 *
 * The workflow component can hard-cancel a run, but that would abandon a
 * provider call mid-flight — money spent with nothing recorded, which is the
 * exact state the reconciliation rule exists to avoid. Marking the task
 * `cancelled` instead lets the in-flight step settle its own attempt record and
 * stops the *next* step from issuing anything new.
 */
export const requestCancel = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.object({ cancelled: v.boolean() }),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    if (
      task.status === "succeeded" ||
      task.status === "failed" ||
      task.status === "cancelled"
    ) {
      // Terminal already; cancelling again is a no-op, not an error.
      return { cancelled: task.status === "cancelled" };
    }
    await ctx.db.patch("tasks", task._id, {
      status: assertTaskTransition(task.status, "cancelled"),
      updatedAt: Date.now(),
    });
    return { cancelled: true };
  },
});

export const runState = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.object({
    status: v.string(),
    cancelled: v.boolean(),
    idempotencyKey: v.string(),
    ownerId: v.id("users"),
    projectId: v.id("projects"),
  }),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    return {
      status: task.status,
      cancelled: task.status === "cancelled",
      idempotencyKey: task.idempotencyKey,
      ownerId: task.ownerId,
      projectId: task.projectId,
    };
  },
});

/**
 * Terminal transition for the run. The workflow component's `onComplete` fires
 * this, and duplicate or concurrent completion signals must not fight over it:
 * a task already in a terminal state is left exactly as it is.
 */
export const completeRun = internalMutation({
  args: {
    taskId: v.id("tasks"),
    outcome: v.union(v.literal("succeeded"), v.literal("failed")),
  },
  returns: v.object({ applied: v.boolean(), status: v.string() }),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    if (
      task.status === "succeeded" ||
      task.status === "failed" ||
      task.status === "cancelled"
    ) {
      return { applied: false, status: task.status };
    }
    const next = assertTaskTransition(task.status, args.outcome);
    await ctx.db.patch("tasks", task._id, { status: next, updatedAt: Date.now() });
    return { applied: true, status: next };
  },
});

// ---------------------------------------------------------------------------
// Step lifecycle
// ---------------------------------------------------------------------------

export const markStepRunning = internalMutation({
  args: { taskId: v.id("tasks"), position: v.int64() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const step = await requireStep(ctx, args.taskId, Number(args.position));
    // Re-entering a step that is already running (a resumed workflow) is normal
    // and must not throw — `running -> running` is not a legal transition.
    if (step.status !== "pending") return null;
    await ctx.db.patch("task_steps", step._id, {
      status: assertStepTransition(step.status, "running"),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const completeStep = internalMutation({
  args: {
    taskId: v.id("tasks"),
    position: v.int64(),
    outcome: v.union(
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
  },
  returns: v.object({ applied: v.boolean() }),
  handler: async (ctx, args) => {
    const step = await requireStep(ctx, args.taskId, Number(args.position));
    if (step.status !== "pending" && step.status !== "running") {
      return { applied: false };
    }
    if (args.outcome === "skipped" && step.status !== "pending") {
      // `skipped` is only reachable from `pending`; a running step that must
      // stop is a failure, not a skip.
      return { applied: false };
    }
    await ctx.db.patch("task_steps", step._id, {
      status: assertStepTransition(step.status, args.outcome),
      updatedAt: Date.now(),
    });
    return { applied: true };
  },
});

/** The last position whose step succeeded, or -1. Drives resume. */
export const lastCompletedPosition = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("task_steps")
      .withIndex("by_taskId_and_position", (query) => query.eq("taskId", args.taskId))
      .take(PIPELINE.length);
    let last = -1;
    for (const step of steps) {
      if (step.status === "succeeded") last = Math.max(last, Number(step.position));
    }
    return last;
  },
});

// ---------------------------------------------------------------------------
// Step output
// ---------------------------------------------------------------------------

/**
 * Persists one step's raw provider output.
 *
 * Idempotent on `(taskId, kind, title)`: a resumed or redelivered step
 * overwrites its own document rather than appending a second copy that `S5`'s
 * compiler would then have to disambiguate.
 */
export const storeStepDocument = internalMutation({
  args: {
    taskId: v.id("tasks"),
    kind: v.union(
      v.literal("research"),
      v.literal("validation_report"),
      v.literal("brief"),
    ),
    title: v.string(),
    body: v.string(),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const now = Date.now();
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_taskId_and_createdAt", (query) =>
        query.eq("taskId", args.taskId),
      )
      .take(PIPELINE.length * 2);
    const match = existing.find(
      (doc) => doc.kind === args.kind && doc.title === args.title,
    );
    if (match) {
      await ctx.db.patch("documents", match._id, {
        body: args.body,
        updatedAt: now,
      });
      return match._id;
    }
    return await ctx.db.insert("documents", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: args.taskId,
      kind: args.kind,
      format: "json",
      title: args.title,
      body: args.body,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const readStepDocuments = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.array(v.object({ title: v.string(), body: v.string() })),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_taskId_and_createdAt", (query) =>
        query.eq("taskId", args.taskId),
      )
      .take(PIPELINE.length * 2);
    return docs.map((doc) => ({ title: doc.title, body: doc.body ?? "" }));
  },
});

// ---------------------------------------------------------------------------
// Paid-attempt records — the crash-window ledger
// ---------------------------------------------------------------------------

/**
 * One `workflow_runs` row per paid attempt, keyed
 * `<taskKey>:step:<position>:attempt:<n>`.
 *
 * A row in `running` is the crash-window signal: a call was issued and never
 * settled. `workflowRunTransitions` makes `succeeded`/`failed` terminal, which
 * is why each attempt gets its own row rather than one row being reopened.
 *
 * These rows carry no customer text — only the derived key, an attempt number,
 * and our own error codes — so the cost/telemetry surface stays PII-free.
 */
export const readAttempt = internalQuery({
  args: { taskId: v.id("tasks"), position: v.int64() },
  returns: v.union(
    v.null(),
    v.object({ attempt: v.number(), settled: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const prefix = attemptKeyPrefix(task.idempotencyKey, Number(args.position));
    const rows = await ctx.db
      .query("workflow_runs")
      .withIndex("by_taskId_and_createdAt", (query) =>
        query.eq("taskId", args.taskId),
      )
      .take(MAX_ATTEMPT_ROWS);

    let latest: Doc<"workflow_runs"> | null = null;
    for (const row of rows) {
      if (!row.idempotencyKey.startsWith(prefix)) continue;
      if (latest === null || row.attempt > latest.attempt) latest = row;
    }
    if (latest === null) return null;
    return {
      attempt: Number(latest.attempt),
      settled: latest.status !== "running" && latest.status !== "queued",
    };
  },
});

export const beginAttempt = internalMutation({
  args: { taskId: v.id("tasks"), position: v.int64(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const key = attemptKey(
      task.idempotencyKey,
      Number(args.position),
      args.attempt,
    );
    const existing = await ctx.db
      .query("workflow_runs")
      .withIndex("by_ownerId_and_idempotencyKey", (query) =>
        query.eq("ownerId", task.ownerId).eq("idempotencyKey", key),
      )
      .unique();
    // A redelivered `beginAttempt` must not mint a second record for the same
    // attempt, or the crash-window read would see a phantom extra call.
    if (existing) return null;

    const now = Date.now();
    await ctx.db.insert("workflow_runs", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      type: WORKFLOW_TYPE,
      status: "running",
      idempotencyKey: key,
      attempt: BigInt(args.attempt),
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    });
    return null;
  },
});

export const settleAttempt = internalMutation({
  args: {
    taskId: v.id("tasks"),
    position: v.int64(),
    attempt: v.number(),
    outcome: v.union(v.literal("succeeded"), v.literal("failed")),
    errorCode: v.optional(v.string()),
  },
  returns: v.object({ applied: v.boolean() }),
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const key = attemptKey(
      task.idempotencyKey,
      Number(args.position),
      args.attempt,
    );
    const row = await ctx.db
      .query("workflow_runs")
      .withIndex("by_ownerId_and_idempotencyKey", (query) =>
        query.eq("ownerId", task.ownerId).eq("idempotencyKey", key),
      )
      .unique();
    if (!row) {
      // Settling an attempt that was never begun would erase the crash-window
      // evidence rather than record an outcome.
      throw new ConvexError({ code: "ATTEMPT_NOT_FOUND" });
    }
    if (row.status !== "running" && row.status !== "queued") {
      return { applied: false };
    }
    const now = Date.now();
    await ctx.db.patch("workflow_runs", row._id, {
      status: assertWorkflowRunTransition(row.status, args.outcome),
      errorCode: args.errorCode,
      updatedAt: now,
      completedAt: now,
    });
    return { applied: true };
  },
});
