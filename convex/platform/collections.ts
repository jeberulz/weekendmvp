import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "./authz";
import { requireFeature } from "./entitlements";
import { COLLECTION_ITEMS_MAX, COLLECTION_NAME_MAX, COLLECTIONS_MAX } from "./hubLimits";
import { ideaCardValidator, savedAmong, toIdeaCard } from "./ideaCards";
import { notesFor } from "./notes";
import { activePlansOf } from "./weekendPlans";

/**
 * WP44-S11 collections (Builder's Hub, PRD 6.3 Saved). Owner-scoped: identity
 * comes from the session, and a missing collection reads the same as someone
 * else's. Creating, renaming and adding ideas need the `collections`
 * entitlement. Reading, removing ideas and deleting stay open, so a member
 * who leaves Builder's Hub keeps access to what they made.
 */

export { COLLECTION_ITEMS_MAX, COLLECTION_NAME_MAX, COLLECTIONS_MAX } from "./hubLimits";

const collectionSummaryValidator = v.object({
  collectionId: v.id("collections"),
  name: v.string(),
  count: v.number(),
});

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name === "" || name.length > COLLECTION_NAME_MAX) throw new ConvexError({ code: "INVALID_NAME" });
  return name;
}

async function ownedCollection(ctx: QueryCtx, ownerId: Id<"users">, rawId: string) {
  const collectionId = ctx.db.normalizeId("collections", rawId);
  const collection = collectionId ? await ctx.db.get("collections", collectionId) : null;
  if (collection === null || collection.ownerId !== ownerId) {
    throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
  }
  return collection;
}

async function ideaBySlug(ctx: QueryCtx, slug: string) {
  const idea = await ctx.db
    .query("ideas")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (idea === null) throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
  return idea;
}

async function itemFor(ctx: QueryCtx, collectionId: Id<"collections">, ideaId: Id<"ideas">) {
  return await ctx.db
    .query("collection_items")
    .withIndex("by_collectionId_and_ideaId", (q) => q.eq("collectionId", collectionId).eq("ideaId", ideaId))
    .unique();
}

function summary(collection: Doc<"collections">) {
  return { collectionId: collection._id, name: collection.name, count: collection.itemCount };
}

/** The member's collections, most recently changed first. */
export const list = query({
  args: {},
  returns: v.array(collectionSummaryValidator),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const rows = await ctx.db
      .query("collections")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(COLLECTIONS_MAX);
    return rows.map(summary);
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.object({ collectionId: v.id("collections") }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    await requireFeature(ctx, user._id, "collections");
    const name = cleanName(args.name);
    const existing = await ctx.db
      .query("collections")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", user._id))
      .take(COLLECTIONS_MAX);
    if (existing.length >= COLLECTIONS_MAX) throw new ConvexError({ code: "COLLECTION_LIMIT" });
    const collectionId = await ctx.db.insert("collections", {
      ownerId: user._id,
      name,
      itemCount: 0,
      updatedAt: Date.now(),
    });
    return { collectionId };
  },
});

export const rename = mutation({
  args: { collectionId: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    await requireFeature(ctx, user._id, "collections");
    const collection = await ownedCollection(ctx, user._id, args.collectionId);
    await ctx.db.patch("collections", collection._id, { name: cleanName(args.name), updatedAt: Date.now() });
    return null;
  },
});

/** Deleting is always allowed: it is the member's own data. */
export const remove = mutation({
  args: { collectionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const collection = await ownedCollection(ctx, user._id, args.collectionId);
    // Bounded: adding stops at COLLECTION_ITEMS_MAX.
    const items = await ctx.db
      .query("collection_items")
      .withIndex("by_collectionId_and_addedAt", (q) => q.eq("collectionId", collection._id))
      .take(COLLECTION_ITEMS_MAX);
    for (const item of items) await ctx.db.delete("collection_items", item._id);
    await ctx.db.delete("collections", collection._id);
    return null;
  },
});

export const addIdea = mutation({
  args: { collectionId: v.string(), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    await requireFeature(ctx, user._id, "collections");
    const collection = await ownedCollection(ctx, user._id, args.collectionId);
    const idea = await ideaBySlug(ctx, args.slug);
    if (await itemFor(ctx, collection._id, idea._id)) return null;
    if (collection.itemCount >= COLLECTION_ITEMS_MAX) throw new ConvexError({ code: "COLLECTION_FULL" });
    const now = Date.now();
    await ctx.db.insert("collection_items", {
      ownerId: user._id,
      collectionId: collection._id,
      ideaId: idea._id,
      addedAt: now,
    });
    await ctx.db.patch("collections", collection._id, { itemCount: collection.itemCount + 1, updatedAt: now });
    return null;
  },
});

/** Taking an idea out is always allowed, like deleting. */
export const removeIdea = mutation({
  args: { collectionId: v.string(), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const collection = await ownedCollection(ctx, user._id, args.collectionId);
    const idea = await ideaBySlug(ctx, args.slug);
    const item = await itemFor(ctx, collection._id, idea._id);
    if (item === null) return null;
    await ctx.db.delete("collection_items", item._id);
    await ctx.db.patch("collections", collection._id, {
      itemCount: Math.max(collection.itemCount - 1, 0),
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Which of the member's collections hold this idea. For the per-idea menu. */
export const forIdea = query({
  args: { slug: v.string() },
  returns: v.array(v.id("collections")),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (idea === null) return [];
    const items = await ctx.db
      .query("collection_items")
      .withIndex("by_ownerId_and_ideaId", (q) => q.eq("ownerId", user._id).eq("ideaId", idea._id))
      .take(COLLECTIONS_MAX);
    return items.map((item) => item.collectionId);
  },
});

/** One collection and its ideas, newest first, as Saved rows. */
export const items = query({
  args: { collectionId: v.string() },
  returns: v.object({
    collection: collectionSummaryValidator,
    items: v.array(
      v.object({ card: ideaCardValidator, addedAt: v.number(), note: v.union(v.string(), v.null()) }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const collection = await ownedCollection(ctx, user._id, args.collectionId);
    const [rows, active] = await Promise.all([
      ctx.db
        .query("collection_items")
        .withIndex("by_collectionId_and_addedAt", (q) => q.eq("collectionId", collection._id))
        .order("desc")
        .take(COLLECTION_ITEMS_MAX),
      activePlansOf(ctx, user._id),
    ]);
    const ideaIds = rows.map((row) => row.ideaId);
    const [savedIds, notes] = await Promise.all([
      savedAmong(ctx, user._id, ideaIds),
      notesFor(ctx, user._id, ideaIds),
    ]);
    const building = new Set(active.map((plan) => plan.ideaId));
    const items = (
      await Promise.all(
        rows.map(async (row) => {
          const idea = await ctx.db.get("ideas", row.ideaId);
          if (idea === null) return null;
          return {
            card: toIdeaCard(idea, savedIds.has(idea._id), null, building.has(idea._id)),
            addedAt: row.addedAt,
            note: notes.get(idea._id) ?? null,
          };
        }),
      )
    ).filter((item) => item !== null);
    return { collection: summary(collection), items };
  },
});
