import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireCurrentPlatformUser, requireOwnedProject } from "./authz";
import { ownedSiteSummary } from "./projects";

const COLD_CARD_LIMIT = 3;
const IDEA_READ_LIMIT = 200;
const PROJECT_READ_LIMIT = 12;

const coldCardValidator = v.object({
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  category: v.string(),
  buildTime: v.string(),
});

const libraryCardValidator = v.object({
  ideaId: v.id("ideas"),
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  category: v.string(),
  buildTime: v.string(),
  building: v.boolean(),
  projectId: v.optional(v.id("projects")),
});

const otherProjectValidator = v.object({
  projectId: v.id("projects"),
  title: v.string(),
  hostname: v.optional(v.string()),
});

const currentReturnValidator = v.union(
  v.object({
    kind: v.literal("cold"),
    cards: v.array(coldCardValidator),
    others: v.array(otherProjectValidator),
  }),
  v.object({
    kind: v.literal("day1"),
    projectId: v.id("projects"),
    title: v.string(),
    sourceSlug: v.optional(v.string()),
    renderSpec: v.union(v.string(), v.null()),
    publishable: v.boolean(),
    paid: v.boolean(),
    others: v.array(otherProjectValidator),
  }),
  v.object({
    kind: v.literal("dayn"),
    projectId: v.id("projects"),
    title: v.string(),
    hostname: v.string(),
    sourceSlug: v.optional(v.string()),
    renderSpec: v.union(v.string(), v.null()),
    paid: v.boolean(),
    others: v.array(otherProjectValidator),
  }),
);

