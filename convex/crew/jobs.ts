import { ConvexError, v, type Infer, type ObjectType } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabledForOwner } from "../ops/settings";
import { requireBusinessForOwner } from "../platform/authz";
import { assertTaskTransition } from "../platform/transitions";
import { assertGeneratedDocumentBody } from "../platform/validators";
import { assertApproved, createApprovalRecord, readSubjectState, subjectRefusal } from "../workspace/approvals";
import { revisionNoteFor } from "../workspace/changeRounds";
import type { LineageTask } from "../../lib/workspace/changeRounds";
import { isPendingApprovalStale } from "../../lib/workspace/contracts/approvals";
import { parseArtifact, parseModelOutput } from "../../lib/workspace/contracts/artifacts";
import { JOB_SUBJECT_MAIN, jobKey, parseJobKey } from "../../lib/workspace/contracts/jobs";
import { parsePromptRef } from "../../lib/workspace/contracts/prompts";
import {
  FAILED_STEP_ARCHIVED_REASON,
  FAILED_STEP_INTERRUPTED_REASON,
  FAILED_STEP_INTERRUPTED_REFUNDED_REASON,
  FAILED_STEP_QUALITY_REASON,
  FAILED_STEP_QUALITY_REFUNDED_REASON,
  FAILED_STEP_UNPAID_REASON,
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
import { crewSeedFor, newestPlatformSeed } from "../../lib/workspace/crew/inputs";
import { gateCrewArtifact, issueCodes, type QualityContext } from "../../lib/workspace/crew/quality";
import {
  isBlueprintFirstDraft,
  launchRosterPlan,
  launchRosterTask,
  newestBlueprintFirstDraft,
  openLaunchRosterTask,
  writeLaunchRoster,
} from "./launchRoster";
import { LAUNCH_STEPS, isPoolStep } from "./steps";

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
 *   `workspace` feature and the business. It spends no `crewJob` token
 *   (S2b, owner ruling "one token per founder action", `docs/wp/RULINGS.md`):
 *   the founder-facing start that causes the insert spends the action's one
 *   token (`startLaunch`, `retryLaunch`, `resumeLaunch`, an "Ask for changes"
 *   round), and the steps a launch inserts on its own spend none.
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
 *   (Codex's file; progress Needs). S2b's `stepDone` (the workpool
 *   `onComplete`) re-invokes a launch step whose action died, and
 *   `startCrewRun` closes a stale run itself.
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
  /**
   * S3a: the platform seed row the step's prompt was built from (a library
   * blueprint), so the quality gate stores that row's market and no other.
   * Unset: the prompt used no stored row (the fixture seed or none). Carried
   * with the retry args, so every retry gates against the same seed.
   */
  seedId: v.optional(v.id("idea_crew_seeds")),
  /**
   * S3a: the approved blueprint document a brand kit's prompt was briefed
   * from. `finishCrewStep` re-checks that exactly this document is still
   * approved before the kit is stored. Unset for callers that build their own
   * inputs (S2a's direct runs), which brief no blueprint.
   */
  briefDocumentId: v.optional(v.id("documents")),
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

/** Seed rows read per idea; WP71-S5 writes a handful of versions at most. */
export const SEED_ROWS_READ_MAX = 100;

/**
 * A read of an idea's platform seed: the newest platform row (or none), or
 * `overflow` when the bounded read was full and held no platform row, so the
 * newest one may lie outside it (the caller fails closed as `config`).
 */
export type PlatformSeedRead = { readonly ok: true; readonly row: Doc<"idea_crew_seeds"> | null } | { readonly ok: false; readonly reason: "overflow" };

/**
 * The newest platform seed row for a library idea (WP71-S5 writes them):
 * `projectId` unset, newest `seedVersion` by numeric-aware order. Seeds are
 * per-idea research, so they are read without an owner filter (Needs from
 * Codex 6). Read newest-first by the index (descending `seedVersion`), so
 * per-business rows can crowd the window only from the old end; a full window
 * with no platform row fails closed. Only the generator reads it; the quality
 * gate re-reads the exact row the prompt saw by id (`seedId`).
 */
export async function platformSeedRow(ctx: Pick<QueryCtx, "db">, ideaSlug: string): Promise<PlatformSeedRead> {
  const rows = await ctx.db
    .query("idea_crew_seeds")
    .withIndex("by_ideaSlug_and_seedVersion", (q) => q.eq("ideaSlug", ideaSlug))
    .order("desc")
    .take(SEED_ROWS_READ_MAX);
  const row = newestPlatformSeed(rows);
  if (row === null && rows.length >= SEED_ROWS_READ_MAX) return { ok: false, reason: "overflow" };
  return { ok: true, row };
}

/** The seed row a step's prompt was built from, re-read by id: only a platform row for this idea counts. */
async function stepSeedRow(
  ctx: Pick<QueryCtx, "db">,
  ideaSlug: string,
  seedId: Id<"idea_crew_seeds">,
): Promise<Doc<"idea_crew_seeds"> | null> {
  const row = await ctx.db.get("idea_crew_seeds", seedId);
  return row !== null && row.ideaSlug === ideaSlug && row.projectId === undefined ? row : null;
}

/**
 * What the quality gate needs from the project (S3a): its source, the name
 * the founder chose, and for a library idea the slug and the seed's market
 * (the only market a stored blueprint may carry, S3a review M1).
 *
 * The seed is the one the step's prompt saw (S3a review round 2, minor 2):
 * with `seedId`, exactly that row, re-read; if it is gone or no longer a
 * platform row for this idea, no market is stored (never another row's).
 * Without `seedId`, the prompt used no stored row, so the same fallback
 * (`crewSeedFor` with no row: the HydroTrail fixture or none).
 */
export async function qualityContextFor(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "source" | "workspace"> | null,
  seedId?: Id<"idea_crew_seeds">,
): Promise<QualityContext> {
  const ideaSlug = project?.workspace?.ideaSlug;
  const businessName = project?.workspace?.name;
  const ownIdea = project?.source === "own_idea";
  let seedMarket: QualityContext["seedMarket"];
  if (!ownIdea && ideaSlug !== undefined) {
    const row = seedId === undefined ? undefined : await stepSeedRow(ctx, ideaSlug, seedId);
    // A vanished row is not "no row": it must not fall back to the fixture seed.
    const seed = row === null ? null : crewSeedFor(ideaSlug, row?.blueprint);
    if (seed?.blueprint?.source === "library") seedMarket = seed.blueprint.market;
  }
  return {
    ownIdea,
    ...(ideaSlug === undefined ? {} : { ideaSlug }),
    ...(businessName === undefined ? {} : { businessName }),
    ...(seedMarket === undefined ? {} : { seedMarket }),
  };
}

/** Blueprint documents looked at for an approved one, newest first. */
const APPROVED_BLUEPRINT_SCAN_MAX = 20;
/** Cards read per blueprint document. */
const APPROVALS_PER_DOCUMENT_MAX = 20;

/**
 * A blueprint document of the project whose `artifact_review` card is
 * approved and still valid for it (`assertApproved`: same business and owner,
 * unchanged since the card).
 */
async function isApprovedBlueprint(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
  row: Doc<"documents">,
): Promise<boolean> {
  if (row.projectId !== project._id || row.kind !== "blueprint") return false;
  if (row.ownerId !== project.ownerId || row.archivedAt !== undefined || row.body === undefined) return false;
  const cards = await ctx.db.query("approvals").withIndex("by_subjectId", (q) => q.eq("subjectId", row._id)).take(APPROVALS_PER_DOCUMENT_MAX);
  for (const card of cards) {
    if (card.kind !== "artifact_review" || card.status !== "approved" || card.subjectTable !== "documents") continue;
    try {
      await assertApproved(ctx, card._id, {
        kind: "artifact_review",
        projectId: project._id,
        ownerId: project.ownerId,
        subjectTable: "documents",
        subjectId: row._id,
      });
      return true;
    } catch {
      // Not valid for this document (changed since, wrong business): try the next card.
    }
  }
  return false;
}

/**
 * The newest blueprint the founder approved (`isApprovedBlueprint`). A draft
 * is never the brand kit's brief (S3a review minor 1).
 */
export async function approvedBlueprint(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
): Promise<Doc<"documents"> | null> {
  const rows = await ctx.db
    .query("documents")
    .withIndex("by_projectId_and_kind_and_updatedAt", (q) => q.eq("projectId", project._id).eq("kind", "blueprint"))
    .order("desc")
    .take(APPROVED_BLUEPRINT_SCAN_MAX);
  for (const row of rows) {
    if (await isApprovedBlueprint(ctx, project, row)) return row;
  }
  return null;
}

/**
 * WP75-S2b: whether a brand kit task is a launch's own first draft: round 0
 * under the revision-0 key, not a revision, in a business that has a launch
 * (its `crew_roster` task). Brand kit revisions (WP77 change rounds) and kits
 * outside a launch are not.
 */
export async function isLaunchBrandKitTask(ctx: Pick<QueryCtx, "db">, task: Doc<"tasks">): Promise<boolean> {
  if (task.type !== "crew_brand_kit" || task.revisionOfTaskId !== undefined || (task.changeRound ?? 0n) !== 0n) return false;
  if (task.jobKey !== jobKey(task.projectId, "crew_brand_kit", JOB_SUBJECT_MAIN, 0)) return false;
  return (await launchRosterTask(ctx, task.ownerId, task.projectId)) !== null;
}

/**
 * WP75-S2b owner ruling "brand-kit brief in a launch" (`docs/wp/RULINGS.md`,
 * 2026-11-06; narrows S3a review minor 1 for launches only): a launch's brand
 * kit may brief from that launch's own first-draft blueprint while its card is
 * `pending` (inside its TTL) or `approved`, and only when:
 * - the document belongs to the business, is a blueprint, is not archived and
 *   was written by a succeeded blueprint first draft (round 0, revision-0 key);
 * - the newest `artifact_review` card on it is `pending` or `approved` (never
 *   `changes_requested`, `expired` or `cancelled`);
 * - the document is unchanged since that card was created (C-APPROVAL's own
 *   subject check).
 * `now` is the caller's clock for the pending card's TTL; a query that cannot
 * read the clock passes none and `finishCrewStep` applies the TTL.
 */
export async function isLaunchDraftBrief(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
  row: Doc<"documents">,
  now?: number,
): Promise<boolean> {
  if (row.projectId !== project._id || row.ownerId !== project.ownerId || row.kind !== "blueprint") return false;
  if (row.archivedAt !== undefined || row.body === undefined || row.taskId === undefined) return false;
  const writer = await ctx.db.get("tasks", row.taskId);
  if (writer === null || writer.ownerId !== project.ownerId || writer.status !== "succeeded" || !isBlueprintFirstDraft(writer)) return false;
  const cards = (await ctx.db.query("approvals").withIndex("by_subjectId", (q) => q.eq("subjectId", row._id)).take(APPROVALS_PER_DOCUMENT_MAX))
    .filter((card) => card.kind === "artifact_review" && card.subjectTable === "documents" &&
      card.projectId === project._id && card.ownerId === project.ownerId);
  const newest = cards.reduce<Doc<"approvals"> | null>((latest, card) =>
    latest === null || card._creationTime > latest._creationTime ? card : latest, null);
  if (newest === null) return false;
  const live = newest.status === "approved" ||
    (newest.status === "pending" && (now === undefined || !isPendingApprovalStale(newest.createdAt, now)));
  if (!live) return false;
  const state = await readSubjectState(ctx, project.ownerId, project._id, "documents", row._id);
  return subjectRefusal(state, "artifact_review", newest.createdAt, newest._id) === null;
}

/** The launch's own first-draft blueprint document, when it may brief the launch's brand kit (`isLaunchDraftBrief`). */
export async function launchDraftBlueprint(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
  now?: number,
): Promise<Doc<"documents"> | null> {
  const firstDraft = await newestBlueprintFirstDraft(ctx, project.ownerId, project._id);
  if (firstDraft === null || firstDraft.status !== "succeeded") return null;
  const document = await ctx.db.query("documents")
    .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", firstDraft._id))
    .order("desc")
    .first();
  return document !== null && (await isLaunchDraftBrief(ctx, project, document, now)) ? document : null;
}

/**
 * The brief a brand kit was built from may still brief it (round 2, minor 3):
 * an approved blueprint, or for a launch's own kit the launch's first draft
 * under the S2b ruling (`isLaunchDraftBrief`).
 */
async function briefStillValid(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
  task: Doc<"tasks">,
  briefDocumentId: Id<"documents">,
  now: number,
): Promise<boolean> {
  const row = await ctx.db.get("documents", briefDocumentId);
  if (row === null) return false;
  if (await isApprovedBlueprint(ctx, project, row)) return true;
  return (await isLaunchBrandKitTask(ctx, task)) && (await isLaunchDraftBrief(ctx, project, row, now));
}

const qualityContextValidator = v.object({
  ownIdea: v.boolean(),
  ideaSlug: v.optional(v.string()),
  businessName: v.optional(v.string()),
  seedMarket: v.optional(v.object({
    summary: v.string(),
    competitors: v.array(v.object({ name: v.string(), note: v.string() })),
  })),
});

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
 * first draft, and the feature gate's or business guard's error when the
 * owner may not start work now. No limiter token: the founder-facing caller
 * spends the action's one `crewJob` token (S2b).
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

/** Rows read per step job key when checking whether a launch step already has its task. */
const STEP_KEY_HOLDERS_READ_MAX = 20;

/**
 * WP75-S2b: the launch's step tasks, inserted once its roster is written (in
 * the blueprint's finish, and again by `./launch.ts` when it advances a
 * launch, which heals a roster written before S2b). One task per built pool
 * step after the blueprint whose employee the roster hired, and only while
 * nothing holds the step's revision-0 key: a failed or cancelled step is
 * never re-inserted here. The founder's Try again re-inserts it
 * (`retryLaunch` -> `retryFailedLaunchSteps` in `./launch.ts`: a new first
 * draft on the same key, one token per click). A step
 * whose employee was skipped gets no task. No `crewJob` token. Returns the
 * number inserted.
 */
export async function ensureLaunchStepTasks(
  ctx: MutationCtx,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
  hired: ReadonlySet<string>,
): Promise<number> {
  let inserted = 0;
  for (const step of LAUNCH_STEPS) {
    if (step.key === "blueprint" || !isPoolStep(step) || step.jobType === "crew_roster") continue;
    if (step.employee !== "lead" && !hired.has(step.employee)) continue;
    const key = jobKey(project._id, step.jobType, JOB_SUBJECT_MAIN, 0);
    const holders = await ctx.db.query("tasks")
      .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", project.ownerId).eq("jobKey", key))
      .take(STEP_KEY_HOLDERS_READ_MAX);
    if (holders.some((row) => row.projectId === project._id)) continue;
    await insertCrewTask(ctx, {
      ownerId: project.ownerId,
      projectId: project._id,
      jobType: step.jobType,
      ...(step.employee === "lead" ? {} : { employeeKey: step.employee }),
    });
    inserted += 1;
  }
  return inserted;
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
  // S2b review minor 3: a WP77 revision runs off the pool but holds one of the
  // owner's crew slots while `running`. When it finishes, fails, parks or is
  // cancelled, the launch DAG fills that slot (scheduled, so this module needs
  // no import of `./launch`, which imports it). No token.
  if (task.status === "running" && next !== "running" && task.revisionOfTaskId !== undefined) {
    await ctx.scheduler.runAfter(0, internal.crew.launch.advanceAfterRevision, { ownerId: task.ownerId });
  }
  return { ...task, status: next, updatedAt: now };
}

/**
 * Fails the task for good. The refund is scheduled (same transaction) only
 * when the task has a debit AND the refund can run: the ledger refuses an
 * archived task or business (`RESOURCE_NOT_FOUND`), so there the credits stay
 * spent and the note says so instead of promising a refund.
 */
/**
 * Why a task failed, for the founder-facing note: an ordinary failure, an
 * interrupted action, a missing payment, or a draft that failed the quality
 * checks (S3a).
 */
type FailCause = "failed" | "interrupted" | "unpaid" | "quality";

function failedReason(cause: FailCause, refundScheduled: boolean, hasDebit: boolean): string {
  if (hasDebit && !refundScheduled) return FAILED_STEP_ARCHIVED_REASON;
  switch (cause) {
    case "failed":
      return refundScheduled ? FAILED_STEP_REFUNDED_REASON : FAILED_STEP_REASON;
    case "interrupted":
      return refundScheduled ? FAILED_STEP_INTERRUPTED_REFUNDED_REASON : FAILED_STEP_INTERRUPTED_REASON;
    case "unpaid":
      return FAILED_STEP_UNPAID_REASON;
    case "quality":
      return refundScheduled ? FAILED_STEP_QUALITY_REFUNDED_REASON : FAILED_STEP_QUALITY_REASON;
  }
}

async function failTask(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  now: number,
  cause: FailCause = "failed",
): Promise<{ refundScheduled: boolean }> {
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
    blocker: failedReason(cause, refundScheduled, debit !== null),
  }, now);
  return { refundScheduled };
}

