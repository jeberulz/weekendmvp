import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { syncIdeaFacets } from "./ideaFacets";
import { excludeUnlistedIdeas, isEngineDraftSlug } from "./platform/catalogPolicy";
import schema from "./schema";
import { requireCurrentPlatformUser, requireCurrentPlatformUserForMutation } from "./platform/authz";

/*
 * Every public read below hides engine drafts (lib/engine-drafts.ts): rows
 * seeded while they were public stay stored, but no archive, hub, related
 * rail, sitemap or direct lookup returns them. See platform/catalogPolicy.ts.
 */

const ideaFields = schema.tables.ideas.validator.fields;

/** Full `ideas` document validator (table fields + system fields). */
const ideaDoc = v.object({
  ...ideaFields,
  _id: v.id("ideas"),
  _creationTime: v.number(),
});
const publicIdeaDoc = ideaDoc.omit("body").omit("provenance");
function publicIdea<T extends { body?: string; provenance?: unknown }>(idea: T): Omit<T, "body" | "provenance"> {
  const { body: _body, provenance: _provenance, ...preview } = idea;
  void _body;
  void _provenance;
  return preview;
}

function assertVerifiedMember(user: { email?: string; emailVerificationTime?: number }) {
  if (!user.email || !user.emailVerificationTime) {
    throw new ConvexError({ code: "UNAUTHENTICATED" });
  }
}

/** Fresh server-side probe before any page HTML is rendered. */
export const requireVerifiedMember = mutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    assertVerifiedMember(await requireCurrentPlatformUserForMutation(ctx));
    return null;
  },
});

/** Card fields consumed by the related-ideas rail. */
const relatedIdeaDoc = v.object({
  slug: v.string(),
  title: v.string(),
  category: v.string(),
});

const DEFAULT_RELATED_LIMIT = 3;
const MAX_RELATED_LIMIT = 12;

function relatedLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_RELATED_LIMIT;
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.min(Math.trunc(limit), MAX_RELATED_LIMIT));
}

function relatedIdeaCard(idea: {
  slug: string;
  title: string;
  category: string;
}) {
  return {
    slug: idea.slug,
    title: idea.title,
    category: idea.category,
  };
}

/**
 * Look up a single idea by slug. Returns null when not found, and for engine
 * drafts: their page answers 404, so no public lookup (curated hub rails,
 * `/build/{slug}`, member prompt bodies) may resolve one. Member work reads
 * its ideas by id, owner-scoped, and is unaffected.
 */
export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(publicIdeaDoc, v.null()),
  handler: async (ctx, { slug }) => {
    if (isEngineDraftSlug(slug)) return null;
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return !idea || idea.editorialVisibility === "removed" ? null : publicIdea(idea);
  },
});

/** Full body is available only to a current, verified platform session. */
export const bySlugForMember = query({
  args: { slug: v.string() },
  returns: v.union(ideaDoc, v.null()),
  handler: async (ctx, { slug }) => {
    assertVerifiedMember(await requireCurrentPlatformUser(ctx));
    if (isEngineDraftSlug(slug)) return null;
    const idea = await ctx.db.query("ideas").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    return !idea || idea.editorialVisibility === "removed" ? null : idea;
  },
});

/** Paginated archive listing, newest first by publishedAt. */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    page: v.array(publicIdeaDoc),
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
    const page = await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .filter(excludeUnlistedIdeas)
      .paginate({ numItems: limit ?? 20, cursor: cursor ?? null });
    return { ...page, page: page.page.map(publicIdea) };
  },
});

/** All ideas in a category, newest first. */
export const byCategory = query({
  args: { category: v.string() },
  returns: v.array(publicIdeaDoc),
  handler: async (ctx, { category }) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_category_publishedAt", (q) => q.eq("category", category))
      .order("desc")
      .filter(excludeUnlistedIdeas)
      .collect();
    return ideas.map(publicIdea);
  },
});

