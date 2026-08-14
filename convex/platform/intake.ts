import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { requireCurrentPlatformUser, requireOwnedProject } from "./authz";
import {
  assertBriefPayloadSource,
  briefDisplayTitle,
  briefInputValidator,
  initialRepositoryBrief,
  nextTimestamp,
  normalizeBriefInput,
  normalizeDraftBriefInput,
  normalizeIdempotencyKey,
  parseBriefPayload,
  repositorySnapshot,
  serializeBriefPayload,
  type BriefInput,
  type BriefPayload,
} from "./briefPayload";
import {
  assertBriefTransition,
  assertProjectTransition,
  assertSubmissionTransition,
} from "./transitions";

type GraphCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

function denyNotFound(): never {
  throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
}

async function briefByRevision(
  ctx: GraphCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  revision: bigint,
) {
  return await ctx.db
    .query("briefs")
    .withIndex("by_ownerId_and_projectId_and_revision", (q) =>
      q.eq("ownerId", ownerId).eq("projectId", projectId).eq("revision", revision),
    )
    .unique();
}

async function latestBrief(
  ctx: GraphCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
) {
  return await ctx.db
    .query("briefs")
    .withIndex("by_ownerId_and_projectId_and_revision", (q) =>
      q.eq("ownerId", ownerId).eq("projectId", projectId),
    )
    .order("desc")
    .first();
}

async function submissionForRevision(
  ctx: GraphCtx,
  project: Doc<"projects">,
  revision: bigint,
) {
  const submission = await ctx.db
    .query("submissions")
    .withIndex("by_ownerId_and_idempotencyKey", (q) =>
      q
        .eq("ownerId", project.ownerId)
        .eq(
          "idempotencyKey",
          `${project.idempotencyKey}:revision:${revision}`,
        ),
    )
    .unique();
  return submission?.projectId === project._id && submission.archivedAt === undefined
    ? submission
    : null;
}

async function loadBriefDocument(
  ctx: GraphCtx,
  brief: Doc<"briefs">,
  project: Doc<"projects">,
) {
  if (brief.ownerId !== project.ownerId || brief.projectId !== project._id) {
    return denyNotFound();
  }
  const document = brief.documentId
    ? await ctx.db.get("documents", brief.documentId)
    : null;
  if (
    document === null ||
    document.ownerId !== project.ownerId ||
    document.projectId !== project._id ||
    document.kind !== "brief" ||
    document.format !== "json" ||
    document.archivedAt !== undefined
  ) {
    return denyNotFound();
  }
  return document;
}

async function existingCreationGraph(
  ctx: MutationCtx,
  project: Doc<"projects">,
  expectedSource: "repository_idea" | "own_idea",
  expectedIdeaId?: Id<"ideas">,
) {
  if (
    project.source !== expectedSource ||
    project.sourceIdeaId !== expectedIdeaId ||
    project.archivedAt !== undefined
  ) {
    throw new ConvexError({ code: "IDEMPOTENCY_CONFLICT" });
  }
  const brief = await briefByRevision(ctx, project.ownerId, project._id, 1n);
  const submission = await ctx.db
    .query("submissions")
    .withIndex("by_ownerId_and_idempotencyKey", (q) =>
      q
        .eq("ownerId", project.ownerId)
        .eq("idempotencyKey", `${project.idempotencyKey}:revision:1`),
    )
    .unique();
  if (
    !brief ||
    !submission ||
    submission.projectId !== project._id ||
    submission.archivedAt !== undefined
  ) {
    throw new ConvexError({ code: "INCOMPLETE_PROJECT_GRAPH" });
  }
  const document = await loadBriefDocument(ctx, brief, project);
  const payload = assertBriefPayloadSource(
    parseBriefPayload(document.body),
    project,
  );
  return {
    projectId: project._id,
    briefId: brief._id,
    revision: brief.revision,
    updatedAt: brief.updatedAt,
    input: payload.brief,
  };
}

