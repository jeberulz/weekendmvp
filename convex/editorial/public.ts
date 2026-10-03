import { v } from "convex/values";

import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { metadataValidator } from "./validators";

/**
 * The only anonymous view of editorial content. A staged version is private
 * until the committed pointer and the editorial state agree on its release.
 * Legacy pages have no pointer and continue to use their checked-in MDX.
 */
const released = v.object({
  state: v.literal("released"),
  slug: v.string(),
  releaseId: v.string(),
  artifactHash: v.string(),
  title: v.string(),
  markdown: v.string(),
  metadata: metadataValidator,
  firstPublishedAt: v.union(v.string(), v.null()),
  updatedAt: v.string(),
});

const decision = v.union(
  v.object({ state: v.literal("legacy") }),
  v.object({ state: v.literal("removed") }),
  released,
);

type Selection =
  | { state: "legacy" | "removed" }
  | { state: "released"; pointer: Doc<"editorial_public_pointers">; version: Doc<"editorial_public_versions"> };

async function selectPublicVersion(ctx: QueryCtx, slug: string): Promise<Selection> {
  const pointer = await ctx.db.query("editorial_public_pointers")
    .withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
  if (!pointer) {
    // An imported idea already marked unpublished must not fall back to MDX
    // even if its pointer was not backfilled during cutover.
    const reservation = await ctx.db.query("editorial_slugs")
      .withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!reservation) return { state: "legacy" };
    const idea = await ctx.db.query("editorial_ideas")
      .withIndex("by_key", (q) => q.eq("key", reservation.ideaId)).unique();
    const liveRelease = idea?.publication.liveReleaseId
      ? await ctx.db.query("editorial_releases")
        .withIndex("by_key", (q) => q.eq("key", idea.publication.liveReleaseId!)).unique()
      : null;
    return idea?.publication.state === "live" && liveRelease?.operation === "legacy_baseline"
      ? { state: "legacy" }
      : { state: "removed" };
  }
  if (pointer.state === "removed" || !pointer.releaseId) return { state: "removed" };
  const releaseId = pointer.releaseId;
  const reservation = await ctx.db.query("editorial_slugs")
    .withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
  if (!reservation) return { state: "removed" };
  const idea = await ctx.db.query("editorial_ideas")
    .withIndex("by_key", (q) => q.eq("key", reservation.ideaId)).unique();
  if (!idea || idea.publication.state !== "live" ||
      idea.publication.liveReleaseId !== pointer.releaseId ||
      idea.generation !== pointer.generation) return { state: "removed" };
  const release = await ctx.db.query("editorial_releases")
    .withIndex("by_key", (q) => q.eq("key", releaseId)).unique();
  if (release?.state !== "succeeded" && release?.state !== "verifying_public") return { state: "removed" };
  const version = await ctx.db.query("editorial_public_versions")
    .withIndex("by_releaseId", (q) => q.eq("releaseId", releaseId)).unique();
  if (!version || version.ideaId !== idea.key || version.revisionId !== release.revisionId) {
    return { state: "removed" };
  }
  return { state: "released", pointer, version };
}

/** Small request-time gate for middleware; article text is never transferred. */
export const visibility = query({
  args: { slug: v.string() },
  returns: v.union(v.literal("legacy"), v.literal("removed"), v.literal("released")),
  handler: async (ctx, { slug }) => (await selectPublicVersion(ctx, slug)).state,
});

export const bySlug = query({
  args: { slug: v.string() },
  returns: decision,
  handler: async (ctx, { slug }) => {
    const selected = await selectPublicVersion(ctx, slug);
    if (selected.state !== "released") return { state: selected.state };
    const { pointer, version } = selected;
    return {
      state: "released" as const,
      slug,
      releaseId: version.releaseId,
      artifactHash: version.artifactHash,
      title: version.title,
      markdown: version.markdown,
      metadata: version.metadata,
      firstPublishedAt: pointer.firstPublishedAt,
      updatedAt: pointer.updatedAt,
    };
  },
});

const listingRow = v.object({
  slug: v.string(),
  state: v.union(v.literal("released"), v.literal("removed")),
  releaseId: v.union(v.string(), v.null()),
  updatedAt: v.string(),
  firstPublishedAt: v.union(v.string(), v.null()),
  title: v.union(v.string(), v.null()),
  metadata: v.union(metadataValidator, v.null()),
});

/** Bounded discovery overlay: only activated metadata, never candidate text. */
export const listing = query({
  args: {},
  returns: v.array(listingRow),
  handler: async (ctx) => {
    const pointers = await ctx.db.query("editorial_public_pointers").take(2501);
    if (pointers.length > 2500) throw new Error("Public editorial listing needs pagination.");
    return pointers.map((pointer) => ({
      slug: pointer.slug,
      state: pointer.state,
      releaseId: pointer.releaseId,
      updatedAt: pointer.updatedAt,
      firstPublishedAt: pointer.firstPublishedAt,
      title: pointer.title,
      metadata: pointer.metadata,
    }));
  },
});
