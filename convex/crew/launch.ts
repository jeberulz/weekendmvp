import { vOnCompleteArgs } from "@convex-dev/workpool";
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled, assertFeatureEnabledForOwner } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { checkLimit } from "../platform/limits";
import { assertStepTransition } from "../platform/transitions";
import { JOB_SUBJECT_MAIN, jobKey } from "../../lib/workspace/contracts/jobs";
import type { RosterPlan } from "../../lib/workspace/contracts/roster";
import { pendingLaunchView } from "../../lib/workspace/crew/launch";
import { isCrewStepJobType } from "../../lib/workspace/crew/tasks";
import {
  RUN_LEASE_MS,
  abandonCrewTask,
  approvedBlueprint,
  ensureLaunchStepTasks,
  insertCrewTask,
  launchDraftBlueprint,
  resumeParkedTask,
} from "./jobs";
import {
  launchRosterPlan,
  launchRosterTask,
  launchWizardAnswers,
  newestBlueprintFirstDraft,
  rosterPlanRow,
} from "./launchRoster";
import { crewStepOutcomeValidator } from "./runner";
import {
  LAUNCH_STEPS,
  LAUNCH_STEP_KEYS,
  evaluateLaunch,
  isPoolStep,
  launchStep,
  launchStepPosition,
  readySteps,
  stepDoneDecision,
  type EvaluatedStep,
  type LaunchFacts,
  type LaunchStep,
  type LaunchStepFact,
  type LaunchStepKey,
  type StepRunResult,
} from "./steps";
import { crewWorkpool } from "./workpool";

/**
 * WP75-S2b — the launch DAG on `crewWorkpool`.
 *
 * Every built pool step (the blueprint, the brand kit text; `./steps.ts`) runs
 * as `runCrewGeneratorStep` with `retryMode: "return"`, enqueued with
 * `retry: false` and `onComplete: stepDone`. `stepDone` is the re-invoker
 * (`stepDoneDecision`): a runner retry again after its `delayMs`, a step still
 * in flight again after `RUN_LEASE_MS`, an action that failed again after
 * `RUN_LEASE_MS` (at most `MAX_ACTION_FAILURES` in a row, then the task fails
 * as interrupted). A terminal task settles the step; a parked one waits for
 * `resumeLaunch`. After a step settles or parks, `advanceOwner` enqueues the
 * children whose parents are done.
 *
 * The enqueue marker. A step handed to the pool gets one `task_steps` row
 * (`running`, `position` = its registry index, `type` = its job type) on its
 * task; it settles `succeeded` / `failed` with the task. A queued task with a
 * running marker is on the pool; a queued task without one is waiting for a
 * slot or a parent. A parked task keeps its marker, and a resume reuses it.
 *
 * The per-owner cap. At most `OWNER_CREW_CAP` crew tasks in flight per owner
 * across every business: tasks `running`, plus queued tasks with a running
 * marker. `advanceOwner` is the only enqueuer for a fresh step and stops at
 * the cap; `resumeLaunch` resumes only what fits. Nothing is stranded: a ready
 * step waits only while the owner has 3 in flight, every in-flight step ends
 * in a `stepDone` (the workpool always calls `onComplete`), and every
 * `stepDone` that frees a slot calls `advanceOwner` again. A park frees its
 * slot the same way. `startLaunch` (called on every Meet your co-founder
 * mount) advances too, so a launch caught by a switch or a deploy picks up.
 *
 * Tokens (C-LIMITS, one per founder action): the launch, a retry and a resume
 * spend one each, in the founder-facing mutation; the steps the DAG runs on
 * its own spend none.
 *
 * Idempotency is the revision-0 job key: a step's task is inserted only while
 * nothing holds its key (`ensureLaunchStepTasks`), and a step is enqueued
 * only while its task is queued without a running marker.
 */

/** Crew tasks in flight per owner, across every business (`02` §6.2). */
export const OWNER_CREW_CAP = 3;

/** An owner's businesses read per advance (plans allow at most 3, `02` §4.3). */
const OWNER_PROJECTS_READ_MAX = 20;

/** Running tasks or markers read per business when counting what is in flight. */
const IN_FLIGHT_SCAN_MAX = 50;

