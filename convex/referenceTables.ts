import { v } from "convex/values";
import { query } from "./_generated/server";
import schema from "./schema";

const docOf = <T extends keyof typeof schema.tables>(table: T) =>
  v.object({
    ...schema.tables[table].validator.fields,
    _id: v.id(table as string),
    _creationTime: v.number(),
  });

const categoryDoc = docOf("categories");
const revenueGoalDoc = docOf("revenue_goals");
const audienceDoc = docOf("audiences");
const buildTimeDoc = docOf("build_times");
const toolDoc = docOf("tools");
const problemDoc = docOf("problems");

/**
 * All reference tables in one round trip. These tables are tiny (≤ a few
 * dozen rows each), so full scans are fine. Source of truth for the
 * programmatic SEO landing pages.
 */
export const all = query({
  args: {},
  returns: v.object({
    categories: v.array(categoryDoc),
    revenueGoals: v.array(revenueGoalDoc),
    audiences: v.array(audienceDoc),
    buildTimes: v.array(buildTimeDoc),
    tools: v.array(toolDoc),
    problems: v.array(problemDoc),
  }),
  handler: async (ctx) => {
    const [categories, revenueGoals, audiences, buildTimes, tools, problems] =
      await Promise.all([
        ctx.db.query("categories").collect(),
        ctx.db.query("revenue_goals").collect(),
        ctx.db.query("audiences").collect(),
        ctx.db.query("build_times").collect(),
        ctx.db.query("tools").collect(),
        ctx.db.query("problems").collect(),
      ]);
    return { categories, revenueGoals, audiences, buildTimes, tools, problems };
  },
});

/** Single category by slug, or null. */
export const categoryBySlug = query({
  args: { slug: v.string() },
  returns: v.union(categoryDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** Single revenue goal by slug, or null. */
export const revenueGoalBySlug = query({
  args: { slug: v.string() },
  returns: v.union(revenueGoalDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("revenue_goals")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** Single audience by slug, or null. */
export const audienceBySlug = query({
  args: { slug: v.string() },
  returns: v.union(audienceDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("audiences")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** Single build time by slug, or null. */
export const buildTimeBySlug = query({
  args: { slug: v.string() },
  returns: v.union(buildTimeDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("build_times")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** Single tool by slug, or null. */
export const toolBySlug = query({
  args: { slug: v.string() },
  returns: v.union(toolDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("tools")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** Single problem by slug, or null. */
export const problemBySlug = query({
  args: { slug: v.string() },
  returns: v.union(problemDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("problems")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});
