import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireCurrentPlatformUser, requireOwnedProject } from "./authz";
import { assertBriefPayloadSource, parseBriefPayload } from "./briefPayload";
import {
  projectSourceValidator,
  projectStatusValidator,
  type SiteStatus,
} from "./validators";

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

export type OwnedSiteSummary = {
  status: SiteStatus;
  hostname?: string;
  publishable: boolean;
  live: boolean;
};

export async function ownedSiteSummary(
  ctx: QueryCtx,
  project: Doc<"projects">,
): Promise<OwnedSiteSummary | null> {
  const sites = await ctx.db
    .query("site_configs")
    .withIndex("by_ownerId_and_projectId", (q) =>
      q.eq("ownerId", project.ownerId).eq("projectId", project._id),
    )
    .take(2);
  const site = sites.length === 1 ? sites[0] : null;
  if (
    site === null ||
    site.archivedAt !== undefined ||
    site.ownerId !== project.ownerId ||
    site.projectId !== project._id
  ) {
    return null;
  }
  const latest = await ctx.db
    .query("site_versions")
    .withIndex("by_siteConfigId_and_version", (q) =>
      q.eq("siteConfigId", site._id),
    )
    .order("desc")
    .first();
  const publishable =
    latest !== null &&
    latest.documentId !== undefined &&
    latest.ownerId === project.ownerId &&
    latest.projectId === project._id;
  return {
    status: site.status,
    ...(site.hostname !== undefined ? { hostname: site.hostname } : {}),
    publishable,
    live:
      site.status === "published" &&
      site.hostname !== undefined &&
      site.currentVersionId !== undefined,
  };
}

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
      site: await ownedSiteSummary(ctx, project),
      currentDraft: history.find((item) => item.status === "draft") ?? null,
      latestConfirmed:
        history.find((item) => item.status === "confirmed") ?? null,
      history,
    };
  },
});