/** Rows read per step job key. */
const STEP_KEY_HOLDERS_READ_MAX = 20;

/** Markers read per task. */
const MARKERS_PER_TASK_MAX = 20;

type ReadCtx = Pick<QueryCtx, "db">;

const stepKeyValidator = v.union(...LAUNCH_STEP_KEYS.map((key) => v.literal(key)));

const stepContextValidator = v.object({
  taskId: v.id("tasks"),
  step: stepKeyValidator,
  /** Consecutive action failures so far (`stepDoneDecision`). */
  actionFailures: v.number(),
});

// ---------------------------------------------------------------------------
// Reading a launch
// ---------------------------------------------------------------------------

/** The newest marker of a task, if any. */
async function newestMarker(ctx: ReadCtx, task: Doc<"tasks">): Promise<Doc<"task_steps"> | null> {
  const rows = await ctx.db.query("task_steps")
    .withIndex("by_taskId_and_position", (q) => q.eq("taskId", task._id))
    .take(MARKERS_PER_TASK_MAX);
  const own = rows.filter((row) => row.ownerId === task.ownerId && row.projectId === task.projectId);
  return own.reduce<Doc<"task_steps"> | null>((latest, row) =>
    latest === null || row._creationTime > latest._creationTime ? row : latest, null);
}

/** The newest live task holding a step's revision-0 key. */
async function stepTask(ctx: ReadCtx, project: Doc<"projects">, key: LaunchStepKey): Promise<Doc<"tasks"> | null> {
  if (key === "blueprint") return await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
  const step = launchStep(key);
  if (step.jobType === "crew_roster") return null;
  const type = step.jobType;
  const rows = await ctx.db.query("tasks")
    .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", project.ownerId).eq("jobKey", jobKey(project._id, type, JOB_SUBJECT_MAIN, 0)))
    .order("desc")
    .take(STEP_KEY_HOLDERS_READ_MAX);
  return rows.find((row) => row.projectId === project._id && row.type === type && row.archivedAt === undefined) ?? null;
}

type LaunchRead = {
  readonly facts: LaunchFacts;
  readonly tasks: Partial<Record<LaunchStepKey, Doc<"tasks">>>;
};

/** The facts `evaluateLaunch` needs, read-only. */
async function readLaunchFacts(ctx: ReadCtx, project: Doc<"projects">, rosterTask: Doc<"tasks">): Promise<LaunchRead> {
  const rosterWritten = rosterTask.status === "succeeded";
  const plan = rosterWritten ? await rosterPlanRow(ctx, project.ownerId, project._id) : null;
  const tasks: Partial<Record<LaunchStepKey, Doc<"tasks">>> = {};
  const facts: Partial<Record<LaunchStepKey, LaunchStepFact>> = {};
  for (const step of LAUNCH_STEPS) {
    if (!isPoolStep(step)) continue;
    const task = await stepTask(ctx, project, step.key);
    if (task === null) continue;
    const marker = await newestMarker(ctx, task);
    tasks[step.key] = task;
    facts[step.key] = { status: task.status, enqueued: marker?.status === "running" };
  }
  return {
    facts: {
      rosterWritten,
      hired: new Set(plan?.hired ?? []),
      skipped: new Map((plan?.skipped ?? []).map((entry) => [entry.roleKey, entry.reason])),
      tasks: facts,
    },
    tasks,
  };
}

/** The owner's live businesses with a workspace, newest first, always including `focus`. */
async function ownerProjects(ctx: ReadCtx, ownerId: Id<"users">, focus?: Doc<"projects">): Promise<Doc<"projects">[]> {
  const rows = (await ctx.db.query("projects")
    .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(OWNER_PROJECTS_READ_MAX))
    .filter((row) => row.archivedAt === undefined && row.workspace !== undefined);
  if (focus !== undefined && focus.ownerId === ownerId && !rows.some((row) => row._id === focus._id)) rows.push(focus);
  return rows;
}

