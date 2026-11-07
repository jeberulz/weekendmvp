import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertTaskTransition } from "../platform/transitions";
import { assertGeneratedDocumentBody } from "../platform/validators";
import { blueprintSchema } from "../../lib/workspace/contracts/artifacts";
import { JOB_SUBJECT_MAIN, jobKey } from "../../lib/workspace/contracts/jobs";
import { rosterPlanSchema, type RosterPlan } from "../../lib/workspace/contracts/roster";
import {
  partnerNameFromWizard,
  rosterInputFromWizard,
  wizardAnswersSchema,
  type WizardAnswers,
} from "../../lib/workspace/contracts/wizard";
import { ROSTER_DOCUMENT_TITLE, ROSTER_TASK_TITLE, rosterMemberRows } from "../../lib/workspace/crew/launch";
import type { CrewStepJobType } from "../../lib/workspace/crew/tasks";
import { planRoster } from "./roles";

/**
 * WP75-S1 — the launch's roster, as helpers (no registered functions), so
 * `finishCrewStep` (`./jobs.ts`) and the founder-facing launch mutations
 * (`./roster.ts`) share them without importing each other.
 *
 * How a launch is identified, with no schema change: `startLaunch` inserts the
 * business's `crew_roster` task (job key `crew:{projectId}:crew_roster:main:0`,
 * status `queued`) next to the blueprint's first draft. That task is the
 * launch. When a first-draft blueprint (round 0, not a revision) succeeds and
 * the launch's roster task is still open, `finishCrewStep` plans the roster in
 * the same transaction: the roster task goes queued → running → succeeded, and
 * the plan, crew, workstreams and roster document are written. A succeeded
 * roster task, or an existing `roster_plans` row, means the roster is written:
 * a replay writes nothing. A blueprint that was not started by a launch (no
 * roster task) never plans a roster.
 */

type Ctx = Pick<QueryCtx, "db">;

/** Rows read per exact job key; a launch writes one roster task and a handful of blueprint first drafts. */
const KEY_HOLDERS_READ_MAX = 50;

export function rosterTaskKey(projectId: Id<"projects">): string {
  return jobKey(projectId, "crew_roster", JOB_SUBJECT_MAIN, 0);
}

export function blueprintFirstDraftKey(projectId: Id<"projects">): string {
  return jobKey(projectId, "crew_blueprint", JOB_SUBJECT_MAIN, 0);
}

/** The newest task holding an exact job key for this business and type, or null. */
async function newestHolder(
  ctx: Ctx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  key: string,
  type: Doc<"tasks">["type"],
): Promise<Doc<"tasks"> | null> {
  const rows = await ctx.db.query("tasks")
    .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", ownerId).eq("jobKey", key))
    .order("desc")
    .take(KEY_HOLDERS_READ_MAX);
  return rows.find((row) => row.projectId === projectId && row.type === type && row.archivedAt === undefined) ?? null;
}

/** The launch: the business's `crew_roster` task, or null when no launch has started. */
export async function launchRosterTask(ctx: Ctx, ownerId: Id<"users">, projectId: Id<"projects">): Promise<Doc<"tasks"> | null> {
  return await newestHolder(ctx, ownerId, projectId, rosterTaskKey(projectId), "crew_roster");
}

/** The newest blueprint first draft (round 0) of the business, or null. */
export async function newestBlueprintFirstDraft(ctx: Ctx, ownerId: Id<"users">, projectId: Id<"projects">): Promise<Doc<"tasks"> | null> {
  return await newestHolder(ctx, ownerId, projectId, blueprintFirstDraftKey(projectId), "crew_blueprint");
}

/** WP76-S1a: the newest first draft (round 0, revision-0 key) of a crew step for the business, or null. */
export async function newestFirstDraft(
  ctx: Ctx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  jobType: CrewStepJobType,
): Promise<Doc<"tasks"> | null> {
  return await newestHolder(ctx, ownerId, projectId, jobKey(projectId, jobType, JOB_SUBJECT_MAIN, 0), jobType);
}

/** WP76-S1a: whether a task is the first draft of `jobType` (round 0, not a revision, the revision-0 key). */
export function isFirstDraftOf(task: Doc<"tasks">, jobType: CrewStepJobType): boolean {
  return task.type === jobType && task.revisionOfTaskId === undefined && (task.changeRound ?? 0n) === 0n &&
    task.jobKey === jobKey(task.projectId, jobType, JOB_SUBJECT_MAIN, 0);
}

