import { ConvexError } from "convex/values";

import { computeRevisionHashes } from "../../lib/editorial/domain/artifact";
import { editorialMetadataSchema } from "../../lib/editorial/contracts/metadata";
import type { MutationCtx } from "../_generated/server";

/** Store an exact approved artifact privately. It is unreachable from public queries until activation. */
export async function stageRelease(ctx: MutationCtx, releaseId: string): Promise<void> {
  const release = await ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", releaseId)).unique();
  if (!release || !release.revisionId || !release.approvalId || release.operation === "unpublish") {
    throw new ConvexError({ code: "INVALID_RELEASE", message: "Release has no approved revision." });
  }
  const [revision, approval, idea, existing] = await Promise.all([
    ctx.db.query("editorial_revisions").withIndex("by_key", (q) => q.eq("key", release.revisionId!)).unique(),
    ctx.db.query("editorial_approvals").withIndex("by_key", (q) => q.eq("key", release.approvalId!)).unique(),
    ctx.db.query("editorial_ideas").withIndex("by_key", (q) => q.eq("key", release.ideaId)).unique(),
    ctx.db.query("editorial_public_versions").withIndex("by_releaseId", (q) => q.eq("releaseId", releaseId)).unique(),
  ]);
  const selectedApproval = approval;
  const rollbackTarget = release.operation === "rollback" && release.rollbackTargetReleaseId
    ? await ctx.db.query("editorial_releases")
      .withIndex("by_key", (q) => q.eq("key", release.rollbackTargetReleaseId!)).unique()
    : null;
  const approvalAllowed = release.operation === "rollback"
    ? rollbackTarget?.state === "succeeded" && rollbackTarget.revisionId === revision?.key
    : selectedApproval?.status === "active";
  if (!revision || !idea || revision.ideaId !== idea.key ||
      !selectedApproval || !approvalAllowed ||
      selectedApproval.ideaId !== idea.key || selectedApproval.revisionId !== revision.key ||
      idea.publication.liveReleaseId !== release.expectedLiveReleaseId ||
      idea.generation !== release.generation) {
    throw new ConvexError({ code: "STALE_RELEASE", message: "Release approval or generation changed." });
  }
  const metadata = editorialMetadataSchema.parse(revision.metadata);
  const hash = (await computeRevisionHashes({ ...revision, metadata })).artifact;
  if (hash !== selectedApproval.artifactHash) {
    throw new ConvexError({ code: "ARTIFACT_MISMATCH", message: "Approved revision bytes changed." });
  }
  if (existing) {
    if (existing.artifactHash !== hash || existing.revisionId !== revision.key) {
      throw new ConvexError({ code: "STAGED_CONFLICT", message: "Staged release differs from its approved revision." });
    }
    return;
  }
  await ctx.db.insert("editorial_public_versions", {
    releaseId,
    ideaId: idea.key,
    revisionId: revision.key,
    artifactHash: hash,
    title: revision.title,
    markdown: revision.markdown,
    metadata: revision.metadata,
    stagedAt: new Date(Date.now()).toISOString(),
  });
}

/** One transaction after the core has committed a succeeded activation. */
export async function activatePublicRelease(ctx: MutationCtx, releaseId: string): Promise<void> {
  const release = await ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", releaseId)).unique();
  if (!release || (release.state !== "verifying_public" && release.state !== "succeeded") || !release.revisionId) {
    throw new ConvexError({ code: "NOT_ACTIVE", message: "Release is not activated." });
  }
  const [idea, version] = await Promise.all([
    ctx.db.query("editorial_ideas").withIndex("by_key", (q) => q.eq("key", release.ideaId)).unique(),
    ctx.db.query("editorial_public_versions").withIndex("by_releaseId", (q) => q.eq("releaseId", releaseId)).unique(),
  ]);
  if (!idea || !version || idea.publication.state !== "live" ||
      idea.publication.liveReleaseId !== releaseId ||
      version.ideaId !== idea.key || version.revisionId !== release.revisionId) {
    throw new ConvexError({ code: "POINTER_CONFLICT", message: "Active release and staged artifact disagree." });
  }
  const pointer = await ctx.db.query("editorial_public_pointers")
    .withIndex("by_slug", (q) => q.eq("slug", idea.slug)).unique();
  const value = {
    slug: idea.slug,
    state: "released" as const,
    releaseId,
    generation: idea.generation,
    firstPublishedAt: idea.publication.firstPublishedAt,
    updatedAt: idea.publication.lastReleasedAt ?? new Date(Date.now()).toISOString(),
    title: version.title,
    metadata: version.metadata,
  };
  if (pointer) await ctx.db.replace("editorial_public_pointers", pointer._id, value);
  else await ctx.db.insert("editorial_public_pointers", value);

  const row = await ctx.db.query("ideas").withIndex("by_slug", (q) => q.eq("slug", idea.slug)).unique();
  const metadata = version.metadata;
  const publishedAt = Date.parse(idea.publication.firstPublishedAt ?? "") || Date.now();
  // Replace, preserving the document id used by saved member references. Old
  // scores, sources, provenance and OG data must not be presented as evidence
  // for a newly approved revision that did not contain those fields.
  const projected = {
    slug: idea.slug,
    title: version.title,
    description: metadata.description,
    publishedAt: row?.publishedAt ?? publishedAt,
    category: metadata.category,
    buildTime: metadata.buildTime,
    revenueGoal: metadata.revenueGoal,
    applicationCategory: "BusinessApplication",
    tools: metadata.tools,
    audiences: metadata.audiences,
    bodyMode: "convex" as const,
    body: version.markdown,
    editorialVisibility: "live" as const,
  };
  if (row) await ctx.db.replace("ideas", row._id, projected);
  else await ctx.db.insert("ideas", projected);
}

/** Emergency removal is committed in the same mutation as the generation fence. */
export async function removePublicIdea(ctx: MutationCtx, ideaId: string): Promise<void> {
  const idea = await ctx.db.query("editorial_ideas")
    .withIndex("by_key", (q) => q.eq("key", ideaId)).unique();
  if (!idea || idea.publication.state !== "unpublished") {
    throw new ConvexError({ code: "NOT_UNPUBLISHED", message: "Editorial pointer was not revoked." });
  }
  const pointer = await ctx.db.query("editorial_public_pointers")
    .withIndex("by_slug", (q) => q.eq("slug", idea.slug)).unique();
  const value = {
    slug: idea.slug,
    state: "removed" as const,
    releaseId: null,
    generation: idea.generation,
    firstPublishedAt: idea.publication.firstPublishedAt,
    updatedAt: idea.publication.unpublishedAt ?? new Date(Date.now()).toISOString(),
    title: null,
    metadata: null,
  };
  if (pointer) await ctx.db.replace("editorial_public_pointers", pointer._id, value);
  else await ctx.db.insert("editorial_public_pointers", value);
  const row = await ctx.db.query("ideas").withIndex("by_slug", (q) => q.eq("slug", idea.slug)).unique();
  if (row) await ctx.db.patch("ideas", row._id, { editorialVisibility: "removed", body: "" });
}