/** Crew tasks in flight for the owner: `running`, or queued with a running marker (on the pool). */
async function ownerInFlight(ctx: ReadCtx, ownerId: Id<"users">, projects: readonly Doc<"projects">[]): Promise<Set<Id<"tasks">>> {
  const inFlight = new Set<Id<"tasks">>();
  for (const project of projects) {
    const running = await ctx.db.query("tasks")
      .withIndex("by_projectId_and_status_and_createdAt", (q) => q.eq("projectId", project._id).eq("status", "running"))
      .take(IN_FLIGHT_SCAN_MAX);
    for (const task of running) {
      if (task.ownerId === ownerId && task.archivedAt === undefined && isCrewStepJobType(task.type)) inFlight.add(task._id);
    }
    const markers = await ctx.db.query("task_steps")
      .withIndex("by_projectId_and_status_and_createdAt", (q) => q.eq("projectId", project._id).eq("status", "running"))
      .take(IN_FLIGHT_SCAN_MAX);
    for (const marker of markers) {
      if (marker.ownerId !== ownerId || inFlight.has(marker.taskId)) continue;
      const task = await ctx.db.get("tasks", marker.taskId);
      if (task !== null && task.ownerId === ownerId && task.archivedAt === undefined && task.status === "queued") inFlight.add(task._id);
    }
  }
  return inFlight;
}

// ---------------------------------------------------------------------------
// Markers and enqueue
// ---------------------------------------------------------------------------

/**
 * Settles a task's running marker with its terminal task (succeeded, or
 * failed for failed / cancelled). An archived task's marker settles as failed
 * whatever its status: it is off the pool for good.
 */
async function settleMarker(ctx: MutationCtx, task: Doc<"tasks">, now: number): Promise<void> {
  const archived = task.archivedAt !== undefined;
  if (!archived && task.status !== "succeeded" && task.status !== "failed" && task.status !== "cancelled") return;
  const marker = await newestMarker(ctx, task);
  if (marker === null || marker.status !== "running") return;
  const next = assertStepTransition("running", !archived && task.status === "succeeded" ? "succeeded" : "failed");
  await ctx.db.patch("task_steps", marker._id, { status: next, updatedAt: now });
}

type EnqueueOptions = { readonly resume?: boolean; readonly runAfter?: number; readonly actionFailures: number };

/** Hands a step to the pool: its marker (once), then `runCrewGeneratorStep` with `stepDone` as its `onComplete`. */
async function enqueueLaunchStep(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  step: LaunchStepKey,
  options: EnqueueOptions,
  now: number,
): Promise<void> {
  const definition = launchStep(step);
  if (definition.jobType === "crew_roster" || task.type !== definition.jobType) {
    throw new ConvexError({ code: "LAUNCH_STEP_MISMATCH" });
  }
  const marker = await newestMarker(ctx, task);
  if (marker === null || marker.status !== "running") {
    await ctx.db.insert("task_steps", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      type: definition.jobType,
      status: "running",
      position: BigInt(launchStepPosition(step)),
      createdAt: now,
      updatedAt: now,
    });
  }
  await crewWorkpool.enqueueAction(
    ctx,
    internal.crew.generators.runCrewGeneratorStep,
    { taskId: task._id, retryMode: "return", ...(options.resume === true ? { resume: true } : {}) },
    {
      retry: false,
      onComplete: internal.crew.launch.stepDone,
      context: { taskId: task._id, step, actionFailures: options.actionFailures },
      ...(options.runAfter === undefined || options.runAfter <= 0 ? {} : { runAfter: options.runAfter }),
    },
  );
}

/**
 * Fills the owner's free slots, oldest launch first. Inserts a written
 * roster's missing step tasks, skips a launch with a paused step (no new work
 * while the founder has something to resume), and enqueues ready steps while
 * fewer than `OWNER_CREW_CAP` are in flight. With the owner's workspace or AI
 * switched off it does nothing (the next `startLaunch` picks up). Spends no
 * token. Returns the number of steps enqueued.
 */
