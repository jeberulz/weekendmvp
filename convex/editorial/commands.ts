import { ConvexError, v } from "convex/values";

import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  approvalArgs,
  candidateDecisionArgs,
  draftCarryArgs,
  flagArgs,
  releaseStateArgs,
  saveDraftPatchArgs,
  targetArgs,
} from "./args";
import { commandRepository } from "./session";
import { activatePublicRelease, removePublicIdea, stageRelease } from "./publication";
import { nullableString } from "./validators";

/**
 * Public editorial commands (WP46-E4c). One mutation per repository command;
 * there is no bulk review, approval, publish or delete. Each resolves the
 * caller from the verified, unexpired session and returns the repository's
 * `CommandResult`. Version fences, request keys, strong authentication and
 * state preconditions are all re-checked by the shared core inside this
 * transaction. Refusals by the capability holder are recorded; an account
 * without the capability has its refusals recorded up to a rate limit; an
 * anonymous call writes nothing.
 */

/* Revisions ---------------------------------------------------------------- */

export const createRevision = mutation({
  args: {
    ideaId: v.string(),
    fromRevisionId: nullableString,
    idempotencyKey: v.string(),
    carry: v.optional(v.union(draftCarryArgs, v.null())),
  },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).createRevision(args.ideaId, args.fromRevisionId, args.idempotencyKey, args.carry ?? null),
});

export const discardRevision = mutation({
  args: { ideaId: v.string(), revisionId: v.string(), expectedVersion: v.number(), reason: v.string() },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).discardRevision(args.ideaId, args.revisionId, args.expectedVersion, args.reason),
});

export const saveDraft = mutation({
  args: {
    ideaId: v.string(),
    revisionId: v.string(),
    baseVersion: v.number(),
    patch: saveDraftPatchArgs,
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).saveDraft(args.ideaId, args.revisionId, args.baseVersion, args.patch, args.idempotencyKey),
});

/* Candidate decision ------------------------------------------------------------ */

export const setCandidateDecision = mutation({
  args: { ideaId: v.string(), expectedVersion: v.number(), input: candidateDecisionArgs },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).setCandidateDecision(args.ideaId, args.expectedVersion, args.input),
});

/* Review ------------------------------------------------------------------------- */

export const markReviewed = mutation({
  args: { revisionId: v.string(), reviewItemId: v.string(), dependencyHash: v.string(), note: nullableString },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).markReviewed(args.revisionId, args.reviewItemId, args.dependencyHash, args.note),
});

export const retractReview = mutation({
  args: { revisionId: v.string(), reviewItemId: v.string() },
  handler: async (ctx, args) => (await commandRepository(ctx)).retractReview(args.revisionId, args.reviewItemId),
});

export const flagReviewItem = mutation({
  args: { revisionId: v.string(), reviewItemId: v.string(), dependencyHash: v.string(), input: flagArgs },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).flagReviewItem(args.revisionId, args.reviewItemId, args.dependencyHash, args.input),
});

export const resolveIssue = mutation({
  args: { revisionId: v.string(), issueId: v.string(), dependencyHash: v.string(), note: v.string() },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).resolveIssue(args.revisionId, args.issueId, args.dependencyHash, args.note),
});

export const addNote = mutation({
  args: { revisionId: v.string(), target: targetArgs, note: v.string() },
  handler: async (ctx, args) => (await commandRepository(ctx)).addNote(args.revisionId, args.target, args.note),
});

export const requestChanges = mutation({
  args: { revisionId: v.string(), note: v.string() },
  handler: async (ctx, args) => (await commandRepository(ctx)).requestChanges(args.revisionId, args.note),
});

export const resumeReview = mutation({
  args: { revisionId: v.string() },
  handler: async (ctx, args) => (await commandRepository(ctx)).resumeReview(args.revisionId),
});

export const runChecks = mutation({
  args: { revisionId: v.string(), expectedArtifactHash: v.string() },
  handler: async (ctx, args) => (await commandRepository(ctx)).runChecks(args.revisionId, args.expectedArtifactHash),
});

export const approveRevision = mutation({
  args: { revisionId: v.string(), artifactHash: v.string(), input: approvalArgs },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).approveRevision(args.revisionId, args.artifactHash, args.input),
});

/* Releases and lifecycle ----------------------------------------------------------- */