function canonicalScore(idea: Doc<"ideas">): number {
  if (idea.scores === undefined) return 0;
  const values = [
    idea.scores.opportunity,
    idea.scores.pain,
    idea.scores.timing,
    idea.scores.builder_confidence,
  ];
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rankIdeas(ideas: Doc<"ideas">[], sort: "score" | "newest") {
  return [...ideas].sort((a, b) => {
    if (sort === "newest") {
      if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
      return a.slug.localeCompare(b.slug);
    }
    const scoreDelta = canonicalScore(b) - canonicalScore(a);
    if (scoreDelta !== 0) return scoreDelta;
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
    return a.slug.localeCompare(b.slug);
  });
}

async function loadPublishedIdeas(ctx: QueryCtx): Promise<Doc<"ideas">[]> {
  return await ctx.db.query("ideas").withIndex("by_publishedAt").order("desc").take(IDEA_READ_LIMIT);
}

async function ownerProjectForIdea(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  ideaId: Id<"ideas">,
) {
  return await ctx.db
    .query("projects")
    .withIndex("by_ownerId_and_sourceIdeaId_and_archivedAt", (q) =>
      q.eq("ownerId", ownerId).eq("sourceIdeaId", ideaId).eq("archivedAt", undefined),
    )
    .first();
}

async function latestRenderSpec(
  ctx: QueryCtx,
  project: Doc<"projects">,
): Promise<string | null> {
  const sites = await ctx.db
    .query("site_configs")
    .withIndex("by_ownerId_and_projectId", (q) =>
      q.eq("ownerId", project.ownerId).eq("projectId", project._id),
    )
    .take(2);
  const site = sites.length === 1 ? sites[0] : null;
  if (site === null || site.archivedAt !== undefined) return null;
  const latest = await ctx.db
    .query("site_versions")
    .withIndex("by_siteConfigId_and_version", (q) => q.eq("siteConfigId", site._id))
    .order("desc")
    .first();
  if (
    latest === null ||
    latest.documentId === undefined ||
    latest.ownerId !== project.ownerId ||
    latest.projectId !== project._id
  ) {
    return null;
  }
  const document = await ctx.db.get("documents", latest.documentId);
  if (
    document === null ||
    document.ownerId !== project.ownerId ||
    document.projectId !== project._id ||
    document.archivedAt !== undefined
  ) {
    return null;
  }
  return document.body ?? null;
}

async function projectPaid(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
) {
  const paid = await ctx.db
    .query("purchases")
    .withIndex("by_ownerId_and_status_and_createdAt", (q) =>
      q.eq("ownerId", ownerId).eq("status", "paid"),
    )
    .order("desc")
    .take(20);
  return paid.some((purchase) => purchase.projectId === projectId);
}

async function ownedProjects(ctx: QueryCtx, ownerId: Id<"users">) {
  const rows = await ctx.db
    .query("projects")
    .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(PROJECT_READ_LIMIT);
  return rows.filter((project) => project.archivedAt === undefined);
}

async function otherSummaries(
  ctx: QueryCtx,
  projects: Doc<"projects">[],
) {
  if (projects.length < 2) return [];
  const others = [];
  for (const project of projects) {
    const site = await ownedSiteSummary(ctx, project);
    others.push({
      projectId: project._id,
      title: project.title,
      ...(site?.hostname ? { hostname: site.hostname } : {}),
    });
  }
  return others;
}

async function sourceSlugFor(ctx: QueryCtx, project: Doc<"projects">) {
  if (!project.sourceIdeaId) return undefined;
  const idea = await ctx.db.get("ideas", project.sourceIdeaId);
  return idea?.slug;
}

/**
 * Last explicit keep is the most recently updated owned project, or the
 * projectId the Account switcher asked for. Viewing is not choosing.
 */
export const current = query({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  returns: currentReturnValidator,
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const projects = await ownedProjects(ctx, user._id);
    const others = await otherSummaries(ctx, projects);
    const selected = args.projectId
      ? await requireOwnedProject(ctx, args.projectId)
      : (projects[0] ?? null);

    if (selected === null) {
      const ranked = rankIdeas(await loadPublishedIdeas(ctx), "score").slice(
        0,
        COLD_CARD_LIMIT,
      );
      return {
        kind: "cold" as const,
        cards: ranked.map((idea) => ({
          slug: idea.slug,
          title: idea.title,
          description: idea.description,
          category: idea.category,
          buildTime: idea.buildTime,
        })),
        others,
      };
    }

    const [site, renderSpec, paid, slug] = await Promise.all([
      ownedSiteSummary(ctx, selected),
      latestRenderSpec(ctx, selected),
      projectPaid(ctx, user._id, selected._id),
      sourceSlugFor(ctx, selected),
    ]);

    if (site?.live && site.hostname) {
      return {
        kind: "dayn" as const,
        projectId: selected._id,
        title: selected.title,
        hostname: site.hostname,
        ...(slug ? { sourceSlug: slug } : {}),
        renderSpec,
        paid,
        others,
      };
    }

    return {
      kind: "day1" as const,
      projectId: selected._id,
      title: selected.title,
      ...(slug ? { sourceSlug: slug } : {}),
      renderSpec,
      publishable: site?.publishable ?? false,
      paid,
      others,
    };
  },
});

export const library = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: v.union(v.literal("score"), v.literal("newest")),
  },
  returns: v.object({
    cards: v.array(libraryCardValidator),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const ideas = await loadPublishedIdeas(ctx);
    const search = args.search?.trim().toLocaleLowerCase().slice(0, 80) ?? "";
    const filtered = ideas.filter((idea) => {
      if (args.category && idea.category !== args.category) return false;
      if (!search) return true;
      const haystack = `${idea.title} ${idea.description}`.toLocaleLowerCase();
      return haystack.includes(search);
    });
    const ranked = rankIdeas(filtered, args.sort);
    const cards = await Promise.all(
      ranked.map(async (idea) => {
        const project = await ownerProjectForIdea(ctx, user._id, idea._id);
        return {
          ideaId: idea._id,
          slug: idea.slug,
          title: idea.title,
          description: idea.description,
          category: idea.category,
          buildTime: idea.buildTime,
          building: project !== null,
          ...(project ? { projectId: project._id } : {}),
        };
      }),
    );
    return { cards };
  },
});
