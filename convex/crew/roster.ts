import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { checkLimit } from "../platform/limits";
import { pendingLaunchView, readyLaunchView, type LaunchView } from "../../lib/workspace/crew/launch";
import type { RosterPlan } from "../../lib/workspace/contracts/roster";
import { approvedBlueprint, insertCrewTask } from "./jobs";
import {
  insertLaunchRosterTask,
  launchRosterTask,
  launchRosterPlan,
  launchWizardAnswers,
  newestBlueprintFirstDraft,
  storedRosterPlan,
  writeLaunchRoster,
} from "./launchRoster";

/**
 * WP75-S1 — the launch, as Meet your co-founder starts and reads it.
 *
 * Owner rulings (`docs/wp/RULINGS.md`, 2026-11-06):
 * - roster profile source, blueprint first: `startLaunch` starts the
 *   blueprint step (S3a's `crew_blueprint` generator through S2a's runner, in
 *   schedule mode), and `finishCrewStep` plans the roster from the stored
 *   blueprint's `profile` in the same transaction (`./launchRoster.ts`);
 * - C-LIMITS `crewJob`, one token per founder action: a launch spends one, a
 *   retry the founder starts spends one, the steps a launch runs on its own
 *   spend none;
 * - Q13, no `artifact_review` card for the roster: the team just appears.
 *
 * Tokens. `insertCrewTask` still checks `crewJob` once per task it inserts
 * (S2b moves that check). A launch inserts exactly one such task (the
 * blueprint's first draft); the roster task is inserted directly and the
 * roster is written by the blueprint's finish, so neither spends one. When the
 * blueprint's first draft already exists (so `insertCrewTask` inserts nothing
 * and spends nothing), the launch spends its one token itself.
 *
 * Every function checks, in order: the `workspace` feature, the `ai` feature,
 * then owner access to a live business (`requireBusinessAccess` refuses an
 * archived one). A refusal writes nothing.
 */

const roleValidator = v.object({
  roleKey: v.string(),
  employeeName: v.string(),
  roleLabel: v.string(),
  reason: v.string(),
});

const skippedRoleValidator = v.object({ roleKey: v.string(), roleLabel: v.string(), reason: v.string() });

export const launchViewValidator = v.union(
  v.object({ state: v.literal("not_started") }),
  v.object({ state: v.literal("assembling") }),
  v.object({ state: v.literal("failed"), paused: v.boolean(), retryable: v.boolean() }),
  v.object({ state: v.literal("ready"), hired: v.array(roleValidator), skipped: v.array(skippedRoleValidator) }),
);

type Ctx = Pick<QueryCtx, "db">;

/**
 * The blueprint a launch plans its team from when the blueprint step has
 * already succeeded: the newest blueprint the founder approved (S3a's
 * `approvedBlueprint`, so a newer approved revision wins), else the first
 * draft's own document.
 */
async function launchBlueprintBody(ctx: Ctx, project: Doc<"projects">, firstDraft: Doc<"tasks">): Promise<string | null> {
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
async function planFromSucceededBlueprint(ctx: Ctx, project: Doc<"projects">, firstDraft: Doc<"tasks">): Promise<RosterPlan | null> {
  const body = await launchBlueprintBody(ctx, project, firstDraft);
  return body === null ? null : await launchRosterPlan(ctx, project, body);
}

/** What Meet your co-founder shows for the business now. */
async function readLaunch(ctx: Ctx, project: Doc<"projects">): Promise<LaunchView> {
  const rosterTask = await launchRosterTask(ctx, project.ownerId, project._id);
  if (rosterTask === null) return { state: "not_started" };
  if (rosterTask.status === "succeeded") {
    const plan = await storedRosterPlan(ctx, rosterTask);
    // A succeeded roster task always wrote its document in the same transaction. A missing or invalid one reads
    // as a failure no retry can fix, never as an empty team.
    return plan === null ? { state: "failed", paused: false, retryable: false } : readyLaunchView(plan);
  }
  const blueprint = await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
  if (blueprint?.status === "succeeded") {
    // The blueprint is stored but the team is not: a free re-plan can heal it only when it plans now.
    return { state: "failed", paused: false, retryable: (await planFromSucceededBlueprint(ctx, project, blueprint)) !== null };
  }
  const pending = pendingLaunchView(blueprint?.status ?? null);
  // A new or resumed blueprint cannot help a business whose wizard answers are unusable: its finish would fail
  // closed again, so the page offers no retry (and `retryLaunch` spends nothing).
  if (pending.state === "failed" && (await launchWizardAnswers(ctx, project)) === null) return { ...pending, retryable: false };
  return pending;
}

/** Schedules the blueprint generator step (S2a schedule mode: the runner re-invokes its own retries). */
async function scheduleBlueprint(ctx: MutationCtx, blueprint: Doc<"tasks">, resume = false): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.crew.generators.runCrewGeneratorStep, {
    taskId: blueprint._id,
    ...(resume ? { resume: true } : {}),
  });
}

/**
 * Plans and writes the team from a blueprint that already succeeded. No
 * gateway call and no token: it is deterministic, so repeating it costs
 * nothing, and a plan that cannot be made writes nothing. It also heals a
 * roster task left open beside an existing plan row (`writeLaunchRoster`).
 */
async function rosterFromSucceededBlueprint(ctx: MutationCtx, project: Doc<"projects">, firstDraft: Doc<"tasks">): Promise<void> {
  const rosterTask = await launchRosterTask(ctx, project.ownerId, project._id);
  if (rosterTask === null) return;
  const plan = await planFromSucceededBlueprint(ctx, project, firstDraft);
  if (plan !== null) await writeLaunchRoster(ctx, rosterTask, plan, Date.now());
}

