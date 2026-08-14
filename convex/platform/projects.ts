import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireCurrentPlatformUser, requireOwnedProject } from "./authz";
import { assertBriefPayloadSource, parseBriefPayload } from "./briefPayload";
import { projectSourceValidator, projectStatusValidator } from "./validators";

const projectCardValidator = v.object({
  projectId: v.id("projects"),
  title: v.string(),
  source: projectSourceValidator,
  sourceSlug: v.optional(v.string()),
  status: projectStatusValidator,
  updatedAt: v.number(),
  nextAction: v.union(
    v.literal("resume_brief"),
    v.literal("review_brief"),
    v.literal("continue_project"),
  ),
});

export const listOwned = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(projectCardValidator),
  handler: async (ctx, args) => {
    if (
      !Number.isFinite(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 50
    ) {
      throw new ConvexError({ code: "INVALID_PAGE_SIZE" });
    }
    const user = await requireCurrentPlatformUser(ctx);
    const result = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = [];
    for (const project of result.page) {
      if (project.archivedAt !== undefined) continue;
      const draft = await ctx.db
        .query("briefs")
        .withIndex("by_projectId_and_status_and_updatedAt", (q) =>
          q.eq("projectId", project._id).eq("status", "draft"),
        )
        .order("desc")
        .first();
      const sourceIdea = project.sourceIdeaId
        ? await ctx.db.get("ideas", project.sourceIdeaId)
        : null;
      page.push({
        projectId: project._id,
        title: project.title,
        source: project.source,
        ...(sourceIdea ? { sourceSlug: sourceIdea.slug } : {}),
        status: project.status,
        updatedAt: project.updatedAt,
        nextAction: draft?.ownerId === user._id && draft.archivedAt === undefined
          ? ("resume_brief" as const)
          : project.status === "validating"
            ? ("review_brief" as const)
            : ("continue_project" as const),
      });
    }
    return { ...result, page };
  },
});

export const getOwned = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    const briefs = await ctx.db
      .query("briefs")
      .withIndex("by_ownerId_and_projectId_and_revision", (q) =>
        q.eq("ownerId", project.ownerId).eq("projectId", project._id),
      )
      .order("desc")
      .take(20);
    const history = [];
    for (const brief of briefs) {
      if (brief.archivedAt !== undefined || !brief.documentId) continue;
      const document = await ctx.db.get("documents", brief.documentId);
      if (
        !document ||
        document.ownerId !== project.ownerId ||
        document.projectId !== project._id ||
        document.archivedAt !== undefined
      ) {
        continue;
      }
      history.push({
        briefId: brief._id,
        revision: brief.revision,
        status: brief.status,
        updatedAt: brief.updatedAt,
        input: assertBriefPayloadSource(
          parseBriefPayload(document.body),
          project,
        ).brief,
      });
    }
    const sourceIdea = project.sourceIdeaId
      ? await ctx.db.get("ideas", project.sourceIdeaId)
      : null;
    return {
      project: {
        projectId: project._id,
        title: project.title,
        source: project.source,
        ...(sourceIdea ? { sourceSlug: sourceIdea.slug } : {}),
        status: project.status,
        updatedAt: project.updatedAt,
      },
      currentDraft: history.find((item) => item.status === "draft") ?? null,
      latestConfirmed:
        history.find((item) => item.status === "confirmed") ?? null,
      history,
    };
  },
});
