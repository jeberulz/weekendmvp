import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireCurrentPlatformUser } from "./authz";
import { rankForYou } from "./forYou";
import { hoursOf, ideaCardValidator, meanScore, readSavedIntents, toIdeaCard } from "./ideaCards";
import { readPreferences } from "./preferences";
import { activePlanOf } from "./weekendPlans";
import { SETUP_TOOLS, type PickReason } from "./setupOptions";
import {
  HOURS_BUCKETS,
  MAX_LIBRARY_LIMIT,
  MAX_SEARCH_LENGTH,
  MAX_TOOL_FILTERS,
  effectiveSort,
  hoursBucket,
  type LibrarySort,
} from "./libraryFilters";

/**
 * The idea library is a bounded catalog (226 ideas in September 2026). One
 * read of the newest LIBRARY_READ_LIMIT rows covers all of it, so search,
 * every filter, facet counts and sorting run over the whole library instead
 * of one page at a time (PRD finding A7). `truncated` says when the cap bites.
 */
export const LIBRARY_READ_LIMIT = 1000;
/** Per search index. Convex caps one search at 1024 results. */
const SEARCH_READ_LIMIT = 256;
const AFFINITY_SAVED_LIMIT = 48;

// Spelled out so the generated API types stay exact. The tests check they
// match the shared lists in libraryFilters.ts.
export const libraryViewValidator = v.union(
  v.literal("all"),
  v.literal("for_you"),
  v.literal("new"),
);
export const librarySortValidator = v.union(
  v.literal("relevance"),
  v.literal("newest"),
  v.literal("score"),
);
export const hoursBucketValidator = v.union(
  v.literal("8"),
  v.literal("12"),
  v.literal("16"),
  v.literal("more"),
);

const facetValidator = v.array(v.object({ value: v.string(), count: v.number() }));

type Dimension = "category" | "tools" | "hours" | "goal";
const DIMENSIONS: Dimension[] = ["category", "tools", "hours", "goal"];

