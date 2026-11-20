import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireSuperAdmin } from "../admin/superAdmin";
import { requireCurrentPlatformUser, requireCurrentPlatformUserForMutation } from "../platform/authz";
import { ownerAccess } from "../platform/ownerAccess";

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
  "globalDailyBudgetMicroUsd" | "paidGlobalDailyBudgetMicroUsd" | "killSwitches"
>;

export const DEFAULT_OPS_SETTINGS: OpsSettings = Object.freeze({
  workspaceEnabled: false,
  cohortMode: "allowlist",
  freeSignupsOpen: false,
  globalDailyBudgetMicroUsd: 0n,
  paidGlobalDailyBudgetMicroUsd: 0n,
  killSwitches: Object.freeze({
    ai: true,
    studioVideo: true,
    publish: true,
    email: true,
    social: true,
    ads: true,
  }),
});

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
  paidGlobalDailyBudgetMicroUsd: v.int64(),
  killSwitches: killSwitchesValidator,
});

/** Missing settings are a full kill switch, never an implicit activation. */
export async function getOpsSettings(ctx: OpsReadCtx): Promise<OpsSettings> {
  const row = await ctx.db.query("ops_settings")
    .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
    .unique();
  if (row === null) return {
    ...DEFAULT_OPS_SETTINGS,
    killSwitches: { ...DEFAULT_OPS_SETTINGS.killSwitches },
  };
  return {
    workspaceEnabled: row.workspaceEnabled,
    cohortMode: row.cohortMode,
    freeSignupsOpen: row.freeSignupsOpen,
    globalDailyBudgetMicroUsd: row.globalDailyBudgetMicroUsd,
    paidGlobalDailyBudgetMicroUsd: row.paidGlobalDailyBudgetMicroUsd,
    killSwitches: row.killSwitches,
  };
}

function assertSwitchOpen(settings: OpsSettings, feature: WorkspaceFeature, bypassAiBudget = false): void {
  const aiAvailable = !settings.killSwitches.ai &&
    (bypassAiBudget || settings.globalDailyBudgetMicroUsd > 0n || settings.paidGlobalDailyBudgetMicroUsd > 0n);
  const enabled = settings.workspaceEnabled && (
    feature === "workspace" ||
    (feature === "freeSignups"
      ? settings.freeSignupsOpen
      : feature === "ai"
        ? aiAvailable
        : feature === "studioVideo"
          ? aiAvailable && !settings.killSwitches.studioVideo
          : !settings.killSwitches[feature])
  );
  if (!enabled) {
    const code = feature === "ai" || feature === "studioVideo" ? "AI_DISABLED" : "WORKSPACE_DISABLED";
    throw new ConvexError({ code });
  }
}

/** The kill switch behind the action an approval card of this kind would allow. Review and spend cards have none. */
const APPROVAL_KIND_SWITCH: Readonly<Record<string, "publish" | "email" | "social" | "ads">> = Object.freeze({
  publish: "publish",
  send: "email",
  post: "social",
  ad_launch: "ads",
});

/**
 * Whether a card of this approval kind may be raised now (L1 F1). A card for a
 * switched-off action would ask the founder to approve something that cannot
 * happen, so Wren is not offered one and cannot raise one. Kinds with no
 * switch (reviews, spend) are always allowed here; other gates still apply.
 */
export function approvalKindSwitchedOn(settings: OpsSettings, kind: string): boolean {
  const feature = APPROVAL_KIND_SWITCH[kind];
  if (feature === undefined) return true;
  return settings.workspaceEnabled && !settings.killSwitches[feature];
}

