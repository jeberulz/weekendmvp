import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireSuperAdmin } from "../admin/superAdmin";

type OpsReadCtx = Pick<QueryCtx, "db">;

export type WorkspaceFeature =
  | "workspace"
  | "freeSignups"
  | "ai"
  | "studioVideo"
  | "publish"
  | "email"
  | "social"
  | "ads";

export type OpsSettings = Pick<
  Doc<"ops_settings">,
  "workspaceEnabled" | "cohortMode" | "freeSignupsOpen" |
  "globalDailyBudgetMicroUsd" | "killSwitches"
>;

export const DEFAULT_OPS_SETTINGS: OpsSettings = {
  workspaceEnabled: false,
  cohortMode: "allowlist",
  freeSignupsOpen: false,
  globalDailyBudgetMicroUsd: 0n,
  killSwitches: {
    ai: true,
    studioVideo: true,
    publish: true,
    email: true,
    social: true,
    ads: true,
  },
};

const killSwitchesValidator = v.object({
  ai: v.boolean(),
  studioVideo: v.boolean(),
  publish: v.boolean(),
  email: v.boolean(),
  social: v.boolean(),
  ads: v.boolean(),
});

const settingsValidator = v.object({
  workspaceEnabled: v.boolean(),
  cohortMode: v.union(v.literal("allowlist"), v.literal("open")),
  freeSignupsOpen: v.boolean(),
  globalDailyBudgetMicroUsd: v.int64(),
  killSwitches: killSwitchesValidator,
});

/** Missing settings are a full kill switch, never an implicit activation. */
export async function getOpsSettings(ctx: OpsReadCtx): Promise<OpsSettings> {
  const row = await ctx.db.query("ops_settings")
    .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
    .unique();
  if (row === null) return DEFAULT_OPS_SETTINGS;
  return {
    workspaceEnabled: row.workspaceEnabled,
    cohortMode: row.cohortMode,
    freeSignupsOpen: row.freeSignupsOpen,
    globalDailyBudgetMicroUsd: row.globalDailyBudgetMicroUsd,
    killSwitches: row.killSwitches,
  };
}

export async function assertFeatureEnabled(
  ctx: OpsReadCtx,
  feature: WorkspaceFeature,
): Promise<OpsSettings> {
  const settings = await getOpsSettings(ctx);
  const enabled = settings.workspaceEnabled && (
    feature === "workspace" ||
    (feature === "freeSignups"
      ? settings.freeSignupsOpen
      : !settings.killSwitches[feature] &&
        (feature !== "ai" || settings.globalDailyBudgetMicroUsd > 0n))
  );
  if (!enabled) {
    const code = feature === "ai" ? "AI_DISABLED" : "WORKSPACE_DISABLED";
    throw new ConvexError({ code });
  }
  return settings;
}

/** Use only after the caller has authenticated or supplied a trusted internal owner ID. */
export async function assertWorkspaceCohort(
  ctx: OpsReadCtx,
  ownerId: Id<"users">,
): Promise<void> {
  const settings = await assertFeatureEnabled(ctx, "workspace");
  if (settings.cohortMode === "open") return;
  const allowed = await ctx.db.query("workspace_cohort")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
  if (allowed === null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
}

/** The admin control plane is owner-approved to work while workspaceEnabled is off. */
export const readForAdmin = query({
  args: {},
  returns: settingsValidator,
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await getOpsSettings(ctx);
  },
});

const killSwitchPatchValidator = v.object({
  ai: v.optional(v.boolean()),
  studioVideo: v.optional(v.boolean()),
  publish: v.optional(v.boolean()),
  email: v.optional(v.boolean()),
  social: v.optional(v.boolean()),
  ads: v.optional(v.boolean()),
});

async function auditOpsChange(
  ctx: MutationCtx,
  adminId: Id<"users">,
  action: string,
  subjectType: string,
  subjectId: string,
  metadata: string,
  now: number,
): Promise<void> {
  await ctx.db.insert("audit_events", {
    ownerId: adminId,
    actorType: "user",
    actorUserId: adminId,
    action,
    subjectType,
    subjectId,
    metadata,
    createdAt: now,
  });
}

/** Only a bound super admin may turn runtime features on or off. */
export const updateForAdmin = mutation({
  args: {
    workspaceEnabled: v.optional(v.boolean()),
    cohortMode: v.optional(v.union(v.literal("allowlist"), v.literal("open"))),
    freeSignupsOpen: v.optional(v.boolean()),
    globalDailyBudgetMicroUsd: v.optional(v.int64()),
    killSwitches: v.optional(killSwitchPatchValidator),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    if (args.globalDailyBudgetMicroUsd !== undefined && args.globalDailyBudgetMicroUsd < 0n) {
      throw new ConvexError({ code: "INVALID_BUDGET" });
    }
    const row = await ctx.db.query("ops_settings")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
      .unique();
    const current = row ?? DEFAULT_OPS_SETTINGS;
    const switches = args.killSwitches;
    const next: OpsSettings = {
      workspaceEnabled: args.workspaceEnabled ?? current.workspaceEnabled,
      cohortMode: args.cohortMode ?? current.cohortMode,
      freeSignupsOpen: args.freeSignupsOpen ?? current.freeSignupsOpen,
      globalDailyBudgetMicroUsd: args.globalDailyBudgetMicroUsd ?? current.globalDailyBudgetMicroUsd,
      killSwitches: {
        ai: switches?.ai ?? current.killSwitches.ai,
        studioVideo: switches?.studioVideo ?? current.killSwitches.studioVideo,
        publish: switches?.publish ?? current.killSwitches.publish,
        email: switches?.email ?? current.killSwitches.email,
        social: switches?.social ?? current.killSwitches.social,
        ads: switches?.ads ?? current.killSwitches.ads,
      },
    };
    let rowId: Id<"ops_settings">;
    if (row === null) {
      rowId = await ctx.db.insert("ops_settings", { ...next, ownerId: admin.user._id, singletonKey: "workspace", updatedAt: now });
    } else {
      rowId = row._id;
      await ctx.db.patch("ops_settings", rowId, { ...next, updatedAt: now });
    }
    await auditOpsChange(ctx, admin.user._id, "ops.settings.changed", "ops_settings", rowId, JSON.stringify({
      workspaceEnabled: next.workspaceEnabled,
      cohortMode: next.cohortMode,
      freeSignupsOpen: next.freeSignupsOpen,
      globalDailyBudgetMicroUsd: next.globalDailyBudgetMicroUsd.toString(),
      killSwitches: next.killSwitches,
    }), now);
    return next;
  },
});

/** The allowlist can be changed while the workspace is off. */
export const setCohortMember = mutation({
  args: { ownerId: v.id("users"), allowed: v.boolean() },
  returns: v.object({ allowed: v.boolean(), changed: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    const target = await ctx.db.get("users", args.ownerId);
    if (target === null || target.isAnonymous === true) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    const existing = await ctx.db.query("workspace_cohort")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (args.allowed === (existing !== null)) return { allowed: args.allowed, changed: false };
    if (args.allowed) {
      await ctx.db.insert("workspace_cohort", { ownerId: args.ownerId, addedBy: admin.user._id, addedAt: now });
    } else if (existing !== null) {
      await ctx.db.delete("workspace_cohort", existing._id);
    }
    await auditOpsChange(ctx, admin.user._id, args.allowed ? "ops.cohort.added" : "ops.cohort.removed", "workspace_cohort", args.ownerId, JSON.stringify({ allowed: args.allowed }), now);
    return { allowed: args.allowed, changed: true };
  },
});