function countBy(ideas: Doc<"ideas">[], keysOf: (idea: Doc<"ideas">) => string[]) {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    for (const key of keysOf(idea)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function byNewest(a: Doc<"ideas">, b: Doc<"ideas">) {
  return b.publishedAt - a.publishedAt || a.slug.localeCompare(b.slug);
}

/**
 * Owner-aware Ideas library (WP44-S5). Search uses the title and description
 * search indexes. Filters combine: category, any of the picked tools, a build
 * time bucket and a revenue goal. Facet counts for each filter ignore that
 * filter's own choice, so every option shows what picking it would give.
 */
export const library = query({
  args: {
    view: libraryViewValidator,
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    tools: v.optional(v.array(v.string())),
    hours: v.optional(hoursBucketValidator),
    goal: v.optional(v.string()),
    sort: v.optional(librarySortValidator),
    /** The New tab's lower bound. The client passes it: queries never read the clock. */
    publishedAfter: v.optional(v.number()),
    /** Home's picks leave out what the member already saved. */
    unsavedOnly: v.optional(v.boolean()),
    limit: v.number(),
  },
  returns: v.object({
    items: v.array(ideaCardValidator),
    total: v.number(),
    truncated: v.boolean(),
    facets: v.object({
      category: facetValidator,
      tools: facetValidator,
      hours: facetValidator,
      goal: facetValidator,
    }),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const search = (args.search ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
    const tools = (args.tools ?? []).slice(0, MAX_TOOL_FILTERS);
    const limit = Math.max(1, Math.min(Math.floor(args.limit) || 1, MAX_LIBRARY_LIMIT));

    let candidates: Doc<"ideas">[];
    let truncated = false;
    if (search) {
      // Title matches rank first, then description-only matches.
      const [byTitle, byDescription] = await Promise.all([
        ctx.db
          .query("ideas")
          .withSearchIndex("search_title", (q) => q.search("title", search))
          .take(SEARCH_READ_LIMIT),
        ctx.db
          .query("ideas")
          .withSearchIndex("search_description", (q) => q.search("description", search))
          .take(SEARCH_READ_LIMIT),
      ]);
      const seen = new Set<Id<"ideas">>();
      candidates = [];
      for (const idea of [...byTitle, ...byDescription]) {
        if (seen.has(idea._id)) continue;
        seen.add(idea._id);
        candidates.push(idea);
      }
    } else {
      const rows = await ctx.db
        .query("ideas")
        .withIndex("by_publishedAt")
        .order("desc")
        .take(LIBRARY_READ_LIMIT + 1);
      truncated = rows.length > LIBRARY_READ_LIMIT;
      candidates = rows.slice(0, LIBRARY_READ_LIMIT);
    }

    const [saved, active] = await Promise.all([
      readSavedIntents(ctx, user._id, LIBRARY_READ_LIMIT),
      activePlanOf(ctx, user._id),
    ]);
    const savedIds = new Set(saved.rows.map((row) => row.ideaId));

    const base = candidates.filter(
      (idea) =>
        (args.view !== "new" ||
          args.publishedAfter === undefined ||
          idea.publishedAt >= args.publishedAfter) &&
        (!args.unsavedOnly || !savedIds.has(idea._id)),
    );

    const matches: Record<Dimension, (idea: Doc<"ideas">) => boolean> = {
      category: (idea) => !args.category || idea.category === args.category,
      tools: (idea) => tools.length === 0 || tools.some((tool) => idea.tools.includes(tool)),
      hours: (idea) => !args.hours || hoursBucket(hoursOf(idea)) === args.hours,
      goal: (idea) => !args.goal || idea.revenueGoal === args.goal,
    };
    const passes = (idea: Doc<"ideas">, except?: Dimension) =>
      DIMENSIONS.every((dimension) => dimension === except || matches[dimension](idea));

    const filtered = base.filter((idea) => passes(idea));
    const without = (dimension: Dimension) => base.filter((idea) => passes(idea, dimension));
    const hoursCounts = countBy(without("hours"), (idea) => [hoursBucket(hoursOf(idea))]);
    const facets = {
      category: countBy(without("category"), (idea) => [idea.category]),
      tools: countBy(without("tools"), (idea) => idea.tools),
      hours: HOURS_BUCKETS.map((value) => ({
        value,
        count: hoursCounts.find((facet) => facet.value === value)?.count ?? 0,
      })),
      goal: countBy(without("goal"), (idea) => [idea.revenueGoal]),
    };

    const sort: LibrarySort = effectiveSort(args.view, args.sort, search !== "");
    let ordered = filtered;
    let reasons: Map<Id<"ideas">, PickReason | null> | null = null;
    if (sort === "newest") {
      ordered = [...filtered].sort(byNewest);
    } else if (sort === "score") {
      ordered = [...filtered].sort(
        (a, b) => (meanScore(b) ?? 0) - (meanScore(a) ?? 0) || byNewest(a, b),
      );
    } else if (sort === "recommended") {
      // Research score plus bounded nudges from the member's setup answers
      // and saves (WP44-S8). Reasons ride along for the For you view.
      const inMemory = new Map(candidates.map((idea) => [idea._id, idea]));
      const [prefs, recentSaved] = await Promise.all([
        readPreferences(ctx, user._id),
        Promise.all(
          saved.rows
            .slice(0, AFFINITY_SAVED_LIMIT)
            .map(async (row) => inMemory.get(row.ideaId) ?? (await ctx.db.get("ideas", row.ideaId))),
        ),
      ]);
      const ranked = rankForYou(filtered, {
        tools: SETUP_TOOLS.filter((tool) => prefs?.tools.includes(tool)),
        weeklyHours: prefs?.weeklyHours,
        goal: prefs?.goal,
        savedNewestFirst: recentSaved.filter((idea) => idea !== null),
      });
      ordered = ranked.ordered;
      reasons = ranked.reasons;
    }
    // "relevance" keeps the search order.

    return {
      items: ordered
        .slice(0, limit)
        .map((idea) =>
          toIdeaCard(idea, savedIds.has(idea._id), reasons?.get(idea._id), active?.ideaId === idea._id),
        ),
      total: filtered.length,
      truncated,
      facets,
    };
  },
});
