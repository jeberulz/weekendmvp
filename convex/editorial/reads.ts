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
export const session = query({
  args: at,
  handler: async (ctx, args) => {
    const nowMs = requestTime(args.nowMs);
    const current = await editorialSession(ctx);
    if (!current.account || !current.principal || current.principal.capability !== "editorial_admin") {
      return { signedIn: current.account !== null, editor: null };
    }
    // Accounts are never linked across providers, so there is one sign-in method.
    const userId = current.account.user._id;
    const providerAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .first();
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
