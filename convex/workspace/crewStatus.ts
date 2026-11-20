import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { launchProgressValidator, readLaunchProgress, revisionBlocker } from "../crew/launch";
import { launchViewValidator, readLaunch } from "../crew/roster";
import { approvedBrandKit } from "../crew/jobs";
import { LAUNCH_STEPS, isPoolStep, type LaunchStep } from "../crew/steps";
import { parseDraftBody } from "../growth/drafts/documentDraft";
import { assertFeatureEnabled } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { taskStatusValidator } from "../platform/validators";
import { approvalExpiresAt } from "../../lib/workspace/contracts/approvals";
import { brandKitSchema, type BrandKit } from "../../lib/workspace/contracts/artifacts";
import { jobKey, JOB_SUBJECT_MAIN } from "../../lib/workspace/contracts/jobs";
import { ROLE_KEYS } from "../../lib/workspace/contracts/roster";
import { brandSlice } from "../../lib/workspace/crew/inputs";
import { employeeStatuses, readyRoster } from "../../lib/workspace/crew/status";
import { sliceWellFormed } from "../../lib/workspace/plainText";
import { openReviews } from "../../lib/workspace/needsYou";
import { CHANGE_ROUND_LINEAGE_MAX } from "./changeRounds";
import { pendingReviewValidator, readPendingReviews, readPendingCrewSpend } from "./reviews";

const assignmentValidator = v.object({
  role: v.union(...ROLE_KEYS.map((role) => v.literal(role))),
  title: v.string(),
  round: v.number(),
  taskId: v.id("tasks"),
  status: taskStatusValidator,
  documentId: v.optional(v.id("documents")),
  blocker: v.optional(v.union(v.literal("blueprint"), v.literal("brand_kit"))),
  failure: v.optional(v.string()),
  changedFields: v.optional(v.array(v.string())),
  changePreview: v.optional(v.array(v.string())),
  handoff: v.optional(v.union(v.literal("requested"), v.literal("queued"), v.literal("spend_required"), v.literal("not_available"))),
  handoffReason: v.optional(v.string()),
  handoffSpendExpiresAt: v.optional(v.number()),
  source: v.optional(v.union(v.literal("current"), v.literal("stale"), v.literal("unknown"))),
});
const snapshotValidator = v.object({
  launch: launchViewValidator,
  progress: launchProgressValidator,
  reviews: v.array(pendingReviewValidator),
  assignments: v.array(assignmentValidator),
  spend: v.array(v.object({ ...pendingReviewValidator.fields, costCredits: v.int64() })),
});

type ReadCtx = Pick<QueryCtx, "db">;
type Snapshot = Infer<typeof snapshotValidator>;

async function copySource(
  ctx: ReadCtx, project: Doc<"projects">, output: Doc<"documents">, current: Doc<"documents"> | null,
): Promise<"current" | "stale" | "unknown"> {
  if (!current || !output.brandKitDocumentId) return "unknown";
  if (output.brandKitDocumentId === current._id) return "current";
  const prior = await ctx.db.get("documents", output.brandKitDocumentId);
  if (!prior || prior.projectId !== project._id || prior.ownerId !== project.ownerId || prior.kind !== "brand_kit") return "unknown";
  const oldKit = parseDraftBody(prior.body, brandKitSchema);
  const newKit = parseDraftBody(current.body, brandKitSchema);
  if (!oldKit || !newKit) return "unknown";
  return brandSlice(oldKit) === brandSlice(newKit) ? "current" : "stale";
}

/** Short, attributable examples that a founder can also find on the brand page. */
function brandExcerpts(kit: BrandKit): Record<string, string> {
  return {
    Tagline: kit.tagline.text,
    "Voice example": kit.voice.say,
    "Voice traits": kit.voice.traits.join(", "),
    "Wording to avoid": kit.voice.dontSay,
    ...Object.fromEntries(Object.entries(kit.palette).map(([use, colour]) => [
      `${use.charAt(0).toUpperCase()}${use.slice(1)} colour`, `${colour.name} (${colour.hex})`,
    ])),
    Typefaces: kit.type.pair.replaceAll("_", " "),
    "Logo description": kit.logo.markDescription,
    "Hero image description": kit.heroArt.description,
  };
}

async function brandChangePreview(ctx: ReadCtx, output: Doc<"documents">): Promise<string[]> {
  if (output.kind !== "brand_kit" || !output.supersedesDocumentId) return [];
  const prior = await ctx.db.get("documents", output.supersedesDocumentId);
  if (!prior || prior.kind !== output.kind || prior.projectId !== output.projectId || prior.ownerId !== output.ownerId) return [];
  const before = parseDraftBody(prior.body, brandKitSchema);
  const after = parseDraftBody(output.body, brandKitSchema);
  if (!before || !after) return [];
  const original = brandExcerpts(before);
  return Object.entries(brandExcerpts(after)).filter(([label, value]) => original[label] !== value)
    .slice(0, 2).map(([label, value]) => `${label} — “${value.length > 110 ? sliceWellFormed(value, 109) + "…" : value}”`);
}

/** Spending approval queues the child in the same transaction. A closed card can no longer start it. */
async function emailHandoff(ctx: ReadCtx, task: Doc<"tasks">): Promise<Pick<
  Infer<typeof assignmentValidator>, "handoff" | "handoffReason" | "handoffSpendExpiresAt"
