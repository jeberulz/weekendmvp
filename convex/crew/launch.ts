import { vOnCompleteArgs } from "@convex-dev/workpool";
import { ConvexError, v, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled, assertFeatureEnabledForOwner } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { checkLimit } from "../platform/limits";
import { assertStepTransition } from "../platform/transitions";
import { JOB_SUBJECT_MAIN, jobKey } from "../../lib/workspace/contracts/jobs";
import { ROLE_KEYS, type RoleKey, type RosterPlan } from "../../lib/workspace/contracts/roster";
import { pendingLaunchView } from "../../lib/workspace/crew/launch";
import { isCrewStepJobType } from "../../lib/workspace/crew/tasks";
import {
  RUN_LEASE_MS,
  RUN_SCAN_MAX,
  abandonCrewTask,
  approvedBlueprint,
  approvedBrandKit,
  ensureLaunchStepTasks,
  insertCrewTask,
  isSupersededLaunchWork,
  launchDraftBlueprint,
  launchTaskMarkers,
  launchDraftBrandKit,
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
import { emailDraftTarget } from "../growth/drafts/emailSequence";
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
 * The launch sweep (L1, `recoverStalledLaunches`, on a cron). The workpool
 * is durable and always calls `onComplete`, so pool work is not lost by a
 * deploy or a crash. What can strand a step is a throw inside `stepDone` (or
 * the `advanceOwner` it calls): the mutation rolls back, so its re-enqueue or
 * its settle never lands, and the running marker stays with no work behind it,
 * holding a slot for good. No `workId` is stored on the marker (`task_steps`
 * is Codex's schema), so "the work is gone" is inferred: a running marker on
 * a live `queued` or `running` task with no `running` run, and nothing on the
 * task, marker or runs for `STRANDED_MARKER_MS` (2 hours). The sweep settles
 * that marker `failed`. A queued step is then enqueued again by
 * `advanceOwner`, under the cap; a running one (a runner retry whose
 * `stepDone` threw) already holds its slot and is re-enqueued at once, as
 * `stepDone` would have. Either way under a new marker. It also settles a
 * leftover running marker on a terminal task, and re-advances an owner left
 * with a ready step and a free slot. The enqueue marker is a fence: its id
 * travels with the work (`runCrewGeneratorStep`'s `markerId`) and with
 * `stepDone`'s context, so work the sweep judged gone that was in fact only
 * late (a backlog past two hours) skips as `superseded` at `startCrewRun` and
 * its `stepDone` does nothing; the step runs once, under the newer marker,
 * and only its place in the queue is lost. A running task re-invoked more
 * than `LAUNCH_SWEEP_REQUEUES_MAX` times fails as interrupted; a queued one
 * is never failed by the sweep (it has spent nothing).
 *
 * Tokens (C-LIMITS, one per founder action): the launch, a retry and a resume
 * spend one each, in the founder-facing mutation; the steps the DAG runs on
 * its own spend none.
 *
 * Idempotency is the revision-0 job key: a step's task is inserted only while
 * nothing holds its key (`ensureLaunchStepTasks`), and a step is enqueued
 * only while its task is queued without a running marker (`stepDone`
 * re-enqueues under the marker it already holds).
 */

/** Crew tasks in flight per owner, across every business (`02` §6.2). */
export const OWNER_CREW_CAP = 3;

/** An owner's businesses read per advance (plans allow at most 3, `02` §4.3). */
const OWNER_PROJECTS_READ_MAX = 20;

/** Running tasks or markers read per business when counting what is in flight. */
const IN_FLIGHT_SCAN_MAX = 50;

/** Rows read per step job key. */
const STEP_KEY_HOLDERS_READ_MAX = 20;

type ReadCtx = Pick<QueryCtx, "db">;

const stepKeyValidator = v.union(...LAUNCH_STEP_KEYS.map((key) => v.literal(key)));

const stepContextValidator = v.object({
  taskId: v.id("tasks"),
  step: stepKeyValidator,
  /** Consecutive action failures so far (`stepDoneDecision`). */
  actionFailures: v.number(),
  /**
   * L1 launch sweep: the marker the work was enqueued under. Optional, so work
   * enqueued before the sweep shipped still completes. A `stepDone` whose
   * marker is no longer `running` was superseded and does nothing.
   */
  markerId: v.optional(v.id("task_steps")),
});

// ---------------------------------------------------------------------------
// Reading a launch
// ---------------------------------------------------------------------------

function newestOf(markers: readonly Doc<"task_steps">[]): Doc<"task_steps"> | null {
  return markers.reduce<Doc<"task_steps"> | null>((latest, row) =>
    latest === null || row._creationTime > latest._creationTime ? row : latest, null);
}

/** The newest marker of a task, if any (`launchTaskMarkers`, the read the sweep's fence in `jobs.ts` shares). */
async function newestMarker(ctx: ReadCtx, task: Doc<"tasks">): Promise<Doc<"task_steps"> | null> {
  return newestOf(await launchTaskMarkers(ctx, task));
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

/**
 * Hands a step to the pool: its marker (once), then `runCrewGeneratorStep` with `stepDone` as its `onComplete`.
 * A reused marker's `updatedAt` moves to now, so the launch sweep reads every enqueue as activity. The marker id
 * travels with the work and its `onComplete`, so work the sweep superseded never runs or acts.
 */
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
  let markerId: Id<"task_steps">;
  if (marker === null || marker.status !== "running") {
    markerId = await ctx.db.insert("task_steps", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      type: definition.jobType,
      status: "running",
      position: BigInt(launchStepPosition(step)),
      createdAt: now,
      updatedAt: now,
    });
  } else {
    markerId = marker._id;
    await ctx.db.patch("task_steps", marker._id, { updatedAt: now });
  }
  await crewWorkpool.enqueueAction(
    ctx,
    internal.crew.generators.runCrewGeneratorStep,
    { taskId: task._id, retryMode: "return", markerId, ...(options.resume === true ? { resume: true } : {}) },
    {
      retry: false,
      onComplete: internal.crew.launch.stepDone,
      context: { taskId: task._id, step, actionFailures: options.actionFailures, markerId },
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
    // L1 launch sweep: the sweep settled this work's marker and re-enqueued the step under a new one, so this
    // delivery is for work it judged gone. The new marker's work owns the step; this one frees no slot. A
    // callback enqueued before the sweep shipped has no `markerId`; `isSupersededLaunchWork` reads the task's
    // markers for it instead.
    if (await isSupersededLaunchWork(ctx, task, args.context.markerId)) return null;
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
      case "superseded":
        return null;
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

/** WP76-S1a review m4: a failed email sequence whose draft rows conflict; no retry can help. */
export const EMAIL_DRAFT_CONFLICT_REASON =
  "Your email sequence has more than one draft, or a draft we cannot safely rewrite, so a retry would not help. Contact support.";

/** WP76-S1a: a failed email sequence with no blueprint brief it may use now. */
export const EMAIL_BRIEF_CHANGED_REASON =
  "The blueprint changed. Approve it, or finish its changes, before the email sequence can try again.";

/** WP76-S1a: a failed email sequence with no brand kit it may use now (approved, or the launch rule). */
export const BRAND_KIT_CHANGED_REASON =
  "The brand kit changed. Approve it, or finish its changes, before the email sequence can try again.";

/** WP76-S2a: a failed social pack with no blueprint brief it may use now. */
export const SOCIAL_BRIEF_CHANGED_REASON =
  "The blueprint changed. Approve it, or finish its changes, before the social pack can try again.";

/** WP76-S2a: a failed social pack with no brand kit it may use now (approved, or the launch rule). */
export const SOCIAL_BRAND_KIT_CHANGED_REASON =
  "The brand kit changed. Approve it, or finish its changes, before the social pack can try again.";

/** What each step that briefs from the blueprint says when no brief exists for it now. */
const BRIEF_CHANGED_REASONS: Partial<Record<LaunchStep["jobType"], string>> = {
  crew_brand_kit: BRIEF_CHANGED_REASON,
  crew_email_sequence: EMAIL_BRIEF_CHANGED_REASON,
  crew_social_pack: SOCIAL_BRIEF_CHANGED_REASON,
};

/** What each step that reads the brand kit's voice says when no kit exists for it now. */
const BRAND_KIT_CHANGED_REASONS: Partial<Record<LaunchStep["jobType"], string>> = {
  crew_email_sequence: BRAND_KIT_CHANGED_REASON,
  crew_social_pack: SOCIAL_BRAND_KIT_CHANGED_REASON,
};

/** A step whose parents are done, waiting for one of the owner's crew slots. */
export const WAITING_FOR_SLOT_REASON = "Waiting for a free slot: your team is busy with other work.";

type FailedStep = { readonly step: LaunchStep; readonly retryable: boolean; readonly reason: string };

/**
 * The launch's failed pool steps after the blueprint, in registry order, and
 * whether a retry can help each now. A step reads `failed` only when its
 * parents are all done (`evaluateLaunch`). The brand kit (and, WP76-S1a/S2a,
 * the email sequence and the social pack, which also need a brand kit under
 * the same rule) is
 * retryable only when a brief exists for it now: an approved blueprint, or the launch's own
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
    if (step.jobType === "crew_email_sequence" && !(await emailDraftTarget(ctx, { ownerId: project.ownerId, projectId: project._id })).ok) {
      out.push({ step, retryable: false, reason: EMAIL_DRAFT_CONFLICT_REASON });
      continue;
    }
    const briefReason = BRIEF_CHANGED_REASONS[step.jobType];
    if (briefReason !== undefined) {
      const brief = (await approvedBlueprint(ctx, project)) ?? (await launchDraftBlueprint(ctx, project, now));
      if (brief === null) {
        out.push({ step, retryable: false, reason: briefReason });
        continue;
      }
    }
    // WP76-S1a/S2a: the email sequence and the social pack also need a brand kit they may brief from, under the same rule.
    const kitReason = BRAND_KIT_CHANGED_REASONS[step.jobType];
    if (kitReason !== undefined &&
      (await approvedBrandKit(ctx, project)) === null && (await launchDraftBrandKit(ctx, project, now)) === null) {
      out.push({ step, retryable: false, reason: kitReason });
      continue;
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
// The launch sweep (L1, WP75 Needs from Codex 18)
// ---------------------------------------------------------------------------

/** Businesses read per `recoverStalledLaunches` page. */
export const LAUNCH_SWEEP_PAGE_MAX = 20;

/**
 * How long a running marker on a live `queued` or `running` task must sit
 * with no activity (task, marker or run) before the sweep treats its work as
 * gone: two hours, for both.
 *
 * Without a `workId` the sweep cannot tell work that is gone from work that
 * is late, and work is late whenever the pool is backlogged: every launch
 * step shares `crewWorkpool`'s global cap (`CREW_MAX_PARALLELISM`), and a step
 * action may live ten minutes, so a busy beta can queue a step for tens of
 * minutes. Superseding late work is safe (it skips under its old marker) but
 * sends the step to the back of the queue, so the threshold sits well past
 * any healthy backlog. The running case uses the same threshold, not a
 * shorter one: its next execution (`stepDone`'s re-enqueue) waits in the same
 * FIFO pool, so a backlog delays it just as much, and a false positive there
 * counts toward `LAUNCH_SWEEP_REQUEUES_MAX`. A real strand (a `stepDone`
 * throw) is rare, and two hours of one held slot is the price of never
 * failing a healthy step.
 */
export const STRANDED_MARKER_MS = 2 * 60 * 60 * 1000;

/**
 * Times the sweep re-invokes one running task. The next strand fails the
 * task as interrupted (`abandonCrewTask`, the calm note, a debit refunded by
 * the usual rule), so a step whose re-invokes keep stranding never loops for
 * ever. Queued strands do not count: a queued task has spent nothing (no run),
 * and a long backlog must never fail it, only move it in the queue. The
 * runner's own retry budget (`MAX_RETRY_BUDGET_RUNS`) still bounds the runs.
 */
export const LAUNCH_SWEEP_REQUEUES_MAX = 2;

/**
 * How long a running marker on a terminal task waits before the sweep
 * settles it. `stepDone` settles it promptly after the task ends; one lease
 * is far past that. Settling early would still be safe (the late `stepDone`
 * reads as superseded and the sweep advances the owner itself).
 */
export const LEFTOVER_MARKER_MS = RUN_LEASE_MS;

type Strand = { readonly marker: Doc<"task_steps">; readonly reinvokes: number };

/**
 * The task's running marker when its work is gone, else null. All must hold:
 * the task is live and `queued` or `running` (never parked or terminal); its
 * newest marker is `running`; it has no `running` run; and nothing on the
 * task, the marker or a run moved for `STRANDED_MARKER_MS`. A task with more
 * than `RUN_SCAN_MAX` runs is never judged (its runs cannot be read in full);
 * that cannot happen while the retry budget (`MAX_RETRY_BUDGET_RUNS`) holds,
 * and `startCrewRun` refuses such a task anyway.
 *
 * A `running` task with no open run is a step between executions: a runner
 * retry (return mode) whose `stepDone` threw, or a resumed step whose
 * `stepDone` threw. Its next execution is due within the runner's backoff
 * (at most 30 s, `INDETERMINATE_BACKOFF_MS`) or one lease, plus any backlog.
 *
 * `reinvokes`: the sweep's re-invokes of this task so far. A task never
 * returns to `queued` (`taskTransitions`) and outside the sweep only an
 * enqueue from `queued` creates a marker (`stepDone` and a resume reuse the
 * running one), so a marker created after the task's first run is a sweep
 * re-invoke. Markers from queued strands come before any run and never count.
 */
async function strandedMarker(ctx: ReadCtx, task: Doc<"tasks">, now: number): Promise<Strand | null> {
  if (task.archivedAt !== undefined || (task.status !== "queued" && task.status !== "running")) return null;
  const markers = await launchTaskMarkers(ctx, task);
  const marker = newestOf(markers);
  if (marker === null || marker.status !== "running") return null;
  const runs = await ctx.db.query("workflow_runs")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", task._id))
    .order("desc")
    .take(RUN_SCAN_MAX + 1);
  if (runs.length > RUN_SCAN_MAX || runs.some((run) => run.status === "running")) return null;
  let last = Math.max(task.updatedAt, marker.createdAt, marker.updatedAt);
  let firstRunAt = Number.POSITIVE_INFINITY;
  for (const run of runs) {
    last = Math.max(last, run.createdAt, run.updatedAt, run.startedAt ?? 0, run.completedAt ?? 0);
    firstRunAt = Math.min(firstRunAt, run.createdAt);
  }
  if (now - last < STRANDED_MARKER_MS) return null;
  return { marker, reinvokes: markers.filter((row) => row.createdAt > firstRunAt).length };
}

/**
 * Settles a running marker left on a terminal task (its `stepDone` threw
 * after the task ended) once the task has been still for
 * `LEFTOVER_MARKER_MS`. Returns whether it settled one. Left alone, the
 * marker would keep the business in every sweep and crowd the in-flight scan
 * (`IN_FLIGHT_SCAN_MAX`).
 */
async function settleLeftoverMarker(ctx: MutationCtx, task: Doc<"tasks">, now: number): Promise<boolean> {
  if (task.status !== "succeeded" && task.status !== "failed" && task.status !== "cancelled") return false;
  const marker = await newestMarker(ctx, task);
  if (marker === null || marker.status !== "running") return false;
  if (now - Math.max(task.updatedAt, marker.updatedAt) < LEFTOVER_MARKER_MS) return false;
  await settleMarker(ctx, task, now);
  return true;
}

const ownerSweepResultValidator = v.object({
  /** The owner's `workspace` or `ai` feature is off (switch, kill switch or cohort): nothing was touched. */
  gated: v.boolean(),
  /** Stranded markers on queued tasks, settled so `advanceOwner` enqueues the step again. */
  requeued: v.number(),
  /** Stranded running tasks (between executions) re-invoked under a new marker; they keep the slot they hold. */
  reinvoked: v.number(),
  /** Running tasks failed as interrupted after `LAUNCH_SWEEP_REQUEUES_MAX` re-invokes. */
  abandoned: v.number(),
  /** Leftover running markers on terminal tasks, settled. */
  settled: v.number(),
  /** Steps `advanceOwner` enqueued (requeued ones and any other ready step), under the cap. */
  enqueued: v.number(),
  /** `advanceOwner` threw: it rolled back alone, and the settles and re-invokes above still committed. */
  advanceFailed: v.boolean(),
});

type OwnerSweepResult = Infer<typeof ownerSweepResultValidator>;

/**
 * The sweep's `advanceOwner`, in its own subtransaction (`recoverStalledOwner`
 * catches a throw, so a failing advance never rolls back the recovery before
 * it). Returns the number of steps enqueued. No token.
 */
export const advanceSweptOwner = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => await advanceOwner(ctx, args.ownerId, Date.now()),
});

/**
 * One owner's share of the sweep, scheduled by `recoverStalledLaunches` (its
 * own transaction, so one owner never stops or bloats the page). Gates
 * first: with the owner's `workspace` or `ai` feature off (or the owner out of
 * cohort) it writes nothing. Then, for each pool step of the owner's live
 * launches: a leftover running marker on a terminal task is settled; a
 * stranded marker on a queued task is settled `failed` and the step left to
 * `advanceOwner` (the only enqueuer of fresh work, under `OWNER_CREW_CAP`,
 * with the revision-0 job-key rules); a stranded running task already holds
 * its slot, so it is re-enqueued at once under a new marker, as `stepDone`
 * would have, or, past `LAUNCH_SWEEP_REQUEUES_MAX` re-invokes, fails as
 * interrupted. Last, `advanceOwner` runs in its own subtransaction. No token,
 * no charge.
 *
 * Idempotent and safe to overlap with itself, `stepDone` and
 * `recoverStaleCrewRuns`: every condition is re-read here, mutations are
 * serializable, and a second pass finds the markers it would act on already
 * settled or freshly touched. `recoverStaleCrewRuns` acts only on a task with
 * a `running` run, which this skips.
 */
export const recoverStalledOwner = internalMutation({
  args: { ownerId: v.id("users") },
  returns: ownerSweepResultValidator,
  handler: async (ctx, args): Promise<OwnerSweepResult> => {
    const now = Date.now();
    const out: OwnerSweepResult = {
      gated: false, requeued: 0, reinvoked: 0, abandoned: 0, settled: 0, enqueued: 0, advanceFailed: false,
    };
    try {
      await assertFeatureEnabledForOwner(ctx, "workspace", args.ownerId);
      await assertFeatureEnabledForOwner(ctx, "ai", args.ownerId);
    } catch {
      return { ...out, gated: true };
    }
    for (const project of await ownerProjects(ctx, args.ownerId)) {
      if ((await launchRosterTask(ctx, args.ownerId, project._id)) === null) continue;
      for (const step of LAUNCH_STEPS) {
        if (!isPoolStep(step)) continue;
        const task = await stepTask(ctx, project, step.key);
        if (task === null) continue;
        if (await settleLeftoverMarker(ctx, task, now)) {
          out.settled += 1;
          continue;
        }
        const strand = await strandedMarker(ctx, task, now);
        if (strand === null) continue;
        if (task.status === "queued") {
          await ctx.db.patch("task_steps", strand.marker._id, { status: assertStepTransition("running", "failed"), updatedAt: now });
          out.requeued += 1;
          continue;
        }
        if (strand.reinvokes >= LAUNCH_SWEEP_REQUEUES_MAX) {
          if (await abandonCrewTask(ctx, task._id, now)) {
            const failed = await ctx.db.get("tasks", task._id);
            if (failed !== null) await settleMarker(ctx, failed, now);
            out.abandoned += 1;
          }
          continue;
        }
        await ctx.db.patch("task_steps", strand.marker._id, { status: assertStepTransition("running", "failed"), updatedAt: now });
        // A running task already counts toward the cap, so its re-invoke adds no slot: the same re-enqueue
        // `stepDone` makes, under a NEW marker, so late work (or a late `stepDone`) is fenced out.
        // `startCrewRun` then applies the retry budget (`MAX_RETRY_BUDGET_RUNS`, `mayRetryAfterAbandoned`) and
        // fails the task closed, before any gateway call, when it is spent.
        await enqueueLaunchStep(ctx, task, step.key, { actionFailures: 0 }, now);
        out.reinvoked += 1;
      }
    }
    try {
      out.enqueued = await ctx.runMutation(internal.crew.launch.advanceSweptOwner, { ownerId: args.ownerId });
    } catch {
      // Rolled back alone; the recovery above stands, and the next sweep (or any `stepDone`) advances again.
      out.advanceFailed = true;
    }
    return out;
  },
});

const sweepPageResultValidator = v.object({
  /** Businesses read on this page. */
  businesses: v.number(),
  /** Distinct owners with a live workspace business on this page, each given a `recoverStalledOwner`. */
  owners: v.number(),
  isDone: v.boolean(),
});

type SweepPageResult = Infer<typeof sweepPageResultValidator>;

/**
 * The launch sweep (L1; WP75 Needs from Codex 18). No args for the cron.
 *
 * Reads one page of `projects` only (`LAUNCH_SWEEP_PAGE_MAX`, by creation
 * time; there is no index on launch state, see the WP75 progress note) and
 * schedules `recoverStalledOwner` once for each distinct owner with a live
 * business that has a workspace. A page that is not the last schedules the
 * next one with its cursor. So one call reads at most a page of projects and
 * writes at most a page of scheduled jobs, whatever the owners hold, and one
 * owner's failure (a throw, or a limit) is that owner's job alone. An owner
 * whose businesses span pages is scheduled more than once; the owner job is
 * idempotent.
 *
 * Safe to overlap with itself, `stepDone` and `recoverStaleCrewRuns` (see
 * `recoverStalledOwner`). It never spends a `crewJob` token, never debits,
 * and refunds only through `abandonCrewTask`'s usual rule (DAG first drafts
 * carry no debit).
 */
export const recoverStalledLaunches = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  returns: sweepPageResultValidator,
  handler: async (ctx, args): Promise<SweepPageResult> => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? LAUNCH_SWEEP_PAGE_MAX), LAUNCH_SWEEP_PAGE_MAX));
    const page = await ctx.db.query("projects").paginate({ numItems: limit, cursor: args.cursor ?? null });
    const owners = new Set<Id<"users">>();
    for (const project of page.page) {
      if (project.archivedAt === undefined && project.workspace !== undefined) owners.add(project.ownerId);
    }
    for (const ownerId of owners) {
      await ctx.scheduler.runAfter(0, internal.crew.launch.recoverStalledOwner, { ownerId });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crew.launch.recoverStalledLaunches, { cursor: page.continueCursor, limit });
    }
    return { businesses: page.page.length, owners: owners.size, isDone: page.isDone };
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
    /** The role that owns the step (`LAUNCH_STEPS[].employee`). */
    employee: v.union(...ROLE_KEYS.map((role) => v.literal(role))),
    /** True when the step has no generator yet, so it reads "Coming soon", never "Queued". */
    notBuilt: v.boolean(),
    state: stepStateValidator,
    reason: v.optional(v.string()),
    /** Set on a failed step: whether a Try again can help it now. */
    retryable: v.optional(v.boolean()),
  })),
});

export type LaunchProgressStep = {
  key: LaunchStepKey;
  title: string;
  employee: RoleKey;
  notBuilt: boolean;
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
      const definition = launchStep(entry.key);
      return {
        key: entry.key,
        title: definition.title,
        employee: definition.employee,
        notBuilt: definition.status !== "built",
        state,
        ...(reason === undefined ? {} : { reason }),
        ...(failure === undefined ? {} : { retryable: failure.retryable }),
      };
    });
    return { started: true, retryable: [...failed.values()].some((entry) => entry.retryable), steps };
  },
});