async function parkTask(ctx: MutationCtx, task: Doc<"tasks">, code: ParkingMeterCode, now: number): Promise<void> {
  const parked = await setTaskStatus(ctx, task, "blocked", now);
  await setCrewStatus(ctx, parked, { member: "needs_you", workstream: "blocked", blocker: parkedReason(code) }, now);
}

/**
 * WP75-S2b: the founder resumed a parked (`blocked`) step: blocked → running,
 * and the employee and workstream back to `queued`, before the step is
 * enqueued again. Claiming `running` here (not in `startCrewRun`) makes the
 * resumed step count against the owner's cap from the moment it is enqueued.
 * `startCrewRun` then starts a `running` task with no open run as usual.
 */
export async function resumeParkedTask(ctx: MutationCtx, task: Doc<"tasks">, now: number): Promise<Doc<"tasks">> {
  const running = await setTaskStatus(ctx, task, "running", now);
  await setCrewStatus(ctx, running, { member: "queued", workstream: "queued", blocker: null }, now);
  return running;
}

/**
 * WP75-S2b: a launch step whose action keeps dying without settling its task
 * (`stepDone`, `MAX_ACTION_FAILURES`). Closes any open run as abandoned and
 * fails the task with the calm "interrupted" note (a debit refunded by the
 * usual rule). A terminal or parked task is left alone. Returns whether it
 * failed the task.
 */
