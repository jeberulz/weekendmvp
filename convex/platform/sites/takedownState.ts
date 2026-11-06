import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { requireSuperAdmin } from "../../admin/superAdmin";

const input = {
  siteConfigId: v.id("site_configs"),
  reason: v.string(),
};

function validReason(reason: string): boolean {
  return reason.trim() === reason && reason.length >= 10 && reason.length <= 500;
}

/** Super-admin control plane; owner-approved to work while the workspace is off. */
export const prepare = internalMutation({
  args: input,
  returns: v.object({ hostname: v.string() }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, Date.now());
    if (!validReason(args.reason)) throw new ConvexError({ code: "INVALID_TAKEDOWN_REASON" });
    const site = await ctx.db.get(args.siteConfigId);
    if (site === null || !site.hostname || site.archivedAt !== undefined) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    return { hostname: site.hostname };
  },
});

/** The action calls this only after the Global Config deny entry is verified. */
export const commit = internalMutation({
  args: { ...input, expectedHostname: v.string() },
  returns: v.object({ changed: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx, Date.now());
    if (!validReason(args.reason)) throw new ConvexError({ code: "INVALID_TAKEDOWN_REASON" });
    const site = await ctx.db.get(args.siteConfigId);
    if (site === null || site.hostname !== args.expectedHostname || site.archivedAt !== undefined) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    if (site.takedownAt !== undefined) return { changed: false };

    const now = Date.now();
    if (site.currentVersionId !== undefined) {
      const version = await ctx.db.get(site.currentVersionId);
      if (version !== null && version.siteConfigId === site._id && version.status === "published") {
        await ctx.db.patch(version._id, { status: "retired", retiredAt: now });
      }
    }
    await ctx.db.patch(site._id, {
      currentVersionId: undefined,
      takedownAt: now,
      takedownReason: args.reason,
      updatedAt: now,
    });
    await ctx.db.insert("audit_events", {
      ownerId: site.ownerId,
      projectId: site.projectId,
      actorType: "user",
      actorUserId: admin.user._id,
      action: "site.taken_down",
      subjectType: "site_config",
      subjectId: site._id,
      metadata: JSON.stringify({ hostname: site.hostname, reason: args.reason }),
      createdAt: now,
    });
    return { changed: true };
  },
});