async function createInitialGraph(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  source: "repository_idea" | "own_idea",
  projectKey: string,
  payload: BriefPayload,
  sourceIdeaId?: Id<"ideas">,
) {
  const now = Date.now();
  const body = serializeBriefPayload(payload);
  const projectId = await ctx.db.insert("projects", {
    ownerId,
    source,
    ...(sourceIdeaId ? { sourceIdeaId } : {}),
    title: briefDisplayTitle(payload.brief),
    status: "draft",
    idempotencyKey: projectKey,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("submissions", {
    ownerId,
    projectId,
    status: "draft",
    idempotencyKey: `${projectKey}:revision:1`,
    payload: body,
    createdAt: now,
    updatedAt: now,
  });
  const documentId = await ctx.db.insert("documents", {
    ownerId,
    projectId,
    kind: "brief",
    format: "json",
    title: `${briefDisplayTitle(payload.brief)} brief`,
    body,
    createdAt: now,
    updatedAt: now,
  });
  const briefId = await ctx.db.insert("briefs", {
    ownerId,
    projectId,
    status: "draft",
    revision: 1n,
    documentId,
    createdAt: now,
    updatedAt: now,
  });
  return {
    projectId,
    briefId,
    revision: 1n,
    updatedAt: now,
    input: payload.brief,
  };
}

function sameBriefInput(left: BriefInput, right: BriefInput): boolean {
  return (
    left.title === right.title &&
    left.problem === right.problem &&
    left.audience === right.audience &&
    left.outcome === right.outcome &&
    left.constraints === right.constraints
  );
}

export const startOwnIdea = mutation({
  args: { idempotencyKey: v.string(), input: briefInputValidator },
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const input = normalizeDraftBriefInput(args.input);
    const projectKey = `wp25:own:${normalizeIdempotencyKey(args.idempotencyKey)}`;
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_idempotencyKey", (q) =>
        q.eq("ownerId", user._id).eq("idempotencyKey", projectKey),
      )
      .unique();
    if (existing) {
      const canonical = await existingCreationGraph(ctx, existing, "own_idea");
      return {
        ...canonical,
        acceptedInput: sameBriefInput(canonical.input, input),
      };
    }
    const created = await createInitialGraph(ctx, user._id, "own_idea", projectKey, {
      contractVersion: 1,
      source: "own_idea",
      brief: input,
    });
    return { ...created, acceptedInput: true };
  },
});

export const startRepositoryIdea = mutation({
  args: { idempotencyKey: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const slug = args.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) {
      return denyNotFound();
    }
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!idea) return denyNotFound();
    const projectKey = `wp25:repository:${normalizeIdempotencyKey(args.idempotencyKey)}`;
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_idempotencyKey", (q) =>
        q.eq("ownerId", user._id).eq("idempotencyKey", projectKey),
      )
      .unique();
    if (existing) {
      return await existingCreationGraph(
        ctx,
        existing,
        "repository_idea",
        idea._id,
      );
    }
    const snapshot = repositorySnapshot(idea);
    return await createInitialGraph(
      ctx,
      user._id,
      "repository_idea",
      projectKey,
      {
        contractVersion: 1,
        source: "repository_idea",
        sourceSnapshot: snapshot,
        brief: initialRepositoryBrief(snapshot),
      },
      idea._id,
    );
  },
});

function payloadWithInput(existing: BriefPayload, input: BriefInput): BriefPayload {
  return {
    contractVersion: 1,
    source: existing.source,
    ...(existing.sourceSnapshot
      ? { sourceSnapshot: existing.sourceSnapshot }
      : {}),
    brief: normalizeDraftBriefInput(input),
  };
}

export const saveDraft = mutation({
  args: {
    projectId: v.id("projects"),
    revision: v.int64(),
    expectedUpdatedAt: v.number(),
    input: briefInputValidator,
  },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    const brief = await briefByRevision(
      ctx,
      project.ownerId,
      project._id,
      args.revision,
    );
    if (!brief || brief.status !== "draft" || brief.archivedAt !== undefined) {
      return denyNotFound();
    }
    const latest = await latestBrief(ctx, project.ownerId, project._id);
    if (latest?._id !== brief._id) {
      throw new ConvexError({ code: "STALE_BRIEF_REVISION" });
    }
    const document = await loadBriefDocument(ctx, brief, project);
    const nextPayload = payloadWithInput(
      assertBriefPayloadSource(parseBriefPayload(document.body), project),
      args.input,
    );
    const body = serializeBriefPayload(nextPayload);
    if (document.body === body) {
      return { projectId: project._id, revision: brief.revision, updatedAt: brief.updatedAt };
    }
    if (brief.updatedAt !== args.expectedUpdatedAt) {
      throw new ConvexError({ code: "STALE_BRIEF_WRITE" });
    }
    const submission = await submissionForRevision(ctx, project, brief.revision);
    if (!submission || submission.status !== "draft") return denyNotFound();
    const updatedAt = nextTimestamp(brief.updatedAt);
    await ctx.db.patch("documents", document._id, {
      title: `${briefDisplayTitle(nextPayload.brief)} brief`,
      body,
      updatedAt,
    });
    await ctx.db.patch("submissions", submission._id, { payload: body, updatedAt });
    await ctx.db.patch("briefs", brief._id, { updatedAt });
    await ctx.db.patch("projects", project._id, {
      ...(project.source === "own_idea"
        ? { title: briefDisplayTitle(nextPayload.brief) }
        : {}),
      updatedAt,
    });
    return { projectId: project._id, revision: brief.revision, updatedAt };
  },
});