export async function advanceOwner(ctx: MutationCtx, ownerId: Id<"users">, now: number, focus?: Doc<"projects">): Promise<number> {
  try {
    await assertFeatureEnabledForOwner(ctx, "workspace", ownerId);
    await assertFeatureEnabledForOwner(ctx, "ai", ownerId);
  } catch {
    return 0;
  }
  const projects = await ownerProjects(ctx, ownerId, focus);
  const inFlight = await ownerInFlight(ctx, ownerId, projects);
  const launches: { project: Doc<"projects">; rosterTask: Doc<"tasks"> }[] = [];
  for (const project of projects) {
    const rosterTask = await launchRosterTask(ctx, ownerId, project._id);
    if (rosterTask !== null) launches.push({ project, rosterTask });
  }
  launches.sort((a, b) => a.rosterTask.createdAt - b.rosterTask.createdAt);

  let enqueued = 0;
  for (const { project, rosterTask } of launches) {
    if (rosterTask.status === "succeeded") {
      const plan = await rosterPlanRow(ctx, ownerId, project._id);
      if (plan !== null) await ensureLaunchStepTasks(ctx, project, new Set(plan.hired));
    }
    const read = await readLaunchFacts(ctx, project, rosterTask);
    const evaluated = evaluateLaunch(read.facts);
    if (evaluated.some((entry) => entry.state === "paused")) continue;
    for (const step of readySteps(evaluated)) {
      if (inFlight.size >= OWNER_CREW_CAP) return enqueued;
      const task = read.tasks[step.key];
      if (task === undefined || task.status !== "queued") continue;
      await enqueueLaunchStep(ctx, task, step.key, { actionFailures: 0 }, now);
      inFlight.add(task._id);
      enqueued += 1;
    }
  }
  return enqueued;
}

// ---------------------------------------------------------------------------
// stepDone
// ---------------------------------------------------------------------------

/**
 * The workpool's `onComplete` for every launch step: re-invokes, settles,
 * parks or abandons per `stepDoneDecision`, then fills free slots.
 *
 * `recoverStaleCrewRuns` may have failed the task already ("interrupted"):
 * the task is then terminal, so the step settles as failed and its children
 * stay queued. A late or duplicate delivery that finds the task succeeded
 * settles it as succeeded (whichever settles first wins; the task decides).
 */
