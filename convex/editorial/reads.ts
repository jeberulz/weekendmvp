import { v } from "convex/values";

import { hasFreshStrongAuth } from "../../lib/editorial/contracts/principal";
import { query } from "../_generated/server";
import { activityFilterArgs, ideaFilterArgs, releaseFilterArgs } from "./args";
import { editorialSession, readRepository, requestTime } from "./session";
import { nullableString } from "./validators";

/**
 * Public editorial reads (WP46-E4c). Each one resolves the caller from the
 * verified session and returns the repository's `CommandResult`: anyone
 * without the super-admin capability gets the same denial and no data.
 * Queries never write, so a denied read is not recorded.
 *
 * `nowMs` is the request time from the caller. Queries may not read the
 * clock; it only affects displayed evidence freshness and whether a recent
 * sign-in is shown as fresh. Commands re-check freshness with the server's
 * clock.
 */

const at = { nowMs: v.number() };
const page = { cursor: nullableString, pageSize: v.number() };

/**
 * Whether this account may use the workspace, and how it can confirm its
 * identity again. Returns no editorial data, and nothing about the workspace
 * to anyone else.
 */
const sessionEditor = v.object({
  displayName: v.string(),
  strongAuthAt: v.union(v.string(), v.null()),
  strongAuthFresh: v.boolean(),
  signInMethod: v.union(v.literal("google"), v.literal("email"), v.null()),
  email: v.union(v.string(), v.null()),
});

export const session = query({
  args: at,
  // Callers grant access only on this exact shape (middleware and the workspace gate).
  returns: v.object({ signedIn: v.boolean(), editor: v.union(sessionEditor, v.null()) }),
  handler: async (ctx, args) => {
    const nowMs = requestTime(args.nowMs);
    const current = await editorialSession(ctx);
    if (!current.account || !current.principal || current.principal.capability !== "editorial_admin") {
      return { signedIn: current.account !== null, editor: null };
    }
    // An email link may sign in to a Google account (ruling 2026-10-06), so an
    // account can hold both methods. Google stays the confirmation method then.
    const userId = current.account.user._id;
    const googleAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "google"))
      .first();
    const providerAccount =
      googleAccount ??
      (await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .first());
    const provider = providerAccount?.provider;
    return {
      signedIn: true,
      editor: {
        displayName: current.principal.displayName,
        strongAuthAt: current.principal.strongAuthAt,
        strongAuthFresh: hasFreshStrongAuth(current.principal, nowMs),
        signInMethod: provider === "google" ? ("google" as const) : provider === "email" ? ("email" as const) : null,
        /** The account's own address, for its own email confirmation link. */
        email: current.account.user.email ?? null,
      },
    };
  },
});

export const queueSummary = query({
  args: at,
  handler: async (ctx, args) => (await readRepository(ctx, args.nowMs)).getQueueSummary(),
});

export const listIdeas = query({
  args: { filter: ideaFilterArgs, ...page, ...at },
  handler: async (ctx, args) => (await readRepository(ctx, args.nowMs)).listIdeas(args.filter, args.cursor, args.pageSize),
});

export const getIdea = query({
  args: { ideaId: v.string(), ...at },
  handler: async (ctx, args) => (await readRepository(ctx, args.nowMs)).getIdea(args.ideaId),
});

export const getRevision = query({
  args: { ideaId: v.string(), revisionId: v.string(), ...at },
  handler: async (ctx, args) => (await readRepository(ctx, args.nowMs)).getRevision(args.ideaId, args.revisionId),
});

/** Exact staged bytes for the protected release preview; never an anonymous API. */
export const stagedPreview = query({
  args: { releaseId: v.string() },
  returns: v.union(v.null(), v.object({
    title: v.string(),
    markdown: v.string(),
    description: v.string(),
    slug: v.string(),
    revisionNumber: v.number(),
    artifactHash: v.string(),
  })),
  handler: async (ctx, { releaseId }) => {
    const current = await editorialSession(ctx);
    if (current.principal?.capability !== "editorial_admin") return null;
    const release = await ctx.db.query("editorial_releases")
      .withIndex("by_key", (q) => q.eq("key", releaseId)).unique();
    if (!release || !release.revisionId || release.revisionNumber === null) return null;
    const [idea, version] = await Promise.all([
      ctx.db.query("editorial_ideas").withIndex("by_key", (q) => q.eq("key", release.ideaId)).unique(),
      ctx.db.query("editorial_public_versions").withIndex("by_releaseId", (q) => q.eq("releaseId", releaseId)).unique(),
    ]);
    if (!idea || !version || version.ideaId !== idea.key || version.revisionId !== release.revisionId) return null;
    return {
      title: version.title,
      markdown: version.markdown,
      description: version.metadata.description,
      slug: idea.slug,
      revisionNumber: release.revisionNumber,
      artifactHash: version.artifactHash,
    };
  },
});

export const listReleases = query({
  args: { filter: releaseFilterArgs, ...page, ...at },
  handler: async (ctx, args) =>
    (await readRepository(ctx, args.nowMs)).listReleases(args.filter, args.cursor, args.pageSize),
});

export const listTrash = query({
  args: { ...page, ...at },
  handler: async (ctx, args) => (await readRepository(ctx, args.nowMs)).listTrash(args.cursor, args.pageSize),
});

export const listActivity = query({
  args: { filter: activityFilterArgs, ...page, ...at },
  handler: async (ctx, args) =>
    (await readRepository(ctx, args.nowMs)).listActivity(args.filter, args.cursor, args.pageSize),
});

export const settings = query({
  args: at,
  handler: async (ctx, args) => (await readRepository(ctx, args.nowMs)).getSettings(),
});
