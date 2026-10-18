import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireCurrentPlatformUserForMutation } from "../platform/authz";

const ALLOWED = new Set(["live-buildalong"]);

/**
 * Record signup attribution once (e.g. src=live-buildalong from Build-Along gate).
 * Does not overwrite an existing value. Minimal optional field on users.
 */
export const record = mutation({
  args: { src: v.string() },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args) => {
    if (!ALLOWED.has(args.src)) return { recorded: false };
    const member = await requireCurrentPlatformUserForMutation(ctx);
    if (member.signupSrc) return { recorded: false };
    await ctx.db.patch(member._id, { signupSrc: args.src });
    return { recorded: true };
  },
});