export const stepDone = internalMutation({
  args: vOnCompleteArgs(stepContextValidator, crewStepOutcomeValidator),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const now = Date.now();
    const task = await ctx.db.get("tasks", args.context.taskId);
    if (task === null) return null;
    const result: StepRunResult = args.result.kind === "success"
      ? { kind: "success", returnValue: args.result.returnValue }
      : { kind: args.result.kind };
    const decision = stepDoneDecision(
      result,
      { status: task.status, archived: task.archivedAt !== undefined },
      args.context.actionFailures,
      RUN_LEASE_MS,
    );
    switch (decision.kind) {
      case "reenqueue":
        // The step keeps its slot (its task is still live), so nothing else is enqueued.
        await enqueueLaunchStep(ctx, task, args.context.step, { runAfter: decision.delayMs, actionFailures: decision.actionFailures }, now);
        return null;
      case "abandon": {
        await abandonCrewTask(ctx, task._id, now);
        const failed = await ctx.db.get("tasks", task._id);
        if (failed !== null) await settleMarker(ctx, failed, now);
        break;
      }
      case "settle":
        await settleMarker(ctx, task, now);
        break;
      case "park":
        break;
    }
    await advanceOwner(ctx, task.ownerId, now);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

/**
 * `resumed`: steps handed back to the pool; `paused`: steps still parked;
 * `waitingForSlot`: parked steps that did not fit under the owner's cap (no
 * token spent for them; the founder resumes again once a slot frees).
 */
export type ResumeResult = { readonly resumed: number; readonly paused: number; readonly waitingForSlot: boolean };

/**
 * Resumes the launch's parked steps, in registry order, as far as the owner's
 * cap allows. Spends ONE `crewJob` token when it resumes anything and none
 * when nothing fits (a step that does not fit stays parked for the next
 * resume). `tokenSpent`: the caller's founder action already spent it (a
 * first `startLaunch` that finds its first draft parked). The caller has
 * checked access.
 */
export async function resumeLaunchSteps(
  ctx: MutationCtx,
  project: Doc<"projects">,
  rosterTask: Doc<"tasks">,
  now: number,
  options: { readonly tokenSpent?: boolean } = {},
): Promise<ResumeResult> {
  const read = await readLaunchFacts(ctx, project, rosterTask);
  const parked = LAUNCH_STEPS.filter((step) => isPoolStep(step) && read.tasks[step.key]?.status === "blocked");
  if (parked.length === 0) return { resumed: 0, paused: 0, waitingForSlot: false };
  const projects = await ownerProjects(ctx, project.ownerId, project);
  const free = OWNER_CREW_CAP - (await ownerInFlight(ctx, project.ownerId, projects)).size;
  if (free <= 0) return { resumed: 0, paused: parked.length, waitingForSlot: true };
  if (options.tokenSpent !== true) await checkLimit(ctx, "crewJob", project.ownerId);
  let resumed = 0;
  for (const step of parked.slice(0, free)) {
    const task = read.tasks[step.key];
    if (task === undefined) continue;
    const running = await resumeParkedTask(ctx, task, now);
    await enqueueLaunchStep(ctx, running, step.key, { resume: true, actionFailures: 0 }, now);
    resumed += 1;
  }
  await advanceOwner(ctx, project.ownerId, now, project);
  return { resumed, paused: parked.length - resumed, waitingForSlot: parked.length > resumed };
}

const resumeResultValidator = v.object({ resumed: v.number(), paused: v.number(), waitingForSlot: v.boolean() });

/**
 * The founder's Resume on a launch step that was paused (the gateway refused
 * for a budget or a switch). Spends one `crewJob` token when it resumes a
 * step. Refuses `LAUNCH_NOT_STARTED` before a launch. Checks, in order: the
 * `workspace` feature, the `ai` feature, then owner access to a live business.
 */
export const resumeLaunch = mutation({
  args: { projectId: v.id("projects") },
  returns: resumeResultValidator,
  handler: async (ctx, args): Promise<ResumeResult> => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const rosterTask = await launchRosterTask(ctx, project.ownerId, project._id);
    if (rosterTask === null) throw new ConvexError({ code: "LAUNCH_NOT_STARTED" });
    return await resumeLaunchSteps(ctx, project, rosterTask, Date.now());
  },
});

// ---------------------------------------------------------------------------
// Retry before the roster (one rule for launchStatus and launchProgress)
// ---------------------------------------------------------------------------

/**
 * The blueprint a launch plans its team from when the blueprint step has
 * already succeeded: the newest blueprint the founder approved (S3a's
 * `approvedBlueprint`, so a newer approved revision wins), else the first
 * draft's own document.
 */
async function launchBlueprintBody(ctx: ReadCtx, project: Doc<"projects">, firstDraft: Doc<"tasks">): Promise<string | null> {
  const approved = await approvedBlueprint(ctx, project);
  if (approved?.body !== undefined) return approved.body;
  const document = await ctx.db.query("documents")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", firstDraft._id))
    .order("desc")
    .first();
  if (document === null || document.ownerId !== project.ownerId || document.projectId !== project._id ||
    document.kind !== "blueprint" || document.archivedAt !== undefined || document.body === undefined) {
    return null;
  }
  return document.body;
}

/**
 * The team a succeeded blueprint gives, or null when it cannot be planned or
 * does not match a stored plan row (read-only).
 */
export async function planFromSucceededBlueprint(
  ctx: ReadCtx,
  project: Doc<"projects">,
  firstDraft: Doc<"tasks">,
): Promise<RosterPlan | null> {
  const body = await launchBlueprintBody(ctx, project, firstDraft);
  return body === null ? null : await launchRosterPlan(ctx, project, body);
}

/** Where an open launch stands before its team exists. `blueprintDone`: the blueprint succeeded, the team is unplanned. */
export type OpenLaunchRetry =
  | { readonly failed: false }
  | { readonly failed: true; readonly paused: boolean; readonly retryable: boolean; readonly blueprintDone: boolean };

/**
 * Whether a launch whose roster task is still open has failed, and whether
 * the founder's Try again (`retryLaunch`) can help it now. `readLaunch`
 * (`launchStatus`) and `launchProgress` both read this, so the two never
 * disagree:
 * - the blueprint succeeded but the team is not stored: a free re-plan heals
 *   it only when it plans now;
 * - the blueprint failed, was cancelled or is missing: a new first draft helps
 *   only when the wizard answers are usable (otherwise its finish fails closed
 *   again, so no retry is offered and `retryLaunch` spends nothing);
 * - a paused blueprint is retryable (resumed);
 * - queued or running: not failed.
 */
export async function openLaunchRetry(ctx: ReadCtx, project: Doc<"projects">): Promise<OpenLaunchRetry> {
  const blueprint = await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
  if (blueprint?.status === "succeeded") {
    const plan = await planFromSucceededBlueprint(ctx, project, blueprint);
    return { failed: true, paused: false, retryable: plan !== null, blueprintDone: true };
  }
  const pending = pendingLaunchView(blueprint?.status ?? null);
  if (pending.state !== "failed") return { failed: false };
  const retryable = pending.retryable && (await launchWizardAnswers(ctx, project)) !== null;
  return { failed: true, paused: pending.paused, retryable, blueprintDone: false };
}

/** A failed blueprint, or an unplanned team, that no Try again can help. */
export const LAUNCH_STUCK_REASON = "This step could not finish, and trying again would not help.";

// ---------------------------------------------------------------------------
// Retry after the roster (S2b review M1)
// ---------------------------------------------------------------------------

/** A failed step the founder may try again. */
export const STEP_FAILED_REASON = "This step did not finish. Try again to run it again.";

/** A failed brand kit with no brief it may use now (`approvedBlueprint`, or the launch rule). */
export const BRIEF_CHANGED_REASON =
  "The blueprint changed. Approve it, or finish its changes, before the brand kit can try again.";

/** A step whose parents are done, waiting for one of the owner's crew slots. */
export const WAITING_FOR_SLOT_REASON = "Waiting for a free slot: your team is busy with other work.";

type FailedStep = { readonly step: LaunchStep; readonly retryable: boolean; readonly reason: string };

/**
 * The launch's failed pool steps after the blueprint, in registry order, and
 * whether a retry can help each now. A step reads `failed` only when its
 * parents are all done (`evaluateLaunch`). The brand kit is retryable only
 * when a brief exists for it now: an approved blueprint, or the launch's own
 * first draft under the S2b ruling (`launchDraftBlueprint`; `now` applies the
 * pending card's TTL, a query passes none and the step's finish applies it).
 */
async function failedLaunchSteps(
  ctx: ReadCtx,
  project: Doc<"projects">,
  read: LaunchRead,
  evaluated: readonly EvaluatedStep[],
  now?: number,
): Promise<FailedStep[]> {
  const out: FailedStep[] = [];
  for (const step of LAUNCH_STEPS) {
    if (!isPoolStep(step) || step.key === "blueprint" || read.tasks[step.key] === undefined) continue;
    if (evaluated.find((entry) => entry.key === step.key)?.state !== "failed") continue;
    if (step.jobType === "crew_brand_kit") {
      const brief = (await approvedBlueprint(ctx, project)) ?? (await launchDraftBlueprint(ctx, project, now));
      if (brief === null) {
        out.push({ step, retryable: false, reason: BRIEF_CHANGED_REASON });
        continue;
      }
    }
    out.push({ step, retryable: true, reason: STEP_FAILED_REASON });
  }
  return out;
}

export type StepRetryResult = { readonly retried: number; readonly notRetryable: number };

/**
 * The founder's Try again once the team exists: a new first draft for each
 * failed or cancelled pool step whose parents are all done and that a retry
 * can help, then `advanceOwner` (under the cap; a step that does not fit
 * reads `queued`, waiting for a free slot). ONE `crewJob` token per click,
 * however many steps it retries, and none when nothing is retryable (a brand
 * kit whose brief changed reports `BRIEF_CHANGED_REASON` through
 * `launchProgress`). A step still queued, running or paused is left alone.
 */
export async function retryFailedLaunchSteps(
  ctx: MutationCtx,
  project: Doc<"projects">,
  rosterTask: Doc<"tasks">,
  now: number,
): Promise<StepRetryResult> {
  const read = await readLaunchFacts(ctx, project, rosterTask);
  const failed = await failedLaunchSteps(ctx, project, read, evaluateLaunch(read.facts), now);
  const retry = failed.filter((entry) => entry.retryable);
  if (retry.length === 0) return { retried: 0, notRetryable: failed.length };
  await checkLimit(ctx, "crewJob", project.ownerId);
  for (const { step } of retry) {
    if (step.jobType === "crew_roster") continue;
    await insertCrewTask(ctx, {
      ownerId: project.ownerId,
      projectId: project._id,
      jobType: step.jobType,
      ...(step.employee === "lead" ? {} : { employeeKey: step.employee }),
    });
  }
  await advanceOwner(ctx, project.ownerId, now, project);
  return { retried: retry.length, notRetryable: failed.length - retry.length };
}

// ---------------------------------------------------------------------------
// Revisions off the pool (S2b review minor 3)
// ---------------------------------------------------------------------------

/**
 * A WP77 change-round revision runs through the scheduler, not the pool, but
 * counts toward the owner's cap while it is `running`. `jobs.ts` schedules
 * this when a revision leaves `running` (finished, failed, parked or
 * cancelled), so the slot it held is filled. No token.
 */
export const advanceAfterRevision = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await advanceOwner(ctx, args.ownerId, Date.now());
    return null;
  },
});

