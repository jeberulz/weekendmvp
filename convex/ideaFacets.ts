/**
 * Indexable tool/audience membership for public hub queries.
 *
 * `ideas.tools` / `ideas.audiences` are arrays, so Convex cannot index
 * membership. These join tables dual-write on every ideas mutation so
 * `ideas.byTool` / `ideas.byAudience` read only matching idea docs.
 *
 * Deploy: push schema, dual-write is live, then run
 * `npx convex run ideaFacets:backfill '{"dryRun":false}'` (batched) once
 * against the target deployment. Queries fall back to the legacy full
 * scan until at least one facet row exists.
 */
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const BACKFILL_BATCH = 50;

export function builderConfidenceOf(idea: Pick<Doc<"ideas">, "scores">): number {
  return idea.scores?.builder_confidence ?? -1;
}

async function clearTableForIdea(
  ctx: MutationCtx,
  table: "idea_tools" | "idea_audiences",
  ideaId: Id<"ideas">,
) {
  const existing = await ctx.db
    .query(table)
    .withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))
    .take(64);
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
}

/** Replace tool + audience join rows for one idea. Call after every ideas write. */
export async function syncIdeaFacets(
  ctx: MutationCtx,
  idea: Pick<Doc<"ideas">, "_id" | "tools" | "audiences" | "scores">,
): Promise<void> {
  const confidence = builderConfidenceOf(idea);
  await clearTableForIdea(ctx, "idea_tools", idea._id);
  await clearTableForIdea(ctx, "idea_audiences", idea._id);
  for (const tool of new Set(idea.tools.filter((value) => value.length > 0))) {
    await ctx.db.insert("idea_tools", {
      tool,
      ideaId: idea._id,
      builderConfidence: confidence,
    });
  }
  for (const audience of new Set(idea.audiences.filter((value) => value.length > 0))) {
    await ctx.db.insert("idea_audiences", {
      audience,
      ideaId: idea._id,
      builderConfidence: confidence,
    });
  }
}

/** Drop join rows when an idea is removed from the public catalogue. */
export async function clearIdeaFacets(ctx: MutationCtx, ideaId: Id<"ideas">): Promise<void> {
  await clearTableForIdea(ctx, "idea_tools", ideaId);
  await clearTableForIdea(ctx, "idea_audiences", ideaId);
}

/**
 * Bounded backfill. Default dry-run. Pass `cursor` from the previous
 * `continueCursor` until `isDone`. Safe to re-run: each idea replaces its
 * own join rows.
 */
export const backfill = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    scanned: v.number(),
    written: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;
    const limit = Math.max(1, Math.min(args.limit ?? BACKFILL_BATCH, BACKFILL_BATCH));
    const page = await ctx.db
      .query("ideas")
      .withIndex("by_publishedAt")
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    let written = 0;
    if (!dryRun) {
      for (const idea of page.page) {
        await syncIdeaFacets(ctx, idea);
        written += 1;
      }
    }
    return {
      dryRun,
      scanned: page.page.length,
      written,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