export const prepareRelease = mutation({
  args: { revisionId: v.string(), expectedLiveReleaseId: nullableString, idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const result = await (await commandRepository(ctx)).prepareRelease(args.revisionId, args.expectedLiveReleaseId, args.idempotencyKey);
    if (result.ok) {
      await stageRelease(ctx, result.value.releaseId);
      await ctx.scheduler.runAfter(0, internal.editorial.worker.run, { releaseId: result.value.releaseId });
    }
    return result;
  },
});

export const publishRelease = mutation({
  args: { releaseId: v.string(), expectedState: releaseStateArgs, approvalId: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const result = await (await commandRepository(ctx)).publishRelease(args.releaseId, args.expectedState, args.approvalId, args.idempotencyKey);
    if (result.ok) await ctx.scheduler.runAfter(0, internal.editorial.worker.run, { releaseId: result.value.releaseId });
    return result;
  },
});

export const cancelRelease = mutation({
  args: { releaseId: v.string(), expectedState: releaseStateArgs, reason: v.string() },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).cancelRelease(args.releaseId, args.expectedState, args.reason),
});

export const retryRelease = mutation({
  args: { releaseId: v.string(), expectedState: releaseStateArgs, idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const result = await (await commandRepository(ctx)).retryRelease(args.releaseId, args.expectedState, args.idempotencyKey);
    if (result.ok) await ctx.scheduler.runAfter(0, internal.editorial.worker.run, { releaseId: result.value.releaseId });
    return result;
  },
});

export const reconcileRelease = mutation({
  args: { releaseId: v.string() },
  handler: async (ctx, args) => {
    const pending = await ctx.db.query("editorial_releases")
      .withIndex("by_key", (q) => q.eq("key", args.releaseId)).unique();
    const result = await (await commandRepository(ctx)).reconcileRelease(args.releaseId);
    if (result.ok && result.value.state === "succeeded" &&
        pending?.state === "needs_reconciliation" && pending.observation?.activated) {
      const idea = await ctx.db.query("editorial_ideas")
        .withIndex("by_key", (q) => q.eq("key", pending.ideaId)).unique();
      const pointer = idea ? await ctx.db.query("editorial_public_pointers")
        .withIndex("by_slug", (q) => q.eq("slug", idea.slug)).unique() : null;
      if (pointer?.releaseId !== args.releaseId) {
        throw new ConvexError({ code: "POINTER_CONFLICT", message: "No activated public pointer was found. Probe again before reconciling." });
      }
    }
    if (result.ok && result.value.state === "succeeded") await activatePublicRelease(ctx, args.releaseId);
    return result;
  },
});

export const requestRollback = mutation({
  args: {
    ideaId: v.string(),
    targetReleaseId: v.string(),
    expectedLiveReleaseId: v.string(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await (await commandRepository(ctx)).requestRollback(
      args.ideaId,
      args.targetReleaseId,
      args.expectedLiveReleaseId,
      args.reason,
      args.idempotencyKey,
    );
    if (result.ok) {
      await stageRelease(ctx, result.value.releaseId);
      await ctx.scheduler.runAfter(0, internal.editorial.worker.run, { releaseId: result.value.releaseId });
    }
    return result;
  },
});

export const unpublishIdea = mutation({
  args: { ideaId: v.string(), expectedLiveReleaseId: v.string(), reason: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const result = await (await commandRepository(ctx)).unpublishIdea(args.ideaId, args.expectedLiveReleaseId, args.reason, args.idempotencyKey);
    if (result.ok) {
      await removePublicIdea(ctx, args.ideaId);
      await ctx.scheduler.runAfter(0, internal.editorial.worker.run, { releaseId: result.value.releaseId });
    }
    return result;
  },
});

export const trashIdea = mutation({
  args: { ideaId: v.string(), expectedVersion: v.number(), reason: v.string() },
  handler: async (ctx, args) => (await commandRepository(ctx)).trashIdea(args.ideaId, args.expectedVersion, args.reason),
});

export const restoreIdea = mutation({
  args: { ideaId: v.string(), expectedVersion: v.number(), reason: v.string() },
  handler: async (ctx, args) =>
    (await commandRepository(ctx)).restoreIdea(args.ideaId, args.expectedVersion, args.reason),
});
