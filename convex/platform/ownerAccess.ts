import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { hasActiveSuperAdminBinding } from "../admin/superAdmin";

type ReadCtx = Pick<QueryCtx, "db">;

/** A stored grant and active admin binding are both required. */
export async function ownerAccess(ctx: ReadCtx, ownerId: Id<"users">) {
  const user = await ctx.db.get("users", ownerId);
  if (user?.platformOwnerAccess?.enabled !== true || user.isAnonymous === true ||
      user.emailVerificationTime === undefined || user.accountClosureRequestedAt !== undefined) {
    return { unlimited: false, bypassAiBudget: false };
  }
  const bound = await hasActiveSuperAdminBinding(ctx, ownerId);
  return {
    unlimited: bound,
    bypassAiBudget: bound && user.platformOwnerAccess.bypassAiBudget,
  };
}

/** Deployment-operator control. Resolves one verified admin account, then binds by user ID. */
export const set = internalMutation({
  args: { email: v.string(), enabled: v.boolean(), bypassAiBudget: v.boolean() },
  returns: v.object({ changed: v.boolean(), enabled: v.boolean() }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db.query("users").withIndex("email", q => q.eq("email", email)).unique();
    if (user === null || user.isAnonymous === true || user.emailVerificationTime === undefined) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    const bound = await hasActiveSuperAdminBinding(ctx, user._id);
    if (args.enabled && (!bound || user.accountClosureRequestedAt !== undefined)) {
      throw new ConvexError({ code: "FORBIDDEN" });
    }
    const bypassAiBudget = args.enabled && args.bypassAiBudget;
    const current = user.platformOwnerAccess;
    if ((current?.enabled ?? false) === args.enabled && (current?.bypassAiBudget ?? false) === bypassAiBudget) {
      return { changed: false, enabled: args.enabled };
    }
    const now = Date.now();
    await ctx.db.patch("users", user._id, {
      platformOwnerAccess: { enabled: args.enabled, bypassAiBudget, updatedAt: now },
    });
    await ctx.db.insert("audit_events", {
      ownerId: user._id, actorType: "system",
      action: args.enabled ? "owner_access.granted" : "owner_access.revoked",
      subjectType: "user", subjectId: user._id,
      metadata: JSON.stringify({ bypassAiBudget }), createdAt: now,
    });
    return { changed: true, enabled: args.enabled };
  },
});