export async function abandonCrewTask(ctx: MutationCtx, taskId: Id<"tasks">, now: number): Promise<boolean> {
  const task = await ctx.db.get("tasks", taskId);
  if (task === null || isTerminal(task.status) || task.status === "blocked") return false;
  for (const run of await runsOf(ctx, task._id)) {
    if (run.status === "running") await closeAbandonedRun(ctx, run, now);
  }
  const running = task.status === "running" ? task : await setTaskStatus(ctx, task, "running", now);
  await failTask(ctx, running, now, "interrupted");
  return true;
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

/**
 * Whether a task may run again after an abandoned run: the `indeterminate`
 * decision over the task's other runs. `startCrewRun` and
 * `recoverStaleCrewRuns` both use it, so the same history gets the same answer.
 */
function mayRetryAfterAbandoned(earlierErrorCodes: readonly (string | undefined)[]): boolean {
  return retryDecision("indeterminate", earlierErrorCodes).action === "retry";
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
  v.literal("unpaid"),
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
    /** What the quality gate needs from the project (S3a), read on the server. */
    quality: qualityContextValidator,
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
  args: { taskId: v.id("tasks"), resume: v.optional(v.boolean()), seedId: v.optional(v.id("idea_crew_seeds")) },
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
    const open = runs.filter((run) => run.status === "running");
    if (open.some((run) => !isStale(run, now))) return { kind: "skip", reason: "in_flight" };
    // Closed runs' codes first (`runsOf` is newest first, so order is not
    // history): each abandoned run counts as one indeterminate execution.
    const errorCodes: (string | undefined)[] = runs.filter((run) => run.status !== "running").map((run) => run.errorCode);
    let interrupted = false;
    for (const run of open) {
      // The same decision recovery makes on the same history (N4).
      if (!mayRetryAfterAbandoned(errorCodes)) interrupted = true;
      await closeAbandonedRun(ctx, run, now);
      errorCodes.push("indeterminate");
    }

    // queued → running, or blocked → running on a resume.
    const task = found.status === "running" ? found : await setTaskStatus(ctx, found, "running", now);
    if (interrupted) {
      await failTask(ctx, task, now, "interrupted");
      return { kind: "skip", reason: "exhausted" };
    }
    if (runs.length > RUN_SCAN_MAX || errorCodes.filter(spendsRetryBudget).length >= MAX_RETRY_BUDGET_RUNS) {
      await failTask(ctx, task, now);
      return { kind: "skip", reason: "exhausted" };
    }
    // A paid task runs only on its debit, never on the free allowance (N2).
    const debit = await debitOf(ctx, task);
    if ((task.creditCost ?? 0n) > 0n && debit === null) {
      await failTask(ctx, task, now, "unpaid");
      return { kind: "skip", reason: "unpaid" };
    }

    // A revision never runs without the draft it revises: the model would
    // write a fresh first draft and the founder would review the wrong thing.
    const previous = await revisedDocument(ctx, task, CREW_STEP_ARTIFACTS[jobType].kind);
    if (task.revisionOfTaskId !== undefined && previous?.body === undefined) {
      await failTask(ctx, task, now);
      return { kind: "skip", reason: "missing" };
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

    const note = task.revisionOfTaskId === undefined ? null : await revisionNoteFor(ctx, task._id);
    const project = await ctx.db.get("projects", task.projectId);
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
      quality: await qualityContextFor(ctx, project, args.seedId),
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
  v.object({
    kind: v.literal("finished"),
    documentId: v.id("documents"),
    approvalId: v.id("approvals"),
    /** S3a: soft quality issue codes. They never block; nothing stores them yet (progress Needs from Codex). */
    softIssueCodes: v.optional(v.array(v.string())),
  }),
  v.object({ kind: v.literal("failed"), refundScheduled: v.boolean() }),
  /** S3a: the draft failed a hard quality check, so the step failed closed (no document, no card). */
  v.object({ kind: v.literal("rejected"), refundScheduled: v.boolean(), issueCodes: v.array(v.string()) }),
  v.object({ kind: v.literal("parked") }),
  v.object({ kind: v.literal("stale") }),
);

export type FinishCrewStepResult = Infer<typeof finishCrewStepResult>;

/**
 * The success transaction of one step: document, task, run, `artifact_review`
 * card, employee and workstream, together. An output that passed the prompt's
 * schema but fails the C-ART artifact schema fails the task (permanent); a
 * workspace switched off since the call parks it.
 *
 * S3a: a gated kind (`QUALITY_GATED_KINDS`) passes the deterministic quality
 * gate first. A hard issue fails the step closed (`rejected`: no document, no
 * card, the calm quality note, the debit refunded as for any failure); soft
 * issue codes come back with `finished` and never block. This mutation is the
 * authority: the runner's pre-check only feeds S4b's repair seam.
 *
 * S1: a launch's first-draft blueprint (its business has an open `crew_roster`
 * task, `./launchRoster.ts`) also writes the roster here, so the blueprint and
 * the team commit together. Revisions and blueprints outside a launch never do.
 */
export const finishCrewStep = internalMutation({
  args: {
    runId: v.id("workflow_runs"),
    promptRef: v.string(),
    outputJson: v.string(),
    nextAttempt: v.number(),
    /** The seed row the prompt was built from (`runCrewStepArgs.seedId`). */
    seedId: v.optional(v.id("idea_crew_seeds")),
    /** The approved blueprint a brand kit was briefed from (`runCrewStepArgs.briefDocumentId`). */
    briefDocumentId: v.optional(v.id("documents")),
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
    let project: Doc<"projects">;
    try {
      await assertFeatureEnabledForOwner(ctx, "workspace", task.ownerId);
      project = await requireBusinessForOwner(ctx, task.projectId, task.ownerId);
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
    // S3a review round 2, minor 3: the kit's brief must still be valid when the kit is stored: approved, or
    // (S2b ruling) the launch's own first draft with a live, unchanged card. A blueprint edited or un-approved
    // since the step was prepared fails the step like a config failure would have at preflight: permanent, no
    // document, the usual calm note, a debit refunded.
    if (kind === "brand_kit" && args.briefDocumentId !== undefined &&
      !(await briefStillValid(ctx, project, task, args.briefDocumentId, now))) {
      await closeRun(ctx, run, "failed", "permanent", nextAttempt, now);
      return { kind: "failed", ...(await failTask(ctx, task, now)) };
    }
    const previous = await revisedDocument(ctx, task, kind);
    let body: string | null = null;
    let gate: ReturnType<typeof gateCrewArtifact> | null = null;
    try {
      const raw: unknown = JSON.parse(args.outputJson);
      // The revised draft, re-validated: a LandingSpec revision keeps the stored proof slots.
      const stored = previous?.body === undefined ? null : parseArtifact(kind, JSON.parse(previous.body));
      const parsed = parseModelOutput(kind, raw, stored?.success === true ? stored.data : null);
      if (parsed.success) {
        // S3a: the deterministic quality gate (S4a checks plus the server's facts) decides what is stored.
        gate = gateCrewArtifact(kind, parsed.data, await qualityContextFor(ctx, project, args.seedId));
        if (gate.artifact !== null) body = assertGeneratedDocumentBody(JSON.stringify(gate.artifact));
      }
    } catch {
      body = null;
    }
    if (gate !== null && gate.result.hard.length > 0) {
      await closeRun(ctx, run, "failed", "permanent", nextAttempt, now);
      const { refundScheduled } = await failTask(ctx, task, now, "quality");
      return { kind: "rejected", refundScheduled, issueCodes: issueCodes(gate.result.hard) };
    }
    if (body === null) {
      await closeRun(ctx, run, "failed", "permanent", nextAttempt, now);
      return { kind: "failed", ...(await failTask(ctx, task, now)) };
    }
    const softIssueCodes = gate === null ? [] : issueCodes(gate.result.soft);

    // WP75-S1: a launch's first-draft blueprint plans the roster in this same transaction, from the blueprint
    // being stored. A roster that cannot be planned fails the step closed (no document, no card, no roster),
    // so a succeeded launch blueprint always has its team and a failed one offers the founder's retry.
    const rosterTask = kind === "blueprint" ? await openLaunchRosterTask(ctx, task) : null;
    const rosterPlan = rosterTask === null ? null : await launchRosterPlan(ctx, project, body);
    if (rosterTask !== null && rosterPlan === null) {
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
    if (rosterTask !== null && rosterPlan !== null) {
      await writeLaunchRoster(ctx, rosterTask, rosterPlan, now);
      // S2b: the hired employees' step tasks, queued; the DAG enqueues them as their parents finish.
      await ensureLaunchStepTasks(ctx, project, new Set(rosterPlan.hired.map((entry) => entry.roleKey)));
    }
    return { kind: "finished", documentId, approvalId, ...(softIssueCodes.length === 0 ? {} : { softIssueCodes }) };
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
 * Settles crew runs left `running` past the lease (their action died), so no
 * task is ever left `running` with no open run. Each stale run closes as
 * indeterminate, exactly as `startCrewRun` closes one. The task then fails
 * with a calm "interrupted, try again" note, refunded by the usual rule:
 *
 * - out of indeterminate retries (`mayRetryAfterAbandoned` says no; the same
 *   history makes `startCrewRun` fail it with the same note);
 * - or a retry is allowed but recovery cannot run it: the step's inputs are
 *   not stored, and `workflow_runs` has no field for the caller's retry mode
 *   (the schema is Codex's). So every recovered run is treated the same way.
 *   Failing frees the change round, so the founder (or S2b's DAG) can start
 *   the step again.
 *
 * A caller that re-invokes on its own (S2b's workpool `onComplete`) waits
 * `RUN_LEASE_MS` first; whichever of it and recovery comes first settles the
 * run, and the other finds nothing to do (`terminal` or no stale run).
 * One page per call (`RECOVERY_PAGE_MAX`); the next page is scheduled with
 * the same cutoff until the index range is done.
 *
 * Needs a cron (Codex's `convex/crons.ts`; progress Needs from Codex 13).
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
      const others = (await runsOf(ctx, task._id)).filter((row) => row._id !== run._id);
      // Another execution still inside its lease owns the task; it settles it.
      if (others.some((row) => row.status === "running" && !isStale(row, now))) continue;
      // Whether or not the budget allows a retry, recovery cannot run one: fail calmly, never orphan.
      await failTask(ctx, task, now, "interrupted");
      failedTasks += 1;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crew.jobs.recoverStaleCrewRuns, { cutoff, cursor: page.continueCursor, limit });
    }
    return { recovered, failedTasks, isDone: page.isDone };
  },
});
