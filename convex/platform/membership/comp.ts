import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { MEMBERSHIP_SCAN_CAP } from "./state";

/**
 * WP64-S2. Operator-only comp grants (frozen contract 2): Builder's Hub for
 * testers and support, with no payment. Internal, so only a deploy key can
 * run them. Never run against production without the owner's go-ahead:
 *
 *   npx convex run platform/membership/comp:grant '{"ownerId":"<users id>"}'
 *   npx convex run platform/membership/comp:revoke '{"ownerId":"<users id>"}'
 *
 * They touch comp grants only. Lifetime grants change through the S4
 * settlement (refund, dispute), never here.
 */

export const grant = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, args) => {
    const owner = await ctx.db.get("users", args.ownerId);
    if (owner === null) throw new ConvexError({ code: "OWNER_NOT_FOUND" });
    const grants = await ctx.db
      .query("plan_grants")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP);
    if (grants.some((existing) => existing.kind === "comp" && existing.revokedAt === undefined)) {
      return { created: false };
    }
    await ctx.db.insert("plan_grants", { kind: "comp", ownerId: args.ownerId, grantedAt: Date.now() });
    return { created: true };
  },
});

export const revoke = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.object({ revoked: v.number() }),
  handler: async (ctx, args) => {
    const grants = await ctx.db
      .query("plan_grants")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP);
    const now = Date.now();
    let revoked = 0;
    for (const existing of grants) {
      if (existing.kind !== "comp" || existing.revokedAt !== undefined) continue;
      await ctx.db.patch("plan_grants", existing._id, { revokedAt: now, revokeReason: "operator" });
      revoked += 1;
    }
    return { revoked };
  },
});
