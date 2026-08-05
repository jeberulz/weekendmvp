import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "./authz";
import {
  intentFlagValidator,
  projectSourceValidator,
  projectStatusValidator,
} from "./validators";

const dashboardProjectValidator = v.object({
  id: v.id("projects"),
  title: v.string(),
  source: projectSourceValidator,
  status: projectStatusValidator,
  updatedAt: v.number(),
});

const dashboardIntentValidator = v.object({
  ideaId: v.id("ideas"),
  slug: v.string(),
  title: v.string(),
  category: v.string(),
  saved: v.boolean(),
  interested: v.boolean(),
  updatedAt: v.number(),
});

const DASHBOARD_PROJECT_READ_LIMIT = 12;
const DASHBOARD_PROJECT_RESULT_LIMIT = 6;
const DASHBOARD_INTENT_READ_LIMIT = 16;
const DASHBOARD_INTENT_RESULT_LIMIT = 6;

const exploreViewValidator = v.union(
  v.literal("all"),
  v.literal("for_you"),
  v.literal("saved"),
  v.literal("interested"),
  v.literal("building"),
);

const exploreSortValidator = v.union(
  v.literal("recommended"),
  v.literal("newest"),
  v.literal("score"),
);

const exploreCardValidator = v.object({
  ideaId: v.id("ideas"),
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  category: v.string(),
  buildTime: v.string(),
  revenueGoal: v.string(),
  publishedAt: v.number(),
  score: v.union(v.number(), v.null()),
  saved: v.boolean(),
  interested: v.boolean(),
  building: v.boolean(),
});

type ExploreCard = {
  ideaId: Id<"ideas">;
  slug: string;
  title: string;
  description: string;
  category: string;
  buildTime: string;
  revenueGoal: string;
  publishedAt: number;
  score: number | null;
  saved: boolean;
  interested: boolean;
  building: boolean;
};

type ExploreSort = "recommended" | "newest" | "score";

const AFFINITY_INTENT_LIMIT = 48;
const MAX_AFFINITY_BOOST = 0.5;

