import { v, type Infer } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireBusinessAccess } from "../../platform/authz";
import { approvalStatusValidator } from "../../workspace/approvalValidators";
import { requestCrewRevision } from "../../workspace/approvals";
import { revisionNoteFor } from "../../workspace/changeRounds";
import { approvedBrandKit } from "../../crew/jobs";
import { jobKey, parseJobKey } from "../../../lib/workspace/contracts/jobs";
import { MAX_SEQUENCE_STEPS, approvalExpiresAt } from "../../../lib/workspace/contracts/approvals";
import { EMAIL_CTA_TARGETS, EMAIL_KINDS, type EmailSequence } from "../../../lib/workspace/contracts/artifacts";
import {
  draftStepRows,
  emailStepFromSequence,
  parseEmailSequenceBody,
  stepsRewritable,
} from "../../../lib/workspace/growth/emailDraft";

/**
 * WP76-S1a — the email sequence's draft rows, written in the crew step's
 * finish transaction (`finishCrewStep`, `convex/crew/jobs.ts`), and the
 * owner-only read for the Email page. Nothing here sends and no `send`
 * approval is created: WP79 activates an approved sequence.
 *
 * The draft rule (the contract WP79 reads, `lib/workspace/growth/emailDraft.ts`):
 * - a business has at most one `draft` sequence. The schema has no origin
 *   field, and nothing but the crew writes a `draft` sequence, so every
 *   `draft` row is the crew's;
 * - a finish (first draft, retry or change-round revision) inserts the draft
 *   sequence when there is none, or rewrites the one draft in place: its
 *   title, and steps 0–3 repointed at the new document (patched, so step ids
 *   stay stable). A sequence that is `approved`, `active` or `paused` (WP79's)
 *   is never read for writing or touched: the finish inserts a new draft;
 * - two or more `draft` sequences, more sequences than one read holds, a
 *   draft whose steps are not orders 0–3 at most once (or belong to another
 *   business), or a draft step that carries an `approvalId` (a step approval
 *   is WP79's, so the crew never rewrites under one), fail closed: no write,
 *   and the step fails as permanent. `prepareCrewStep` runs the same business
 *   check first (`emailDraftTarget`), so a conflict fails at preflight with no
 *   model call; the finish's check stays the authority.
 * Every write sets `updatedAt` to the finish's clock, the same as the document
 * and the card, so C-APPROVAL's `updated_at_with_children` policy sees the
 * sequence, its steps and their document as unchanged at the card's creation.
 */

/** Sequences read per business. A business has one draft and a handful of approved ones. */
export const SEQUENCES_READ_MAX = 50;

type Ctx = Pick<QueryCtx, "db">;

type Business = { readonly ownerId: Id<"users">; readonly projectId: Id<"projects"> };

const inBusiness = (row: { ownerId: Id<"users">; projectId: Id<"projects"> }, business: Business): boolean =>
  row.ownerId === business.ownerId && row.projectId === business.projectId;

/** The draft a finish would rewrite (null: insert one), or a conflict. */
export type EmailDraftTarget =
  | { readonly ok: true; readonly draft: Doc<"sequences"> | null; readonly steps: readonly Doc<"sequence_steps">[] }
  | { readonly ok: false; readonly reason: "conflict" };

export type EmailDraftPlan =
  | {
    readonly ok: true;
    readonly sequence: EmailSequence;
    /** The draft to rewrite in place, or null to insert one. */
    readonly draft: Doc<"sequences"> | null;
    readonly steps: readonly Doc<"sequence_steps">[];
  }
  | { readonly ok: false; readonly reason: "unreadable" | "conflict" };

type SequencesRead = { readonly ok: true; readonly rows: Doc<"sequences">[] } | { readonly ok: false };

async function businessSequences(ctx: Ctx, business: Business): Promise<SequencesRead> {
  const rows = await ctx.db.query("sequences")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", business.ownerId).eq("projectId", business.projectId))
    .take(SEQUENCES_READ_MAX + 1);
  return rows.length > SEQUENCES_READ_MAX ? { ok: false } : { ok: true, rows };
}

