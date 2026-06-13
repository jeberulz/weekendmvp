import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";

const articleFields = schema.tables.articles.validator.fields;

/** Full `articles` document validator (table fields + system fields). */
const articleDoc = v.object({
  ...articleFields,
  _id: v.id("articles"),
  _creationTime: v.number(),
});

/** Look up a single article by slug. Returns null when not found. */
export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(articleDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("articles")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** All articles, newest first by publishedAt (optionally capped). */
export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(articleDoc),
  handler: async (ctx, { limit }) => {
    const q = ctx.db.query("articles").withIndex("by_publishedAt").order("desc");
    return limit !== undefined ? await q.take(limit) : await q.collect();
  },
});

/** Minimal projection for sitemap.xml generation. */
export const allForSitemap = query({
  args: {},
  returns: v.array(
    v.object({ slug: v.string(), publishedAt: v.optional(v.number()) }),
  ),
  handler: async (ctx) => {
    const all = await ctx.db
      .query("articles")
      .withIndex("by_publishedAt")
      .order("desc")
      .collect();
    return all.map(({ slug, publishedAt }) => ({ slug, publishedAt }));
  },
});

/**
 * Insert-or-patch an article by slug (seed pipeline + future editor).
 * Schedules a Next.js cache revalidation for `article:<slug>` + `articles`.
 */
export const upsertBySlug = internalMutation({
  args: articleFields,
  returns: v.id("articles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    let id;
    if (existing) {
      await ctx.db.patch(existing._id, args);
      id = existing._id;
    } else {
      id = await ctx.db.insert("articles", args);
    }
    await ctx.scheduler.runAfter(0, internal.revalidate.run, {
      tags: [`article:${args.slug}`, "articles"],
    });
    return id;
  },
});
