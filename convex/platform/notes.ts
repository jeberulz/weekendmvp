import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "./authz";
import { requireFeature } from "./entitlements";
import { NOTE_MAX } from "./hubLimits";

/**
 * WP44-S11 private notes, one per idea per member (Builder's Hub, part of
 * the `collections` feature). Only the owner ever reads a note. Writing
 * needs the entitlement; clearing a note is always allowed.
 */

export { NOTE_MAX } from "./hubLimits";

async function noteOf(ctx: QueryCtx, ownerId: Id<"users">, ideaId: Id<"ideas">) {
  return await ctx.db
    .query("idea_notes")
    .withIndex("by_ownerId_and_ideaId", (q) => q.eq("ownerId", ownerId).eq("ideaId", ideaId))
    .unique();
}

/** Notes for a bounded list of ideas, keyed by idea id. */
export async function notesFor(ctx: QueryCtx, ownerId: Id<"users">, ideaIds: readonly Id<"ideas">[]) {
  const notes = await Promise.all(ideaIds.map((ideaId) => noteOf(ctx, ownerId, ideaId)));
  const byIdea = new Map<Id<"ideas">, string>();
  for (const note of notes) if (note) byIdea.set(note.ideaId, note.body);
  return byIdea;
}

export const get = query({
  args: { slug: v.string() },
  returns: v.union(v.object({ body: v.string(), updatedAt: v.number() }), v.null()),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (idea === null) return null;
    const note = await noteOf(ctx, user._id, idea._id);
    return note ? { body: note.body, updatedAt: note.updatedAt } : null;
  },
});

export const save = mutation({
  args: { slug: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (idea === null) throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    const body = args.body.trim();
    const existing = await noteOf(ctx, user._id, idea._id);
    if (body === "") {
      if (existing) await ctx.db.delete("idea_notes", existing._id);
      return null;
    }
    await requireFeature(ctx, user._id, "collections");
    if (body.length > NOTE_MAX) throw new ConvexError({ code: "NOTE_TOO_LONG" });
    const now = Date.now();
    if (existing) await ctx.db.patch("idea_notes", existing._id, { body, updatedAt: now });
    else await ctx.db.insert("idea_notes", { ownerId: user._id, ideaId: idea._id, body, updatedAt: now });
    return null;
  },
});