/**
 * Starts (or continues) work on a blueprint first draft that is already
 * there. A queued or paused draft needs the caller to have spent the action's
 * token; a succeeded one never does.
 */
async function continueBlueprint(ctx: MutationCtx, project: Doc<"projects">, blueprint: Doc<"tasks">): Promise<void> {
  switch (blueprint.status) {
    case "queued":
      // Not running yet: schedule it. A second schedule is harmless (`startCrewRun` skips work in flight).
      await scheduleBlueprint(ctx, blueprint);
      return;
    case "blocked":
      await scheduleBlueprint(ctx, blueprint, true);
      return;
    case "succeeded":
      await rosterFromSucceededBlueprint(ctx, project, blueprint);
      return;
    case "running":
    case "failed":
    case "cancelled":
      return;
  }
}

/**
 * Meet your co-founder calls this after `createBusiness` returns. The first
 * call inserts the launch's roster task and the blueprint's first draft and
 * schedules the blueprint step; it spends one `crewJob` token. Any later call
 * spends nothing and never retries a failed blueprint (only `retryLaunch`,
 * the founder's button, does), so a page reload never spends a token. The one
 * write a later call may make is free: an open launch whose blueprint already
 * succeeded gets its team planned now.
 */
export const startLaunch = mutation({
  args: { projectId: v.id("projects") },
  returns: launchViewValidator,
  handler: async (ctx, args): Promise<LaunchView> => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const launched = await launchRosterTask(ctx, project.ownerId, project._id);
    if (launched !== null) {
      // An open launch whose blueprint already succeeded gets its team now, for free (no token, no call).
      if (launched.status === "queued" || launched.status === "running") {
        const latest = await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
        if (latest?.status === "succeeded") await rosterFromSucceededBlueprint(ctx, project, latest);
      }
      return await readLaunch(ctx, project);
    }

    const now = Date.now();
    await insertLaunchRosterTask(ctx, project.ownerId, project._id, now);
    const inserted = await insertCrewTask(ctx, { ownerId: project.ownerId, projectId: project._id, jobType: "crew_blueprint" });
    const blueprint = await ctx.db.get("tasks", inserted.taskId);
    if (blueprint === null) throw new ConvexError({ code: "CREW_TASK_CONFLICT" });
    if (inserted.created) {
      await scheduleBlueprint(ctx, blueprint);
    } else {
      // The insert returned an existing first draft and spent nothing; the launch is still one founder action.
      await checkLimit(ctx, "crewJob", project.ownerId);
      await continueBlueprint(ctx, project, blueprint);
    }
    return await readLaunch(ctx, project);
  },
});

/**
 * The founder's Retry on Meet your co-founder, after the blueprint failed (or
 * was paused). Spends one `crewJob` token and inserts a new blueprint first
 * draft (`insertCrewTask`), or resumes a paused one. A blueprint that
 * succeeded with no team is re-planned for free (no token, no call); if it
 * still cannot be planned, nothing is written and the state says no retry
 * helps (`retryable: false`). Likewise, when the business's wizard answers
 * are unusable, no new or resumed blueprint could plan a team, so it spends
 * and writes nothing and returns `retryable: false`. While the blueprint is queued or running, or
 * once the team exists, it returns the launch as it stands and writes and
 * spends nothing. Refuses `LAUNCH_NOT_STARTED` before a launch.
 */
export const retryLaunch = mutation({
  args: { projectId: v.id("projects") },
  returns: launchViewValidator,
  handler: async (ctx, args): Promise<LaunchView> => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const rosterTask = await launchRosterTask(ctx, project.ownerId, project._id);
    if (rosterTask === null) throw new ConvexError({ code: "LAUNCH_NOT_STARTED" });
    if (rosterTask.status !== "queued" && rosterTask.status !== "running") return await readLaunch(ctx, project);

    const latest = await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
    if (latest !== null && (latest.status === "queued" || latest.status === "running")) return await readLaunch(ctx, project);
    if (latest !== null && latest.status === "succeeded") {
      // Free: re-planning costs nothing, so a team that still cannot be planned never burns a token per click.
      await rosterFromSucceededBlueprint(ctx, project, latest);
      return await readLaunch(ctx, project);
    }
    // Nothing a token buys can plan a team without usable answers: spend and write nothing.
    if ((await launchWizardAnswers(ctx, project)) === null) return await readLaunch(ctx, project);
    if (latest !== null && latest.status === "blocked") {
      await checkLimit(ctx, "crewJob", project.ownerId);
      await continueBlueprint(ctx, project, latest);
      return await readLaunch(ctx, project);
    }

    // Failed, cancelled or missing: a new first draft (one token, spent by the insert).
    const inserted = await insertCrewTask(ctx, { ownerId: project.ownerId, projectId: project._id, jobType: "crew_blueprint" });
    const blueprint = await ctx.db.get("tasks", inserted.taskId);
    if (blueprint === null) throw new ConvexError({ code: "CREW_TASK_CONFLICT" });
    if (inserted.created) {
      await scheduleBlueprint(ctx, blueprint);
    } else {
      // Defensive: the insert found a live or succeeded first draft (it spent nothing). Only work that runs again
      // spends the founder's token.
      if (blueprint.status !== "succeeded") await checkLimit(ctx, "crewJob", project.ownerId);
      await continueBlueprint(ctx, project, blueprint);
    }
    return await readLaunch(ctx, project);
  },
});

/** The launch state for Meet your co-founder: not started, putting the team together, failed (retry), or the team. */
export const launchStatus = query({
  args: { projectId: v.id("projects") },
  returns: launchViewValidator,
  handler: async (ctx, args): Promise<LaunchView> => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    return await readLaunch(ctx, project);
  },
});