/** The launch's roster task, inserted `queued` by `startLaunch`. No gateway call, no credits, no limiter token. */
export async function insertLaunchRosterTask(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  now: number,
): Promise<Id<"tasks">> {
  const key = rosterTaskKey(projectId);
  return await ctx.db.insert("tasks", {
    ownerId,
    projectId,
    type: "crew_roster",
    status: "queued",
    title: ROSTER_TASK_TITLE,
    creditCost: 0n,
    changeRound: 0n,
    jobKey: key,
    idempotencyKey: `crew-task:${key}`,
    createdAt: now,
    updatedAt: now,
  });
}

/** Whether a blueprint task is a launch's first draft (round 0, not a revision). */
export function isBlueprintFirstDraft(task: Doc<"tasks">): boolean {
  return isFirstDraftOf(task, "crew_blueprint");
}

/** The roster task still waiting for its blueprint, when the launch has one. */
export async function openLaunchRosterTask(ctx: Ctx, task: Doc<"tasks">): Promise<Doc<"tasks"> | null> {
  if (!isBlueprintFirstDraft(task)) return null;
  const roster = await launchRosterTask(ctx, task.ownerId, task.projectId);
  return roster !== null && (roster.status === "queued" || roster.status === "running") ? roster : null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The business's own finished wizard answers (linked to this project, never
 * abandoned, valid C-WIZARD answers), or null. Without them no team can be
 * planned, whatever the blueprint says.
 */
export async function launchWizardAnswers(ctx: Ctx, project: Doc<"projects">): Promise<WizardAnswers | null> {
  const workspace = project.workspace;
  if (workspace === undefined) return null;
  const session = await ctx.db.get("wizard_sessions", workspace.wizardSessionId);
  if (session === null || session.ownerId !== project.ownerId || session.projectId !== project._id || session.abandonedAt !== undefined) {
    return null;
  }
  const answers = wizardAnswersSchema.safeParse(session.answers);
  return answers.success ? answers.data : null;
}

/**
 * The roster for a stored blueprint (C-WIZARD `rosterInputFromWizard`, then
 * `planRoster` with the founder's partner name as the Crew Lead). Null when it
 * cannot be planned (the session's answers are missing or do not match the
 * blueprint); the caller fails closed and writes nothing.
 */
export async function planLaunchRoster(ctx: Ctx, project: Doc<"projects">, blueprintBody: string): Promise<RosterPlan | null> {
  const answers = await launchWizardAnswers(ctx, project);
  const blueprint = blueprintSchema.safeParse(parseJson(blueprintBody));
  if (answers === null || !blueprint.success) return null;
  try {
    return planRoster(rosterInputFromWizard(answers, blueprint.data), { leadName: partnerNameFromWizard(answers) });
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The business's roster plan row, when one is written. */
export async function rosterPlanRow(ctx: Ctx, ownerId: Id<"users">, projectId: Id<"projects">): Promise<Doc<"roster_plans"> | null> {
  return await ctx.db.query("roster_plans")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId))
    .first();
}

/**
 * Whether a plan is the one a stored `roster_plans` row records: the same
 * rules version, the same hired role keys in order, and the same skipped
 * roles with the same reasons in order. The row holds no names or labels, so
 * a heal can only write from a fresh plan that matches it exactly.
 */
export function rosterPlanMatchesRow(plan: RosterPlan, row: Doc<"roster_plans">): boolean {
  if (plan.rulesVersion !== row.rulesVersion) return false;
  if (plan.hired.length !== row.hired.length || plan.skipped.length !== row.skipped.length) return false;
  if (plan.hired.some((entry, index) => entry.roleKey !== row.hired[index])) return false;
  return plan.skipped.every((entry, index) =>
    entry.roleKey === row.skipped[index]?.roleKey && entry.reason === row.skipped[index]?.reason);
}

/**
 * The roster a launch may write from a blueprint: `planLaunchRoster`, but null
 * when the business already has a `roster_plans` row the plan does not match
 * (a half-finished launch heals only from the team it already chose).
 */
export async function launchRosterPlan(ctx: Ctx, project: Doc<"projects">, blueprintBody: string): Promise<RosterPlan | null> {
  const plan = await planLaunchRoster(ctx, project, blueprintBody);
  if (plan === null) return null;
  const row = await rosterPlanRow(ctx, project.ownerId, project._id);
  return row === null || rosterPlanMatchesRow(plan, row) ? plan : null;
}