function canonicalScore(idea: Doc<"ideas">): number | null {
  if (idea.scores === undefined) return null;
  const values = [
    idea.scores.opportunity,
    idea.scores.pain,
    idea.scores.timing,
    idea.scores.builder_confidence,
  ];
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function ownerIntent(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  ideaId: Id<"ideas">,
) {
  return await ctx.db
    .query("idea_intents")
    .withIndex("by_ownerId_and_ideaId", (q) =>
      q.eq("ownerId", ownerId).eq("ideaId", ideaId),
    )
    .unique();
}

async function ownerIsBuilding(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  ideaId: Id<"ideas">,
) {
  const activeProject = await ctx.db
    .query("projects")
    .withIndex("by_ownerId_and_sourceIdeaId_and_archivedAt", (q) =>
      q
        .eq("ownerId", ownerId)
        .eq("sourceIdeaId", ideaId)
        .eq("archivedAt", undefined),
    )
    .first();
  return activeProject !== null;
}

async function toExploreCard(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  idea: Doc<"ideas">,
  knownIntent?: Doc<"idea_intents"> | null,
  buildingOverride?: boolean,
): Promise<ExploreCard> {
  const [intent, building] = await Promise.all([
    knownIntent === undefined ? ownerIntent(ctx, ownerId, idea._id) : knownIntent,
    buildingOverride === undefined
      ? ownerIsBuilding(ctx, ownerId, idea._id)
      : buildingOverride,
  ]);
  const score = canonicalScore(idea);
  return {
    ideaId: idea._id,
    slug: idea.slug,
    title: idea.title,
    description: idea.description,
    category: idea.category,
    buildTime: idea.buildTime,
    revenueGoal: idea.revenueGoal,
    publishedAt: idea.publishedAt,
    score: score === null ? null : Math.round(score * 10) / 10,
    saved: intent?.saved ?? false,
    interested: intent?.interested ?? false,
    building,
  };
}

async function categoryAffinity(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<Map<string, number>> {
  const intents = await ctx.db
    .query("idea_intents")
    .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(AFFINITY_INTENT_LIMIT);
  const categories = await Promise.all(
    intents
      .filter((intent) => intent.saved || intent.interested)
      .map(async (intent) => {
        const idea = await ctx.db.get("ideas", intent.ideaId);
        if (idea === null) return null;
        return {
          category: idea.category,
          weight: Number(intent.saved) + Number(intent.interested),
        };
      }),
  );
  const affinity = new Map<string, number>();
  for (const item of categories) {
    if (item === null) continue;
    affinity.set(item.category, (affinity.get(item.category) ?? 0) + item.weight);
  }
  return affinity;
}

function stableExploreSort(
  cards: ExploreCard[],
  sort: ExploreSort,
  affinity: Map<string, number>,
) {
  const recommendationScore = (card: ExploreCard) => {
    const base = card.score ?? 0;
    const boost = Math.min(
      (affinity.get(card.category) ?? 0) * 0.1,
      MAX_AFFINITY_BOOST,
    );
    return base + boost;
  };

  return cards.sort((a, b) => {
    const primary =
      sort === "newest"
        ? b.publishedAt - a.publishedAt
        : sort === "score"
          ? (b.score ?? 0) - (a.score ?? 0)
          : recommendationScore(b) - recommendationScore(a);
    if (primary !== 0) return primary;
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
    return a.slug.localeCompare(b.slug);
  });
}

function filterExplorePage(
  cards: ExploreCard[],
  search: string | undefined,
  category: string | undefined,
) {
  const normalizedSearch = search?.trim().toLocaleLowerCase().slice(0, 80) ?? "";
  return cards.filter((card) => {
    if (category && card.category !== category) return false;
    if (!normalizedSearch) return true;
    const haystack = [card.title, card.description, card.category]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

async function finishExplorePage(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  cards: ExploreCard[],
  args: { search?: string; category?: string; sort: ExploreSort },
) {
  const affinity =
    args.sort === "recommended"
      ? await categoryAffinity(ctx, ownerId)
      : new Map<string, number>();
  return stableExploreSort(
    filterExplorePage(cards, args.search, args.category),
    args.sort,
    affinity,
  );
}

/**
 * Bounded owner-only state for the dashboard home. Missing account/project
 * data stays null/empty so the UI never invents activity or balances.
 */
export const dashboardSummary = query({
  args: {},
  returns: v.object({
    userName: v.union(v.string(), v.null()),
    projects: v.array(dashboardProjectValidator),
    recentIntents: v.array(dashboardIntentValidator),
    creditBalance: v.union(v.int64(), v.null()),
  }),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);

    const projectRows = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(DASHBOARD_PROJECT_READ_LIMIT);
    const projects = projectRows
      .filter((project) => project.archivedAt === undefined)
      .slice(0, DASHBOARD_PROJECT_RESULT_LIMIT)
      .map((project) => ({
        id: project._id,
        title: project.title,
        source: project.source,
        status: project.status,
        updatedAt: project.updatedAt,
      }));

    const intentRows = await ctx.db
      .query("idea_intents")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(DASHBOARD_INTENT_READ_LIMIT);
    const recentIntents = (
      await Promise.all(
        intentRows
          .filter((intent) => intent.saved || intent.interested)
          .map(async (intent) => {
            const idea = await ctx.db.get("ideas", intent.ideaId);
            if (idea === null) return null;
            return {
              ideaId: idea._id,
              slug: idea.slug,
              title: idea.title,
              category: idea.category,
              saved: intent.saved,
              interested: intent.interested,
              updatedAt: intent.updatedAt,
            };
          }),
      )
    )
      .filter((intent) => intent !== null)
      .slice(0, DASHBOARD_INTENT_RESULT_LIMIT);

    const creditAccount = await ctx.db
      .query("credit_accounts")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .unique();

    return {
      userName: user.displayName ?? user.name ?? null,
      projects,
      recentIntents,
      creditBalance: creditAccount?.balance ?? null,
    };
  },
});

/**
 * Owner-aware discovery over canonical idea rows. Every view starts from an
 * existing index and paginates before any per-page search/filter/ranking.
 */
export const explore = query({
  args: {
    paginationOpts: paginationOptsValidator,
    view: exploreViewValidator,
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: exploreSortValidator,
  },
  returns: paginationResultValidator(exploreCardValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);

    if (args.view === "saved" || args.view === "interested") {
      const source =
        args.view === "saved"
          ? ctx.db
              .query("idea_intents")
              .withIndex("by_ownerId_and_saved_and_updatedAt", (q) =>
                q.eq("ownerId", user._id).eq("saved", true),
              )
          : ctx.db
              .query("idea_intents")
              .withIndex("by_ownerId_and_interested_and_updatedAt", (q) =>
                q.eq("ownerId", user._id).eq("interested", true),
              );
      const result = await source.order("desc").paginate(args.paginationOpts);
      const cards = (
        await Promise.all(
          result.page.map(async (intent) => {
            const idea = await ctx.db.get("ideas", intent.ideaId);
            return idea === null
              ? null
              : await toExploreCard(ctx, user._id, idea, intent);
          }),
        )
      ).filter((card) => card !== null);
      return {
        ...result,
        page: await finishExplorePage(ctx, user._id, cards, args),
      };
    }

    if (args.view === "building") {
      // Traverse canonical ideas, then derive owner project state. This avoids
      // duplicate cards when one idea has multiple project revisions.
      const source = args.category
        ? ctx.db
            .query("ideas")
            .withIndex("by_category_publishedAt", (q) =>
              q.eq("category", args.category!),
            )
        : ctx.db.query("ideas").withIndex("by_publishedAt");
      const result = await source.order("desc").paginate(args.paginationOpts);
      const cards = (
        await Promise.all(
          result.page.map(async (idea) => {
            const card = await toExploreCard(ctx, user._id, idea);
            return card.building ? card : null;
          }),
        )
      ).filter((card) => card !== null);
      return {
        ...result,
        page: await finishExplorePage(ctx, user._id, cards, args),
      };
    }

    const source = args.category
      ? ctx.db
          .query("ideas")
          .withIndex("by_category_publishedAt", (q) =>
            q.eq("category", args.category!),
          )
      : ctx.db.query("ideas").withIndex("by_publishedAt");
    const result = await source.order("desc").paginate(args.paginationOpts);
    const cards = await Promise.all(
      result.page.map((idea) => toExploreCard(ctx, user._id, idea)),
    );
    return {
      ...result,
      page: await finishExplorePage(ctx, user._id, cards, args),
    };
  },
});

/**
 * Server-confirmed, owner-scoped intent update. Saved and Interested remain
 * independent fields; Building is deliberately absent because it is derived
 * only from the owner's active projects.
 */
export const setIntent = mutation({
  args: {
    ideaId: v.id("ideas"),
    flag: intentFlagValidator,
    value: v.boolean(),
  },
  returns: v.object({
    ideaId: v.id("ideas"),
    saved: v.boolean(),
    interested: v.boolean(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ctx.db.get("ideas", args.ideaId);
    if (idea === null) {
      throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    }
    const existing = await ctx.db
      .query("idea_intents")
      .withIndex("by_ownerId_and_ideaId", (q) =>
        q.eq("ownerId", user._id).eq("ideaId", idea._id),
      )
      .unique();
    const updatedAt = Date.now();
    const next = {
      saved: args.flag === "saved" ? args.value : (existing?.saved ?? false),
      interested:
        args.flag === "interested"
          ? args.value
          : (existing?.interested ?? false),
    };

    if (existing === null) {
      await ctx.db.insert("idea_intents", {
        ownerId: user._id,
        ideaId: idea._id,
        ...next,
        updatedAt,
      });
    } else {
      await ctx.db.patch("idea_intents", existing._id, {
        ...next,
        updatedAt,
      });
    }

    return { ideaId: idea._id, ...next, updatedAt };
  },
});
