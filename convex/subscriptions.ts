import { v } from "convex/values";
import { normalizeEmail } from "./authEmail";
import { internalMutation, mutation } from "./_generated/server";

/**
 * Record a subscription event. This is an append-only event log (not a user
 * identity table) — called from the Next.js subscribe API routes after the
 * Beehiiv call.
 */
export const record = mutation({
  args: {
    email: v.string(),
    source: v.string(),
    automationIds: v.array(v.string()),
    utm: v.optional(
      v.object({
        campaign: v.optional(v.string()),
        source: v.optional(v.string()),
        medium: v.optional(v.string()),
      }),
    ),
    beehiivStatus: v.optional(v.string()),
  },
  returns: v.id("subscriptions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("subscriptions", {
      ...args,
      email: normalizeEmail(args.email),
      normalizedEmail: normalizeEmail(args.email),
      createdAt: Date.now(),
    });
  },
});

/**
 * Operator-run, resumable backfill. Preserve original event emails; only the
 * derived lookup key changes. Default to dry-run; each call scans at most 100
 * rows and returns the next cursor. Never schedules itself or runs on deploy.
 */
export const backfillNormalizedEmail = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), dryRun: v.optional(v.boolean()) },
  returns: v.object({
    scanned: v.number(),
    needsUpdate: v.number(),
    updated: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("subscriptions").paginate({
      cursor: args.cursor,
      numItems: 100,
      maximumRowsRead: 100,
    });
    let needsUpdate = 0;
    let updated = 0;
    for (const row of result.page) {
      const normalizedEmail = normalizeEmail(row.email);
      if (row.normalizedEmail === normalizedEmail) continue;
      needsUpdate += 1;
      if (args.dryRun === false) {
        await ctx.db.patch("subscriptions", row._id, { normalizedEmail });
        updated += 1;
      }
    }
    return {
      scanned: result.page.length,
      needsUpdate,
      updated,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
