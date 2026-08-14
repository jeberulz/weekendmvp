import {
  getAuthSessionId,
  getAuthUserId,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";

const currentUserValidator = v.object({
  id: v.id("users"),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
});

/**
 * Narrow WP21 authorization probe. Later platform functions can reuse the
 * same server-derived identity contract without accepting a caller user ID.
 */
export const requireCurrent = query({
  args: {},
  returns: currentUserValidator,
  handler: async (ctx) => {
    const [userId, sessionId] = await Promise.all([
      getAuthUserId(ctx),
      getAuthSessionId(ctx),
    ]);
    if (userId === null || sessionId === null) {
      throw new ConvexError({ code: "UNAUTHENTICATED" });
    }

    const [user, session] = await Promise.all([
      ctx.db.get("users", userId),
      ctx.db.get("authSessions", sessionId),
    ]);
    if (
      user === null ||
      user.isAnonymous === true ||
      session === null ||
      session.userId !== userId
    ) {
      throw new ConvexError({ code: "UNAUTHENTICATED" });
    }

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});