async function stepsOf(ctx: Ctx, sequenceId: Id<"sequences">): Promise<Doc<"sequence_steps">[]> {
  return await ctx.db.query("sequence_steps")
    .withIndex("by_sequenceId_and_order", (q) => q.eq("sequenceId", sequenceId))
    .take(MAX_SEQUENCE_STEPS + 1);
}

/**
 * The business's one draft (or none) when a finish may write it; a conflict
 * otherwise. Read by `prepareCrewStep` (preflight), `failedLaunchSteps` (the
 * retry reason) and `planEmailSequenceDraft` (the finish's authority).
 */
export async function emailDraftTarget(ctx: Ctx, business: Business): Promise<EmailDraftTarget> {
  const read = await businessSequences(ctx, business);
  if (!read.ok) return { ok: false, reason: "conflict" };
  const drafts = read.rows.filter((row) => row.status === "draft");
  if (drafts.length > 1) return { ok: false, reason: "conflict" };
  const [draft] = drafts;
  if (draft === undefined) return { ok: true, draft: null, steps: [] };
  const steps = await stepsOf(ctx, draft._id);
  if (steps.length > EMAIL_KINDS.length || !steps.every((step) => inBusiness(step, business) && step.approvalId === undefined) ||
    !stepsRewritable(steps)) {
    return { ok: false, reason: "conflict" };
  }
  return { ok: true, draft, steps };
}

/** What the finish will write, decided before any write (a refusal fails the step with nothing stored). */
export async function planEmailSequenceDraft(ctx: Ctx, business: Business, body: string): Promise<EmailDraftPlan> {
  const sequence = parseEmailSequenceBody(body);
  if (sequence === null) return { ok: false, reason: "unreadable" };
  const target = await emailDraftTarget(ctx, business);
  return target.ok ? { ok: true, sequence, draft: target.draft, steps: target.steps } : target;
}