/** All ideas with a revenue goal, newest first. */
export const byRevenueGoal = query({
  args: { revenueGoal: v.string() },
  returns: v.array(publicIdeaDoc),
  handler: async (ctx, { revenueGoal }) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_revenueGoal_publishedAt", (q) =>
        q.eq("revenueGoal", revenueGoal),
      )
      .order("desc")
      .filter(excludeUnlistedIdeas)
      .collect();
    return ideas.map(publicIdea);
  },
});

/**
 * Hub grids show 30 cards. Callers may ask for a small buffer so
 * `onlyPublicIdeas` can replace a few filtered rows without a second round
 * trip. Never allow the old `limit: 1000` path: popular tools (e.g. cursor)
 * match nearly every idea, so an uncapped indexed read still scanned the
 * whole table and dominated DB I/O.
 */
const DEFAULT_FACET_LIMIT = 30;
const MAX_FACET_LIMIT = 48;

function facetCap(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_FACET_LIMIT;
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.min(Math.trunc(limit), MAX_FACET_LIMIT));
}

function isListedIdea(idea: Doc<"ideas">): boolean {
  return idea.editorialVisibility !== "removed" && !isEngineDraftSlug(idea.slug);
}

/**
 * Prefer index-backed facet rows. Until `ideaFacets:backfill` has written at
 * least one row (or when tests insert ideas without dual-write), fall back to
 * the legacy full-table scan so behaviour stays identical.
 */
async function facetsReady(
  ctx: QueryCtx,
  table: "idea_tools" | "idea_audiences",
): Promise<boolean> {
  const probe = await ctx.db.query(table).take(1);
  return probe.length > 0;
}

async function ideasFromToolLinks(
  ctx: QueryCtx,
  tool: string,
  limit: number,
): Promise<Doc<"ideas">[]> {
  const links = await ctx.db
    .query("idea_tools")
    .withIndex("by_tool_and_confidence", (q) => q.eq("tool", tool))
    .order("desc")
    .take(limit);
  const ideas: Doc<"ideas">[] = [];
  const seen = new Set<Id<"ideas">>();
  for (const link of links) {
    if (seen.has(link.ideaId)) continue;
    seen.add(link.ideaId);
    const idea = await ctx.db.get("ideas", link.ideaId);
    if (idea && isListedIdea(idea) && idea.tools.includes(tool)) {
      ideas.push(idea);
    }
  }
  return ideas;
}

async function ideasFromAudienceLinks(
  ctx: QueryCtx,
  audience: string,
  limit: number,
): Promise<Doc<"ideas">[]> {
  const links = await ctx.db
    .query("idea_audiences")
    .withIndex("by_audience_and_confidence", (q) => q.eq("audience", audience))
    .order("desc")
    .take(limit);
  const ideas: Doc<"ideas">[] = [];
  const seen = new Set<Id<"ideas">>();
  for (const link of links) {
    if (seen.has(link.ideaId)) continue;
    seen.add(link.ideaId);
    const idea = await ctx.db.get("ideas", link.ideaId);
    if (idea && isListedIdea(idea) && idea.audiences.includes(audience)) {
      ideas.push(idea);
    }
  }
  return ideas;
}

async function legacyByTool(
  ctx: QueryCtx,
  tool: string,
  limit: number,
): Promise<Doc<"ideas">[]> {
  const all = await ctx.db
    .query("ideas")
    .withIndex("by_publishedAt")
    .order("desc")
    .filter(excludeUnlistedIdeas)
    .collect();
  return all
    .filter((idea) => idea.tools.includes(tool))
    .sort(
      (a, b) =>
        (b.scores?.builder_confidence ?? -1) - (a.scores?.builder_confidence ?? -1),
    )
    .slice(0, limit);
}

async function legacyByAudience(
  ctx: QueryCtx,
  audience: string,
  limit: number,
): Promise<Doc<"ideas">[]> {
  const all = await ctx.db
    .query("ideas")
    .withIndex("by_publishedAt")
    .order("desc")
    .filter(excludeUnlistedIdeas)
    .collect();
  return all
    .filter((idea) => idea.audiences.includes(audience))
    .sort(
      (a, b) =>
        (b.scores?.builder_confidence ?? -1) - (a.scores?.builder_confidence ?? -1),
    )
    .slice(0, limit);
}