/** The roster document (`roster_plan`, the full plan) the roster task wrote, parsed; null when absent or invalid. */
export async function storedRosterPlan(ctx: Ctx, rosterTask: Doc<"tasks">): Promise<RosterPlan | null> {
  const document = await ctx.db.query("documents")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", rosterTask._id))
    .order("desc")
    .first();
  if (document === null || document.ownerId !== rosterTask.ownerId || document.projectId !== rosterTask.projectId ||
    document.kind !== "roster_plan" || document.archivedAt !== undefined || document.body === undefined) {
    return null;
  }
  const parsed = rosterPlanSchema.safeParse(parseJson(document.body));
  return parsed.success ? parsed.data : null;
}

/**
 * Writes the roster in the caller's transaction: the roster task succeeded,
 * `roster_plans`, one `crew_members` row per role (hired `queued`, skipped
 * `skipped`; by rule, autopilot off), one `workstreams` row per hired
 * specialist, and the `roster_plan` document. No approval card (owner ruling
 * Q13).
 *
 * Idempotent:
 * - a roster task that is not open (already `succeeded`) writes nothing
 *   (`exists`);
 * - an open task whose plan row already exists (a half-finished launch) is
 *   healed (`healed`) only from that row's team: the plan must match the row
 *   (`rosterPlanMatchesRow`), the row is kept as it is, missing members,
 *   workstreams and the document are added, and the task is finished;
 * - a plan that does not match an existing row writes nothing and leaves the
 *   task open (`conflict`), so a heal never mixes two teams;
 * - a role that already has a member row keeps it (never a duplicate), a
 *   member that already has a workstream keeps it, and a task that already
 *   has its roster document keeps it.
 */
export async function writeLaunchRoster(
  ctx: MutationCtx,
  rosterTask: Doc<"tasks">,
  rawPlan: RosterPlan,
  now: number,
): Promise<"written" | "healed" | "exists" | "conflict"> {
  if (rosterTask.type !== "crew_roster" || (rosterTask.status !== "queued" && rosterTask.status !== "running")) return "exists";
  const { ownerId, projectId } = rosterTask;
  const existingPlan = await rosterPlanRow(ctx, ownerId, projectId);
  const plan = rosterPlanSchema.parse(rawPlan);
  if (existingPlan !== null && !rosterPlanMatchesRow(plan, existingPlan)) return "conflict";

  if (rosterTask.status === "queued") assertTaskTransition("queued", "running");
  assertTaskTransition("running", "succeeded");
  await ctx.db.patch("tasks", rosterTask._id, { status: "succeeded", updatedAt: now });

  if (existingPlan === null) {
    await ctx.db.insert("roster_plans", {
      ownerId,
      projectId,
      rulesVersion: plan.rulesVersion,
      hired: plan.hired.map((entry) => entry.roleKey),
      skipped: plan.skipped.map((entry) => ({ roleKey: entry.roleKey, reason: entry.reason })),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const row of rosterMemberRows(plan)) {
    const existing = (await ctx.db.query("crew_members")
      .withIndex("by_projectId_and_roleKey", (q) => q.eq("projectId", projectId).eq("roleKey", row.roleKey))
      .take(4)).find((member) => member.ownerId === ownerId) ?? null;
    const memberId = existing?._id ?? await ctx.db.insert("crew_members", {
      ownerId,
      projectId,
      roleKey: row.roleKey,
      displayName: row.displayName,
      status: row.status,
      hiredBy: "rule",
      autopilot: false,
      createdAt: now,
      updatedAt: now,
    });
    if (row.workstreamTitle === null) continue;
    const workstream = await ctx.db.query("workstreams")
      .withIndex("by_projectId_and_employeeId", (q) => q.eq("projectId", projectId).eq("employeeId", memberId))
      .first();
    if (workstream !== null) continue;
    await ctx.db.insert("workstreams", {
      ownerId,
      projectId,
      employeeId: memberId,
      title: row.workstreamTitle,
      status: "queued",
      documentIds: [],
      fileIds: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  const storedDocument = await ctx.db.query("documents")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", rosterTask._id))
    .first();
  if (storedDocument !== null) return existingPlan === null ? "written" : "healed";
  const body = assertGeneratedDocumentBody(JSON.stringify(plan));
  await ctx.db.insert("documents", {
    ownerId,
    projectId,
    taskId: rosterTask._id,
    kind: "roster_plan",
    format: "json",
    title: ROSTER_DOCUMENT_TITLE,
    schemaVersion: "1",
    body,
    contentSha256: await sha256Hex(body),
    createdAt: now,
    updatedAt: now,
  });
  return existingPlan === null ? "written" : "healed";
}
