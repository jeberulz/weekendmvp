import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { checkLimit } from "../platform/limits";
import { readyLaunchView, type LaunchView } from "../../lib/workspace/crew/launch";
import { insertCrewTask } from "./jobs";
import {
  advanceOwner,
  openLaunchRetry,
  planFromSucceededBlueprint,
  resumeLaunchSteps,
  retryFailedLaunchSteps,
} from "./launch";
import {
  insertLaunchRosterTask,
  launchRosterTask,
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
 *   blueprint step (S3a's `crew_blueprint` generator through S2a's runner),
 *   and `finishCrewStep` plans the roster from the stored blueprint's
 *   `profile` in the same transaction (`./launchRoster.ts`);
 * - C-LIMITS `crewJob`, one token per founder action: a launch spends one, a
 *   retry the founder starts spends one, the steps a launch runs on its own
 *   spend none;
 * - Q13, no `artifact_review` card for the roster: the team just appears.
 *
 * S2b: the blueprint is the DAG's first step on `crewWorkpool`
 * (`./launch.ts`): these mutations insert tasks and call `advanceOwner`,
 * which enqueues what is ready within the owner's cap; `stepDone` re-invokes
 * retries. Tokens are spent here, exactly once per founder action
 * (`insertCrewTask` spends none since S2b).
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
  // Before the team exists, `openLaunchRetry` (shared with `launchProgress`) says whether a Try again can help.
  const open = await openLaunchRetry(ctx, project);
  return open.failed ? { state: "failed", paused: open.paused, retryable: open.retryable } : { state: "assembling" };
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
 * Meet your co-founder calls this after `createBusiness` returns. The first
 * call inserts the launch's roster task and the blueprint's first draft,
 * spends one `crewJob` token and enqueues the blueprint step (`advanceOwner`).
 * Any later call spends nothing and never retries a failed blueprint (only
 * `retryLaunch`, the founder's button, does), so a page reload never spends a
 * token. A later call's writes are free: an open launch whose blueprint
 * already succeeded gets its team planned now, and `advanceOwner` enqueues
 * whatever is ready and fits the owner's cap.
 */
export const startLaunch = mutation({
  args: { projectId: v.id("projects") },
  returns: launchViewValidator,
  handler: async (ctx, args): Promise<LaunchView> => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const now = Date.now();
    const launched = await launchRosterTask(ctx, project.ownerId, project._id);
    if (launched !== null) {
      // An open launch whose blueprint already succeeded gets its team now, for free (no token, no call).
      if (launched.status === "queued" || launched.status === "running") {
        const latest = await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
        if (latest?.status === "succeeded") await rosterFromSucceededBlueprint(ctx, project, latest);
      }
      await advanceOwner(ctx, project.ownerId, now, project);
      return await readLaunch(ctx, project);
    }

    // The launch is the founder's one action: one token, whatever the blueprint's state.
    await checkLimit(ctx, "crewJob", project.ownerId);
    await insertLaunchRosterTask(ctx, project.ownerId, project._id, now);
    const inserted = await insertCrewTask(ctx, { ownerId: project.ownerId, projectId: project._id, jobType: "crew_blueprint" });
    const blueprint = await ctx.db.get("tasks", inserted.taskId);
    if (blueprint === null) throw new ConvexError({ code: "CREW_TASK_CONFLICT" });
    if (blueprint.status === "succeeded") await rosterFromSucceededBlueprint(ctx, project, blueprint);
    if (blueprint.status === "blocked") {
      // A first draft parked before the launch: the launch's token resumes it (no second token).
      const rosterTask = await launchRosterTask(ctx, project.ownerId, project._id);
      if (rosterTask !== null) await resumeLaunchSteps(ctx, project, rosterTask, now, { tokenSpent: true });
    }
    await advanceOwner(ctx, project.ownerId, now, project);
    return await readLaunch(ctx, project);
  },
});

/**
 * The founder's Retry on Meet your co-founder, after the blueprint failed (or
 * was paused). Spends one `crewJob` token and inserts a new blueprint first
 * draft (`insertCrewTask`), or resumes a paused one (`resumeLaunchSteps`). A
 * blueprint that succeeded with no team is re-planned for free (no token, no
 * call); if it still cannot be planned, nothing is written and the state says
 * no retry helps (`retryable: false`). Likewise, when the business's wizard
 * answers are unusable, no new or resumed blueprint could plan a team, so it
 * spends and writes nothing and returns `retryable: false`. While the
 * blueprint is queued or running, or once the team exists, it returns the
 * launch as it stands and writes and spends nothing. Once the team exists
 * (S2b review M1), Try again re-runs the launch's failed steps
 * (`retryFailedLaunchSteps`): one token per click for every step it retries,
 * none when no failed step can be helped (a brand kit whose blueprint changed
 * says why through `launchProgress`); a paused step is resumed by
 * `resumeLaunch` instead. Refuses `LAUNCH_NOT_STARTED` before a launch.
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
    const now = Date.now();
    if (rosterTask.status === "succeeded") {
      await retryFailedLaunchSteps(ctx, project, rosterTask, now);
      return await readLaunch(ctx, project);
    }
    if (rosterTask.status !== "queued" && rosterTask.status !== "running") return await readLaunch(ctx, project);

    const latest = await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
    if (latest !== null && (latest.status === "queued" || latest.status === "running")) return await readLaunch(ctx, project);
    if (latest !== null && latest.status === "succeeded") {
      // Free: re-planning costs nothing, so a team that still cannot be planned never burns a token per click.
      await rosterFromSucceededBlueprint(ctx, project, latest);
      await advanceOwner(ctx, project.ownerId, now, project);
      return await readLaunch(ctx, project);
    }
    // Nothing a token buys can plan a team without usable answers: spend and write nothing.
    if ((await launchWizardAnswers(ctx, project)) === null) return await readLaunch(ctx, project);
    if (latest !== null && latest.status === "blocked") {
      // One token when it resumes; none when the owner's cap leaves no room (it stays paused).
      await resumeLaunchSteps(ctx, project, rosterTask, now);
      return await readLaunch(ctx, project);
    }

    // Failed, cancelled or missing: a new first draft, for the founder's one token.
    await checkLimit(ctx, "crewJob", project.ownerId);
    await insertCrewTask(ctx, { ownerId: project.ownerId, projectId: project._id, jobType: "crew_blueprint" });
    await advanceOwner(ctx, project.ownerId, now, project);
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
