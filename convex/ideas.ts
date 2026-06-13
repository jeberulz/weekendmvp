import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";

const ideaFields = schema.tables.ideas.validator.fields;

/** Full `ideas` document validator (table fields + system fields). */
const ideaDoc = v.object({
  ...ideaFields,
  _id: v.id("ideas"),
  _creationTime: v.number(),
});

/** Look up a single idea by slug. Returns null when not found. */
export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(ideaDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** Paginated archive listing, newest first by publishedAt. */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    page: v.array(ideaDoc),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, { limit, cursor }) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .paginate({ numItems: limit ?? 20, cursor: cursor ?? null });
  },
});

/** All ideas in a category, newest first. */
export const byCategory = query({
  args: { category: v.string() },
  returns: v.array(ideaDoc),
  handler: async (ctx, { category }) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_category_publishedAt", (q) => q.eq("category", category))
      .order("desc")
      .collect();
  },
});

/** All ideas with a revenue goal, newest first. */
export const byRevenueGoal = query({
  args: { revenueGoal: v.string() },
  returns: v.array(ideaDoc),
  handler: async (ctx, { revenueGoal }) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_revenueGoal_publishedAt", (q) =>
        q.eq("revenueGoal", revenueGoal),
      )
      .order("desc")
      .collect();
  },
});

/**
 * Ideas buildable with a given tool, sorted by scores.builder_confidence
 * desc, capped at `limit` (default 30) — matches legacy sync-build-with.js.
 * `tools` is an array field, so we scan (≤1k rows) and filter in JS.
 */
export const byTool = query({
  args: { tool: v.string(), limit: v.optional(v.number()) },
  returns: v.array(ideaDoc),
  handler: async (ctx, { tool, limit }) => {
    const all = await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .collect();
    return all
      .filter((idea) => idea.tools.includes(tool))
      .sort(
        (a, b) =>
          (b.scores?.builder_confidence ?? -1) -
          (a.scores?.builder_confidence ?? -1),
      )
      .slice(0, limit ?? 30);
  },
});

/**
 * Ideas targeting a given audience, sorted by scores.builder_confidence
 * desc, capped at `limit` (default 30). Array-field filter — same approach
 * as byTool.
 */
export const byAudience = query({
  args: { audience: v.string(), limit: v.optional(v.number()) },
  returns: v.array(ideaDoc),
  handler: async (ctx, { audience, limit }) => {
    const all = await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .collect();
    return all
      .filter((idea) => idea.audiences.includes(audience))
      .sort(
        (a, b) =>
          (b.scores?.builder_confidence ?? -1) -
          (a.scores?.builder_confidence ?? -1),
      )
      .slice(0, limit ?? 30);
  },
});

/** Most recently published idea — powers /ideas/today. */
export const latest = query({
  args: {},
  returns: v.union(ideaDoc, v.null()),
  handler: async (ctx) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .first();
  },
});

/**
 * Related ideas for an idea page: same category first (newest first), then
 * ideas sharing an audience (newest first), always excluding the idea
 * itself. Returns [] when the slug is unknown.
 */
export const relatedFor = query({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  returns: v.array(ideaDoc),
  handler: async (ctx, { slug, limit }) => {
    const max = limit ?? 3;
    const self = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!self) {
      return [];
    }
    const all = await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .collect();
    const others = all.filter((idea) => idea.slug !== slug);
    const sameCategory = others.filter(
      (idea) => idea.category === self.category,
    );
    const sameAudience = others.filter(
      (idea) =>
        idea.category !== self.category &&
        idea.audiences.some((a) => self.audiences.includes(a)),
    );
    return [...sameCategory, ...sameAudience].slice(0, max);
  },
});

/** Minimal projection for sitemap.xml generation. */
export const allForSitemap = query({
  args: {},
  returns: v.array(v.object({ slug: v.string(), publishedAt: v.number() })),
  handler: async (ctx) => {
    const all = await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .collect();
    return all.map(({ slug, publishedAt }) => ({ slug, publishedAt }));
  },
});

/**
 * Insert-or-patch an idea by slug. Used by the seed pipeline (U9) and the
 * future editor. Internal: content writes must come through admin/seed
 * tooling, never from the public client.
 *
 * Schedules a Next.js cache revalidation for `idea:<slug>` + `ideas`.
 */
export const upsertBySlug = internalMutation({
  args: ideaFields,
  returns: v.id("ideas"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    let id;
    if (existing) {
      await ctx.db.patch(existing._id, args);
      id = existing._id;
    } else {
      id = await ctx.db.insert("ideas", args);
    }
    await ctx.scheduler.runAfter(0, internal.revalidate.run, {
      tags: [`idea:${args.slug}`, "ideas"],
    });
    return id;
  },
});