/** Writes the planned draft: the sequence and its four steps, all pointing at `documentId`. Returns the sequence. */
export async function writeEmailSequenceDraft(
  ctx: MutationCtx,
  plan: Extract<EmailDraftPlan, { ok: true }>,
  input: Business & { readonly documentId: Id<"documents">; readonly now: number },
): Promise<Id<"sequences">> {
  const { now } = input;
  let sequenceId: Id<"sequences">;
  if (plan.draft === null) {
    sequenceId = await ctx.db.insert("sequences", {
      ownerId: input.ownerId,
      projectId: input.projectId,
      status: "draft",
      title: plan.sequence.name,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    sequenceId = plan.draft._id;
    await ctx.db.patch("sequences", sequenceId, { title: plan.sequence.name, updatedAt: now });
  }
  const existing = new Map(plan.steps.map((step) => [Number(step.order), step]));
  for (const row of draftStepRows(plan.sequence)) {
    const fields = { delayHours: row.delayHours, subject: row.subject, documentId: input.documentId, updatedAt: now };
    const step = existing.get(row.order);
    if (step === undefined) {
      await ctx.db.insert("sequence_steps", {
        ownerId: input.ownerId,
        projectId: input.projectId,
        sequenceId,
        order: BigInt(row.order),
        ...fields,
        createdAt: now,
      });
    } else {
      await ctx.db.patch("sequence_steps", step._id, fields);
    }
  }
  return sequenceId;
}

// ---------------------------------------------------------------------------
// The Email page's read
// ---------------------------------------------------------------------------

const emailKindValidator = v.union(...EMAIL_KINDS.map((kind) => v.literal(kind)));

const emailViewValidator = v.object({
  kind: emailKindValidator,
  delayHours: v.number(),
  subject: v.string(),
  preview: v.string(),
  body: v.string(),
  cta: v.optional(v.object({
    label: v.string(),
    target: v.union(...EMAIL_CTA_TARGETS.map((target) => v.literal(target))),
  })),
  goal: v.string(),
});

const emailSequenceDraftView = v.union(
  v.object({ state: v.literal("none") }),
  /** The rows and the document disagree, or the business holds more than one draft: shown as unavailable. */
  v.object({ state: v.literal("unavailable") }),
  v.object({
    state: v.literal("ready"),
    status: v.union(v.literal("draft"), v.literal("approved"), v.literal("active"), v.literal("paused")),
    name: v.string(),
    senderName: v.string(),
    emails: v.array(emailViewValidator),
    failedHandoff: v.optional(v.object({ taskId: v.id("tasks"), reason: v.string(), canRetry: v.boolean() })),
    /** The document's newest `artifact_review` card: the page's approve / ask-for-changes actions need its id. */
    card: v.union(
      v.null(),
      v.object({
        approvalId: v.id("approvals"),
        status: approvalStatusValidator,
        changeRound: v.int64(),
        /** Queries never read the clock; the client treats a pending card past this time as expired. */
        expiresAt: v.number(),
      }),
    ),
  }),
);

/** Cards read per document. */
const CARDS_PER_DOCUMENT_MAX = 20;

async function failedHandoffFor(ctx: Ctx, document: Doc<"documents">) {
  if (!document.taskId || document.kind !== "email_sequence" || document.archivedAt !== undefined) return null;
  const writer = await ctx.db.get("tasks", document.taskId);
  const key = writer?.jobKey ? parseJobKey(writer.jobKey) : null;
  if (!key || key.projectId !== document.projectId || key.jobType !== "crew_email_sequence" ||
      writer?.ownerId !== document.ownerId || writer.projectId !== document.projectId) return null;
  const nextKey = jobKey(document.projectId, key.jobType, key.subject, key.revision + 1);
  const latest = await ctx.db.query("tasks").withIndex("by_ownerId_and_jobKey", (q) =>
    q.eq("ownerId", document.ownerId).eq("jobKey", nextKey)).order("desc").first();
  return latest?.status === "failed" && latest.archivedAt === undefined && latest.type === key.jobType &&
    latest.projectId === document.projectId && latest.revisionOfTaskId === writer._id && latest.requiresBrandDocumentId
    ? latest : null;
}

/** Retry only the failed handoff still attached to this draft and the approved brand it used. */
export const retryEmailHandoff = mutation({
  args: { projectId: v.id("projects"), taskId: v.id("tasks") },
  returns: v.union(v.literal("queued"), v.literal("spend_required"), v.literal("not_available")),
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const failed = await ctx.db.get("tasks", args.taskId);
    if (!failed || !inBusiness(failed, { projectId: project._id, ownerId: project.ownerId }) ||
        !failed.approvalId || !failed.requiresBrandDocumentId) return "not_available" as const;
    const card = await ctx.db.get("approvals", failed.approvalId);
    if (!card || card.projectId !== project._id || card.ownerId !== project.ownerId || card.subjectTable !== "documents") return "not_available" as const;
    const sourceId = ctx.db.normalizeId("documents", card.subjectId);
    const source = sourceId && await ctx.db.get("documents", sourceId);
    if (!source || source.projectId !== project._id || source.ownerId !== project.ownerId ||
        (await failedHandoffFor(ctx, source))?._id !== failed._id) return "not_available" as const;
    const brand = await approvedBrandKit(ctx, project);
    if (!brand || brand._id !== failed.requiresBrandDocumentId) return "not_available" as const;
    const note = await revisionNoteFor(ctx, failed._id);
    if (!note?.trim()) return "not_available" as const;
    const result = await requestCrewRevision(ctx, project, {
      kind: "email_sequence", requestId: `retry-email-handoff:${failed._id}`, expectedDocumentId: source._id,
      requiresBrandDocumentId: failed.requiresBrandDocumentId, note,
    });
    const irisTask = brand.taskId && await ctx.db.get("tasks", brand.taskId);
    if (result.outcome !== "not_available" && irisTask?.emailHandoff && irisTask.ownerId === project.ownerId &&
        irisTask.projectId === project._id && (irisTask.emailHandoff.taskId === failed._id ||
          irisTask.emailHandoff.approvalId === failed.approvalId)) {
      await ctx.db.patch("tasks", irisTask._id, { emailHandoff: {
        state: result.outcome, ...(result.taskId ? { taskId: result.taskId } : {}),
        ...(result.approvalId ? { approvalId: result.approvalId } : {}),
      } });
    }
    return result.outcome;
  },
});

/**
 * The business's email sequence for the Email page: the one draft when there
 * is one, else the most recently updated sequence; its four emails in send
 * order (each read through `emailStepContent`, so a mismatch shows as
 * unavailable, never as different text) and the document's card. Owner only;
 * the workspace and AI must be on. A failed handoff includes its task ID for retry.
 */
export const emailSequenceDraft = query({
  args: { projectId: v.id("projects") },
  returns: emailSequenceDraftView,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    return await readEmailSequenceDraft(ctx, project);
  },
});