export const confirmBrief = mutation({
  args: { projectId: v.id("projects"), revision: v.int64() },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    const brief = await briefByRevision(
      ctx,
      project.ownerId,
      project._id,
      args.revision,
    );
    if (!brief || brief.archivedAt !== undefined) return denyNotFound();
    const latest = await latestBrief(ctx, project.ownerId, project._id);
    if (latest?._id !== brief._id) {
      throw new ConvexError({ code: "STALE_BRIEF_REVISION" });
    }
    if (brief.status === "confirmed") {
      return { projectId: project._id, revision: brief.revision, status: brief.status };
    }
    if (brief.status !== "draft") return denyNotFound();
    const document = await loadBriefDocument(ctx, brief, project);
    const payload = assertBriefPayloadSource(
      parseBriefPayload(document.body),
      project,
    );
    // Draft persistence accepts partial answers; confirmation is the hard
    // boundary that enforces the complete brief contract server-side.
    normalizeBriefInput(payload.brief);
    const submission = await submissionForRevision(ctx, project, brief.revision);
    if (!submission || submission.status !== "draft") return denyNotFound();
    const priorConfirmed = await ctx.db
      .query("briefs")
      .withIndex("by_projectId_and_status_and_updatedAt", (q) =>
        q.eq("projectId", project._id).eq("status", "confirmed"),
      )
      .order("desc")
      .first();
    if (priorConfirmed && priorConfirmed.ownerId !== project.ownerId) {
      return denyNotFound();
    }
    const updatedAt = nextTimestamp(brief.updatedAt);
    if (priorConfirmed) {
      await ctx.db.patch("briefs", priorConfirmed._id, {
        status: assertBriefTransition(priorConfirmed.status, "superseded"),
        updatedAt,
      });
    }
    await ctx.db.patch("briefs", brief._id, {
      status: assertBriefTransition(brief.status, "confirmed"),
      updatedAt,
    });
    await ctx.db.patch("submissions", submission._id, {
      status: assertSubmissionTransition(submission.status, "submitted"),
      updatedAt,
    });
    await ctx.db.patch("projects", project._id, {
      ...(project.status === "draft"
        ? { status: assertProjectTransition(project.status, "validating") }
        : {}),
      updatedAt,
    });
    return { projectId: project._id, revision: brief.revision, status: "confirmed" as const };
  },
});

export const beginRevision = mutation({
  args: { projectId: v.id("projects"), confirmedRevision: v.int64() },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    const latest = await latestBrief(ctx, project.ownerId, project._id);
    if (!latest) return denyNotFound();
    if (
      latest.status === "draft" &&
      latest.revision === args.confirmedRevision + 1n
    ) {
      return { projectId: project._id, briefId: latest._id, revision: latest.revision };
    }
    if (
      latest.status !== "confirmed" ||
      latest.revision !== args.confirmedRevision
    ) {
      throw new ConvexError({ code: "STALE_BRIEF_REVISION" });
    }
    const sourceDocument = await loadBriefDocument(ctx, latest, project);
    const body = serializeBriefPayload(
      assertBriefPayloadSource(parseBriefPayload(sourceDocument.body), project),
    );
    const revision = latest.revision + 1n;
    const now = nextTimestamp(latest.updatedAt);
    const projectKey = `${project.idempotencyKey}:revision:${revision}`;
    await ctx.db.insert("submissions", {
      ownerId: project.ownerId,
      projectId: project._id,
      status: "draft",
      idempotencyKey: projectKey,
      payload: body,
      createdAt: now,
      updatedAt: now,
    });
    const documentId = await ctx.db.insert("documents", {
      ownerId: project.ownerId,
      projectId: project._id,
      kind: "brief",
      format: "json",
      title: sourceDocument.title,
      body,
      createdAt: now,
      updatedAt: now,
    });
    const briefId = await ctx.db.insert("briefs", {
      ownerId: project.ownerId,
      projectId: project._id,
      status: "draft",
      revision,
      documentId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("projects", project._id, { updatedAt: now });
    return { projectId: project._id, briefId, revision };
  },
});

export const getOwnIdeaDraftByKey = query({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    let key: string;
    try {
      key = normalizeIdempotencyKey(args.idempotencyKey);
    } catch {
      return null;
    }
    const project = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_idempotencyKey", (q) =>
        q
          .eq("ownerId", user._id)
          .eq("idempotencyKey", `wp25:own:${key}`),
      )
      .unique();
    if (
      !project ||
      project.source !== "own_idea" ||
      project.archivedAt !== undefined
    ) {
      return null;
    }
    const draft = await ctx.db
      .query("briefs")
      .withIndex("by_projectId_and_status_and_updatedAt", (q) =>
        q.eq("projectId", project._id).eq("status", "draft"),
      )
      .order("desc")
      .first();
    if (!draft || draft.ownerId !== user._id || draft.archivedAt !== undefined) {
      return null;
    }
    const document = await loadBriefDocument(ctx, draft, project);
    return {
      projectId: project._id,
      title: project.title,
      revision: draft.revision,
      updatedAt: draft.updatedAt,
      input: assertBriefPayloadSource(
        parseBriefPayload(document.body),
        project,
      ).brief,
    };
  },
});