// ---------------------------------------------------------------------------
// Progress (additive, read-only)
// ---------------------------------------------------------------------------

const stepStateValidator = v.union(
  v.literal("waiting"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("skipped"),
);

const launchProgressValidator = v.object({
  started: v.boolean(),
  /** A failed step a Try again (`retryLaunch`) would run again now. */
  retryable: v.boolean(),
  steps: v.array(v.object({
    key: stepKeyValidator,
    title: v.string(),
    state: stepStateValidator,
    reason: v.optional(v.string()),
    /** Set on a failed step: whether a Try again can help it now. */
    retryable: v.optional(v.boolean()),
  })),
});

export type LaunchProgressStep = {
  key: LaunchStepKey;
  title: string;
  state: EvaluatedStep["state"];
  reason?: string;
  retryable?: boolean;
};

export type LaunchProgress = { readonly started: boolean; readonly retryable: boolean; readonly steps: LaunchProgressStep[] };

/**
 * Where each launch step stands, with a plain reason for a skipped, waiting,
 * queued (waiting for a free slot) or failed step, and whether Try again can
 * help a failed one. No ids.
 */
export const launchProgress = query({
  args: { projectId: v.id("projects") },
  returns: launchProgressValidator,
  handler: async (ctx, args): Promise<LaunchProgress> => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const rosterTask = await launchRosterTask(ctx, project.ownerId, project._id);
    if (rosterTask === null) return { started: false, retryable: false, steps: [] };
    const read = await readLaunchFacts(ctx, project, rosterTask);
    const evaluated = evaluateLaunch(read.facts);
    const failed = new Map((await failedLaunchSteps(ctx, project, read, evaluated)).map((entry) => [entry.step.key, entry]));
    // Before the team exists, the blueprint (or the unplanned team) carries the same retry rule as `launchStatus`.
    const open = rosterTask.status === "succeeded" ? null : await openLaunchRetry(ctx, project);
    const openKey: LaunchStepKey | null = open?.failed === true ? (open.blueprintDone ? "roster" : "blueprint") : null;
    if (open?.failed === true && openKey !== null) {
      const evaluatedOpen = evaluated.find((entry) => entry.key === openKey);
      failed.set(openKey, {
        step: launchStep(openKey),
        retryable: open.retryable,
        reason: open.paused
          ? (evaluatedOpen?.reason ?? STEP_FAILED_REASON)
          : open.retryable ? STEP_FAILED_REASON : LAUNCH_STUCK_REASON,
      });
    }
    const steps = evaluated.map((entry): LaunchProgressStep => {
      const failure = failed.get(entry.key);
      const reason = failure?.reason ?? entry.reason ?? (entry.state === "queued" ? WAITING_FOR_SLOT_REASON : undefined);
      // An unplanned team reads `waiting` from the facts; it has failed, as `launchStatus` says.
      const state = entry.key === openKey && open?.failed === true && !open.paused ? "failed" : entry.state;
      return {
        key: entry.key,
        title: launchStep(entry.key).title,
        state,
        ...(reason === undefined ? {} : { reason }),
        ...(failure === undefined ? {} : { retryable: failure.retryable }),
      };
    });
    return { started: true, retryable: [...failed.values()].some((entry) => entry.retryable), steps };
  },
});