/** The owner-scoped, validated copy used by both Email and read-only chat previews. */
export async function readEmailSequenceDraft(ctx: Ctx, project: Doc<"projects">): Promise<Infer<typeof emailSequenceDraftView>> {
  const business: Business = { ownerId: project.ownerId, projectId: project._id };
  const read = await businessSequences(ctx, business);
  if (!read.ok) return { state: "unavailable" as const };
  const drafts = read.rows.filter((row) => row.status === "draft");
  if (drafts.length > 1) return { state: "unavailable" as const };
  const sequence = drafts[0] ?? read.rows.reduce<Doc<"sequences"> | null>(
    (newest, row) => (newest === null || row.updatedAt > newest.updatedAt ? row : newest),
    null,
  );
  if (sequence === null) return { state: "none" as const };

  // The index reads steps by order: exactly 0–3, once each, all from this business.
  const steps = await stepsOf(ctx, sequence._id);
  const documentId = steps[0]?.documentId;
  if (steps.length !== EMAIL_KINDS.length || documentId === undefined ||
    !steps.every((step, index) => inBusiness(step, business) && Number(step.order) === index)) {
    return { state: "unavailable" as const };
  }
  const document = await ctx.db.get("documents", documentId);
  if (document === null || !inBusiness(document, business) || document.kind !== "email_sequence" || document.archivedAt !== undefined) {
    return { state: "unavailable" as const };
  }
  // Parsed once; each step is then checked against it.
  const parsed = parseEmailSequenceBody(document.body);
  if (parsed === null) return { state: "unavailable" as const };
  const emails: Infer<typeof emailViewValidator>[] = [];
  for (const step of steps) {
    const content = step.documentId === document._id ? emailStepFromSequence(step, parsed) : null;
    if (content === null || !content.ok) return { state: "unavailable" as const };
    const { email } = content;
    emails.push({
      kind: content.kind,
      delayHours: email.delayHours,
      subject: email.subject,
      preview: email.preview,
      body: email.body,
      ...(email.cta === undefined ? {} : { cta: { label: email.cta.label, target: email.cta.target } }),
      goal: email.goal,
    });
  }

  // Newest first, so the newest card within the cap is the one seen.
  const card = (await ctx.db.query("approvals")
    .withIndex("by_subjectId", (q) => q.eq("subjectId", document._id))
    .order("desc")
    .take(CARDS_PER_DOCUMENT_MAX))
    .find((row) => row.kind === "artifact_review" && row.subjectTable === "documents" && inBusiness(row, business)) ?? null;
  const failed = await failedHandoffFor(ctx, document);
  const failedHandoff = failed && {
    taskId: failed._id, reason: failed.crewFailureReason ?? "Elle could not finish the email rewrite.",
    canRetry: (await approvedBrandKit(ctx, project))?._id === failed.requiresBrandDocumentId && Boolean((await revisionNoteFor(ctx, failed._id))?.trim()),
  };
  return {
    state: "ready" as const,
    status: sequence.status,
    name: parsed.name,
    senderName: parsed.senderName,
    emails,
    ...(failedHandoff ? { failedHandoff } : {}),
    card: card === null
      ? null
      : { approvalId: card._id, status: card.status, changeRound: card.changeRound, expiresAt: approvalExpiresAt(card.createdAt) },
  };
}
