import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";

const issueFields = schema.tables.newsletter_issues.validator.fields;

/** Full `newsletter_issues` document validator (table + system fields). */
const issueDoc = v.object({
  ...issueFields,
  _id: v.id("newsletter_issues"),
  _creationTime: v.number(),
});

/** Look up a single newsletter issue by slug. Returns null when not found. */
export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(issueDoc, v.null()),
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("newsletter_issues")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

/** All newsletter issues, newest first by publishedAt (optionally capped). */
export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(issueDoc),
  handler: async (ctx, { limit }) => {
    const q = ctx.db
      .query("newsletter_issues")
      .withIndex("by_publishedAt")
      .order("desc");
    return limit !== undefined ? await q.take(limit) : await q.collect();
  },
});

/** Minimal projection for sitemap.xml generation. */
export const allForSitemap = query({
  args: {},
  returns: v.array(v.object({ slug: v.string(), publishedAt: v.number() })),
  handler: async (ctx) => {
    const all = await ctx.db
      .query("newsletter_issues")
      .withIndex("by_publishedAt")
      .order("desc")
      .collect();
    return all.map(({ slug, publishedAt }) => ({ slug, publishedAt }));
  },
});

/**
 * Insert-or-patch a newsletter issue by slug (seed pipeline + /newsletter
 * publishing flow). Schedules a Next.js cache revalidation for
 * `newsletter:<slug>` + `newsletter`.
 */
export const upsertBySlug = internalMutation({
  args: issueFields,
  returns: v.id("newsletter_issues"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newsletter_issues")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    let id;
    if (existing) {
      await ctx.db.patch(existing._id, args);
      id = existing._id;
    } else {
      id = await ctx.db.insert("newsletter_issues", args);
    }
    await ctx.scheduler.runAfter(0, internal.revalidate.run, {
      tags: [`newsletter:${args.slug}`, "newsletter"],
    });
    return id;
  },
});