>> {
  const receipt = task.emailHandoff;
  if (!receipt) return {};
  if (receipt.state !== "spend_required") {
    return { handoff: receipt.state, ...(receipt.reason ? { handoffReason: receipt.reason } : {}) };
  }
  const card = receipt.approvalId ? await ctx.db.get("approvals", receipt.approvalId) : null;
  if (!card || card.projectId !== task.projectId || card.ownerId !== task.ownerId ||
      card.kind !== "spend" || card.subjectTable !== "documents" || card.crewRevision === undefined) {
    return { handoff: "not_available" };
  }
  if (card.status === "approved") return { handoff: "queued" };
  if (card.status === "pending") return { handoff: "spend_required", handoffSpendExpiresAt: approvalExpiresAt(card.createdAt) };
  return { handoff: "not_available", handoffReason: card.status === "expired" ? "Spend approval expired." : "Spend approval closed." };
}

async function readAssignment(
  ctx: ReadCtx, project: Doc<"projects">, step: LaunchStep, currentKit: Doc<"documents"> | null,
): Promise<Infer<typeof assignmentValidator> | null> {
  // A round number is encoded as decimal text. Sort the bounded lineage by creation time
  // so round ten, and a retry under the same key, both take precedence over earlier work.
  const prefix = jobKey(project._id, step.jobType, JOB_SUBJECT_MAIN, 0).slice(0, -1);
  const rows = await ctx.db.query("tasks").withIndex("by_ownerId_and_jobKey", (q) =>
    q.eq("ownerId", project.ownerId).gte("jobKey", prefix).lt("jobKey", `${prefix.slice(0, -1)};`),
  ).take(CHANGE_ROUND_LINEAGE_MAX + 1);
  // The mutation refuses further revisions on an oversized legacy lineage. The read still
  // reports its latest existing job using the project's chronological index.
  const task = rows.length > CHANGE_ROUND_LINEAGE_MAX
    ? await ctx.db.query("tasks").withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", project._id))
      .order("desc").filter((q) => q.and(q.eq(q.field("ownerId"), project.ownerId), q.eq(q.field("type"), step.jobType),
        q.eq(q.field("archivedAt"), undefined), q.gte(q.field("jobKey"), prefix), q.lt(q.field("jobKey"), `${prefix.slice(0, -1)};`))).first()
    : rows.filter((row) => row.projectId === project._id && row.type === step.jobType && row.archivedAt === undefined)
    .sort((a, b) => b._creationTime - a._creationTime)[0];
  if (!task) return null;

  const round = Number(task.changeRound ?? 0n);
  const blocker = round > 0 && task.status === "queued" ? await revisionBlocker(ctx, project, task) : null;
  const document = task.status === "succeeded"
    ? await ctx.db.query("documents").withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", task._id))
      .order("desc").first()
    : null;
  const output = document?.projectId === project._id && document.ownerId === project.ownerId &&
    document.archivedAt === undefined && document.kind === step.key ? document : null;
  const source = output && (step.key === "email_sequence" || step.key === "social_pack")
    ? await copySource(ctx, project, output, currentKit)
    : undefined;
  const changePreview = output ? await brandChangePreview(ctx, output) : [];
  return {
    role: step.employee, title: step.title, round, taskId: task._id, status: task.status,
    ...(output ? { documentId: output._id } : {}),
    ...(changePreview.length > 0 ? { changePreview } : {}),
    ...(output?.changedFields ? { changedFields: output.changedFields } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(blocker ? { blocker } : {}),
    ...(task.crewFailureReason ? { failure: task.crewFailureReason } : {}),
    ...await emailHandoff(ctx, task),
  };
}

async function readSnapshot(ctx: ReadCtx, project: Doc<"projects">): Promise<Snapshot> {
  const [launch, progress, reviews, spend] = await Promise.all([
    readLaunch(ctx, project), readLaunchProgress(ctx, project), readPendingReviews(ctx, project), readPendingCrewSpend(ctx, project),
  ]);
  if (launch.state !== "ready") return { launch, progress, reviews, spend, assignments: [] };
  const hired = new Set(launch.hired.map((entry) => entry.roleKey));
  const built = LAUNCH_STEPS.filter((step) => isPoolStep(step) && hired.has(step.employee));
  const kit = await approvedBrandKit(ctx, project);
  const assignments = (await Promise.all(built.map((step) => readAssignment(ctx, project, step, kit))))
    .filter((item) => item !== null);
  return { launch, progress, reviews, spend, assignments };
}

/** The lead sees precisely the role labels, work state and unexpired reviews that Team HQ can display. */
export async function readCrewStatus(ctx: ReadCtx, project: Doc<"projects">, now: number) {
  const { launch, progress, reviews, spend, assignments } = await readSnapshot(ctx, project);
  const open = openReviews(reviews, now);
  const openSpend = openReviews(spend, now);
  const roster = launch.state === "ready" ? readyRoster(launch).hired : [];
  const specialists = employeeStatuses(roster, progress.steps, open, assignments, openSpend, now).filter((role) => role.role !== "lead");
  return {
    launchState: launch.state,
    specialists,
    reviewCount: open.length,
    spendApprovals: openSpend.map(({ kind, title, changeRound, costCredits }) => ({ kind, title, changeRound: Number(changeRound), costCredits: Number(costCredits) })),
    reviews: open.map(({ kind, title, changeRound }) => ({ kind, title, changeRound: Number(changeRound) })),
  };
}

export const snapshot = query({
  args: { projectId: v.id("projects") },
  returns: snapshotValidator,
  handler: async (ctx, { projectId }): Promise<Snapshot> => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    return await readSnapshot(ctx, await requireBusinessAccess(ctx, projectId, "owner"));
  },
});