async function assertOwnerInCohort(
  ctx: OpsReadCtx,
  settings: OpsSettings,
  ownerId: Id<"users">,
): Promise<void> {
  if (settings.cohortMode === "open") return;
  const allowed = await ctx.db.query("workspace_cohort")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
  if (allowed === null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
}

/** Public Convex functions use this two-argument guard. It enforces both the
 * runtime switch and the signed-in owner's cohort in one call. */
export async function assertFeatureEnabled(
  ctx: Pick<QueryCtx, "auth" | "db"> | MutationCtx,
  feature: WorkspaceFeature,
): Promise<OpsSettings> {
  const settings = await getOpsSettings(ctx);
  // Resolve identity before a zero-budget check only when an owner exemption
  // can affect it. All kill switches still fail in their original order.
  const budgetOnly = settings.workspaceEnabled && !settings.killSwitches.ai &&
    (feature === "ai" || feature === "studioVideo") &&
    settings.globalDailyBudgetMicroUsd <= 0n && settings.paidGlobalDailyBudgetMicroUsd <= 0n;
  if (!budgetOnly) assertSwitchOpen(settings, feature);
  const user = "scheduler" in ctx
    ? await requireCurrentPlatformUserForMutation(ctx)
    : await requireCurrentPlatformUser(ctx);
  if (budgetOnly) assertSwitchOpen(settings, feature, (await ownerAccess(ctx, user._id)).bypassAiBudget);
  await assertOwnerInCohort(ctx, settings, user._id);
  return settings;
}

/** Internal jobs use this only with an owner ID from an already-authorized
 * project or trusted system work. It enforces the same switch and cohort. */
export async function assertFeatureEnabledForOwner(
  ctx: OpsReadCtx,
  feature: WorkspaceFeature,
  ownerId: Id<"users">,
): Promise<OpsSettings> {
  const settings = await getOpsSettings(ctx);
  assertSwitchOpen(settings, feature, (await ownerAccess(ctx, ownerId)).bypassAiBudget);
  await assertOwnerInCohort(ctx, settings, ownerId);
  return settings;
}

/** Compatibility helper for callers that only need workspace cohort access. */
export async function assertWorkspaceCohort(
  ctx: OpsReadCtx,
  ownerId: Id<"users">,
): Promise<void> {
  await assertFeatureEnabledForOwner(ctx, "workspace", ownerId);
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

export type OpsSettingsPatch = {
  workspaceEnabled?: boolean;
  cohortMode?: "allowlist" | "open";
  freeSignupsOpen?: boolean;
  globalDailyBudgetMicroUsd?: bigint;
  paidGlobalDailyBudgetMicroUsd?: bigint;
  killSwitches?: Partial<OpsSettings["killSwitches"]>;
};

/** The settings after a patch: unset fields keep their current value. */
export function patchedOpsSettings(current: OpsSettings, patch: OpsSettingsPatch): OpsSettings {
  const switches = patch.killSwitches;
  return {
    workspaceEnabled: patch.workspaceEnabled ?? current.workspaceEnabled,
    cohortMode: patch.cohortMode ?? current.cohortMode,
    freeSignupsOpen: patch.freeSignupsOpen ?? current.freeSignupsOpen,
    globalDailyBudgetMicroUsd: patch.globalDailyBudgetMicroUsd ?? current.globalDailyBudgetMicroUsd,
    paidGlobalDailyBudgetMicroUsd: patch.paidGlobalDailyBudgetMicroUsd ?? current.paidGlobalDailyBudgetMicroUsd,
    killSwitches: {
      ai: switches?.ai ?? current.killSwitches.ai,
      studioVideo: switches?.studioVideo ?? current.killSwitches.studioVideo,
      publish: switches?.publish ?? current.killSwitches.publish,
      email: switches?.email ?? current.killSwitches.email,
      social: switches?.social ?? current.killSwitches.social,
      ads: switches?.ads ?? current.killSwitches.ads,
    },
  };
}

/**
 * The one write path for ops settings: validates budgets, writes the
 * singleton and its `ops.settings.changed` audit row. Callers have already
 * checked `requireSuperAdmin(ctx, now)`. `auditExtra` adds fields (a reason,
 * what was confirmed) to the audit metadata.
 */
export async function writeOpsSettings(
  ctx: MutationCtx,
  adminId: Id<"users">,
  patch: OpsSettingsPatch,
  now: number,
  auditExtra: Record<string, string | boolean> = {},
): Promise<OpsSettings> {
  if (patch.globalDailyBudgetMicroUsd !== undefined && patch.globalDailyBudgetMicroUsd < 0n) {
    throw new ConvexError({ code: "INVALID_BUDGET" });
  }
  if (patch.paidGlobalDailyBudgetMicroUsd !== undefined && patch.paidGlobalDailyBudgetMicroUsd < 0n) {
    throw new ConvexError({ code: "INVALID_BUDGET" });
  }
  const row = await ctx.db.query("ops_settings")
    .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
    .unique();
  const next = patchedOpsSettings(row ?? DEFAULT_OPS_SETTINGS, patch);
  let rowId: Id<"ops_settings">;
  if (row === null) {
    rowId = await ctx.db.insert("ops_settings", { ...next, ownerId: adminId, singletonKey: "workspace", updatedAt: now });
  } else {
    rowId = row._id;
    await ctx.db.patch("ops_settings", rowId, { ...next, updatedAt: now });
  }
  await auditOpsChange(ctx, adminId, "ops.settings.changed", "ops_settings", rowId, JSON.stringify({
    workspaceEnabled: next.workspaceEnabled,
    cohortMode: next.cohortMode,
    freeSignupsOpen: next.freeSignupsOpen,
    globalDailyBudgetMicroUsd: next.globalDailyBudgetMicroUsd.toString(),
    paidGlobalDailyBudgetMicroUsd: next.paidGlobalDailyBudgetMicroUsd.toString(),
    killSwitches: next.killSwitches,
    ...auditExtra,
  }), now);
  return next;
}

/** Only a bound super admin may turn runtime features on or off. */
export const updateForAdmin = mutation({
  args: {
    workspaceEnabled: v.optional(v.boolean()),
    cohortMode: v.optional(v.union(v.literal("allowlist"), v.literal("open"))),
    freeSignupsOpen: v.optional(v.boolean()),
    globalDailyBudgetMicroUsd: v.optional(v.int64()),
    paidGlobalDailyBudgetMicroUsd: v.optional(v.int64()),
    killSwitches: v.optional(killSwitchPatchValidator),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    return await writeOpsSettings(ctx, admin.user._id, args, now);
  },
});

/**
 * The one write path for the cohort allowlist: adds or removes the member and
 * writes the `ops.cohort.*` audit row. Callers have already checked
 * `requireSuperAdmin(ctx, now)`. An optional reason goes into the audit metadata.
 */
export async function writeCohortMember(
  ctx: MutationCtx,
  adminId: Id<"users">,
  ownerId: Id<"users">,
  allowed: boolean,
  now: number,
  reason?: string,
): Promise<{ allowed: boolean; changed: boolean }> {
  const target = await ctx.db.get("users", ownerId);
  if (target === null || target.isAnonymous === true) {
    throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  }
  const existing = await ctx.db.query("workspace_cohort")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
  if (allowed === (existing !== null)) return { allowed, changed: false };
  if (allowed) {
    await ctx.db.insert("workspace_cohort", { ownerId, addedBy: adminId, addedAt: now });
  } else if (existing !== null) {
    await ctx.db.delete("workspace_cohort", existing._id);
  }
  await auditOpsChange(
    ctx,
    adminId,
    allowed ? "ops.cohort.added" : "ops.cohort.removed",
    "workspace_cohort",
    ownerId,
    JSON.stringify(reason === undefined ? { allowed } : { allowed, reason }),
    now,
  );
  return { allowed, changed: true };
}

/** The allowlist can be changed while the workspace is off. */
export const setCohortMember = mutation({
  args: { ownerId: v.id("users"), allowed: v.boolean() },
  returns: v.object({ allowed: v.boolean(), changed: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    return await writeCohortMember(ctx, admin.user._id, args.ownerId, args.allowed, now);
  },
});