/**
 * Ideas buildable with a given tool, sorted by scores.builder_confidence
 * desc, capped at `limit` (default 30) — matches legacy sync-build-with.js.
 * Uses `idea_tools` when backfilled; otherwise the legacy full scan.
 */
export const byTool = query({
  args: { tool: v.string(), limit: v.optional(v.number()) },
  returns: v.array(publicIdeaDoc),
  handler: async (ctx, { tool, limit }) => {
    const cap = facetCap(limit);
    if (cap === 0) return [];
    const ideas = (await facetsReady(ctx, "idea_tools"))
      ? await ideasFromToolLinks(ctx, tool, cap)
      : await legacyByTool(ctx, tool, cap);
    return ideas.map(publicIdea);
  },
});

/**
 * Ideas targeting a given audience, sorted by scores.builder_confidence
 * desc, capped at `limit` (default 30). Uses `idea_audiences` when
 * backfilled; otherwise the legacy full scan.
 */
export const byAudience = query({
  args: { audience: v.string(), limit: v.optional(v.number()) },
  returns: v.array(publicIdeaDoc),
  handler: async (ctx, { audience, limit }) => {
    const cap = facetCap(limit);
    if (cap === 0) return [];
    const ideas = (await facetsReady(ctx, "idea_audiences"))
      ? await ideasFromAudienceLinks(ctx, audience, cap)
      : await legacyByAudience(ctx, audience, cap);
    return ideas.map(publicIdea);
  },
});

/** Most recently published idea — powers /ideas/today. */
export const latest = query({
  args: {},
  returns: v.union(publicIdeaDoc, v.null()),
  handler: async (ctx) => {
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .filter(excludeUnlistedIdeas)
      .first();
    return idea ? publicIdea(idea) : null;
  },
});

/**
 * Related ideas for an idea page: same category first (newest first), then
 * ideas sharing an audience (newest first), always excluding the idea
 * itself. Returns [] when the slug is unknown or an engine draft, and never
 * suggests a draft.
 */
export const relatedFor = query({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  returns: v.array(relatedIdeaDoc),
  handler: async (ctx, { slug, limit }) => {
    const max = relatedLimit(limit);
    if (max === 0) {
      return [];
    }

    if (isEngineDraftSlug(slug)) {
      return [];
    }
    const self = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!self || self.editorialVisibility === "removed") {
      return [];
    }

    // The rail prioritizes category matches, so fill it from the existing
    // category/publishedAt index. `max + 1` accounts for `self` appearing in
    // the range without turning this hot path into a full-table scan.
    const categoryCandidates = await ctx.db
      .query("ideas")
      .withIndex("by_category_publishedAt", (q) =>
        q.eq("category", self.category),
      )
      .order("desc")
      .filter(excludeUnlistedIdeas)
      .take(max + 1);
    const related = categoryCandidates
      .filter((idea) => idea.slug !== slug)
      .slice(0, max)
      .map(relatedIdeaCard);

    if (related.length === max) {
      return related;
    }

    // Array membership is not indexable in the current schema. Preserve the
    // legacy audience fallback exactly, but stop newest-first iteration as
    // soon as the remaining card slots are full. With current seeded data,
    // every category fills the public four-card rail above and this fallback
    // reads nothing.
    const selfAudiences = new Set(self.audiences);
    const newestIdeas = ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .filter(excludeUnlistedIdeas);
    for await (const idea of newestIdeas) {
      if (
        idea.slug === slug ||
        idea.category === self.category ||
        !idea.audiences.some((audience) => selfAudiences.has(audience))
      ) {
        continue;
      }
      related.push(relatedIdeaCard(idea));
      if (related.length === max) {
        break;
      }
    }
    return related;
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
      .filter(excludeUnlistedIdeas)
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
    const row = await ctx.db.get("ideas", id);
    if (row) await syncIdeaFacets(ctx, row);
    await ctx.scheduler.runAfter(0, internal.revalidate.run, {
      tags: [`idea:${args.slug}`, "ideas"],
    });
    return id;
  },
});
