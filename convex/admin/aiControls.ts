/**
 * WP93 Phase 2: the owner's ops controls behind `/admin/ai/controls`.
 *
 * Every function checks `requireSuperAdmin`; every write goes through the
 * shared, audited write paths in `convex/ops/settings.ts`. The server
 * enforces every rule in `lib/admin/ai-costs/controls.ts`; the console only
 * explains them.
 */

import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { activeCapOverrideMicroUsd, readGlobalBudget } from "../ai/budgets";
import { DEFAULT_OPS_SETTINGS, writeCohortMember, writeOpsSettings, type OpsSettingsPatch } from "../ops/settings";
import { readMembershipState } from "../platform/membership/state";
import { requireSuperAdmin } from "./superAdmin";
import {
  CAP_OVERRIDE_CEILING_MICRO_USD,
  EXPIRY_CHOICES,
  capOverrideRefusal,
  expiryFor,
} from "../../lib/admin/ai-costs/cap-override";
import {
  budgetAllowed,
  cleanReason,
  confirmMatches,
  normalizeEmail,
  riskReasons,
  signedInRecently,
  type SpendControls,
} from "../../lib/admin/ai-costs/controls";
import {
  OWNER_DAILY_CAP_MICRO_USD,
  int64ToMicroUsd,
  microUsdToInt64,
  utcDayKey,
  zeroAiBudgets,
} from "../../lib/workspace/contracts/metering";

const COHORT_LIST_MAX = 200;
const EMAIL_MATCHES_MAX = 5;
const AUDIT_SCAN_MAX = 200;
const RECENT_CHANGES_MAX = 20;
/** The founders list shows at most this many founders on one page. */
const CAP_OVERRIDE_READ_MAX = 200;

const switchPatch = v.object({
  ai: v.optional(v.boolean()),
  studioVideo: v.optional(v.boolean()),
  publish: v.optional(v.boolean()),
  email: v.optional(v.boolean()),
  social: v.optional(v.boolean()),
  ads: v.optional(v.boolean()),
});

/** The cohort with emails, the settings version, recent `ops.*` changes and the caller's sign-in age. */
export const controlsState = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireSuperAdmin(ctx);
    const settings = await ctx.db.query("ops_settings")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
      .unique();
    const members = await ctx.db.query("workspace_cohort").order("desc").take(COHORT_LIST_MAX + 1);
    const cohort = await Promise.all(members.slice(0, COHORT_LIST_MAX).map(async (member) => {
      const user = await ctx.db.get("users", member.ownerId);
      return {
        ownerId: member.ownerId as string,
        email: user?.email ?? null,
        verified: typeof user?.emailVerificationTime === "number",
        addedAt: member.addedAt,
      };
    }));
    const audit = await ctx.db.query("audit_events")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", admin.user._id))
      .order("desc")
      .take(AUDIT_SCAN_MAX);
    const recent = await Promise.all(audit
      .filter((row) => row.action.startsWith("ops."))
      .slice(0, RECENT_CHANGES_MAX)
      .map(async (row) => {
        // Cohort and cap rows name an account: show its email (super admin only), never more.
        const namesAccount = row.action.startsWith("ops.cohort.") || row.action.startsWith("ops.cap_override.");
        const userId = namesAccount ? ctx.db.normalizeId("users", row.subjectId) : null;
        const subject = userId === null ? null : await ctx.db.get("users", userId);
        return {
          id: row._id as string,
          action: row.action,
          subjectId: row.subjectId,
          subjectEmail: subject?.email ?? null,
          metadata: row.metadata ?? null,
          createdAt: row.createdAt,
        };
      }));
    return {
      version: settings?.updatedAt ?? null,
      cohort,
      cohortTruncated: members.length > COHORT_LIST_MAX,
      recent,
      sessionCreatedAt: admin.session._creationTime,
    };
  },
});

/** One account by email, for adding it to the cohort. Never more than a few matches are read. */
export const findAccount = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const email = normalizeEmail(args.email);
    if (email === null) return { status: "invalid" as const };
    const rows = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).take(EMAIL_MATCHES_MAX);
    const accounts = rows.filter((row) => row.isAnonymous !== true);
    if (accounts.length === 0) return { status: "none" as const };
    if (accounts.length > 1) return { status: "many" as const, count: accounts.length };
    const user = accounts[0];
    const member = await ctx.db.query("workspace_cohort").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).unique();
    return {
      status: "one" as const,
      account: {
        ownerId: user._id as string,
        email: user.email ?? email,
        verified: typeof user.emailVerificationTime === "number",
        createdAt: user.createdAt ?? user._creationTime,
        inCohort: member !== null,
      },
    };
  },
});

/** Adds (verified accounts only) or removes (with a reason) one cohort member. */
export const setCohort = mutation({
  args: { ownerId: v.id("users"), allowed: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    const reason = cleanReason(args.reason);
    if (!args.allowed && reason === null) throw new ConvexError({ code: "REASON_REQUIRED" });
    if (args.allowed) {
      const target = await ctx.db.get("users", args.ownerId);
      if (target === null || target.isAnonymous === true) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
      if (typeof target.emailVerificationTime !== "number") throw new ConvexError({ code: "NOT_VERIFIED" });
    }
    return await writeCohortMember(ctx, admin.user._id, args.ownerId, args.allowed, now, reason ?? undefined);
  },
});

/**
 * Pool budgets and kill switches. A risky change (turning something on, or
 * raising a budget from $0 or above twice today's spend) needs a sign-in from
 * the last 10 minutes and the typed confirm.
 */
export const updateSpendControls = mutation({
  args: {
    expectedVersion: v.union(v.number(), v.null()),
    freeBudgetMicroUsd: v.optional(v.int64()),
    paidBudgetMicroUsd: v.optional(v.int64()),
    killSwitches: v.optional(switchPatch),
    confirm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    const row = await ctx.db.query("ops_settings")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
      .unique();
    if ((row?.updatedAt ?? null) !== args.expectedVersion) throw new ConvexError({ code: "STALE" });
    const settings = row ?? DEFAULT_OPS_SETTINGS;

    for (const budget of [args.freeBudgetMicroUsd, args.paidBudgetMicroUsd]) {
      if (budget === undefined) continue;
      if (budget < 0n) throw new ConvexError({ code: "INVALID_BUDGET" });
      if (!budgetAllowed(int64ToMicroUsd(budget))) throw new ConvexError({ code: "BUDGET_TOO_HIGH" });
    }

    const current: SpendControls = {
      freeBudgetMicroUsd: int64ToMicroUsd(settings.globalDailyBudgetMicroUsd),
      paidBudgetMicroUsd: int64ToMicroUsd(settings.paidGlobalDailyBudgetMicroUsd),
      killSwitches: settings.killSwitches,
    };
    const next: SpendControls = {
      freeBudgetMicroUsd: args.freeBudgetMicroUsd === undefined ? current.freeBudgetMicroUsd : int64ToMicroUsd(args.freeBudgetMicroUsd),
      paidBudgetMicroUsd: args.paidBudgetMicroUsd === undefined ? current.paidBudgetMicroUsd : int64ToMicroUsd(args.paidBudgetMicroUsd),
      killSwitches: { ...current.killSwitches, ...definedSwitches(args.killSwitches) },
    };
    const unchanged = next.freeBudgetMicroUsd === current.freeBudgetMicroUsd &&
      next.paidBudgetMicroUsd === current.paidBudgetMicroUsd &&
      Object.entries(next.killSwitches).every(([key, value]) => current.killSwitches[key as keyof SpendControls["killSwitches"]] === value);
    if (unchanged) throw new ConvexError({ code: "NO_CHANGE" });

    const dayKey = utcDayKey(now);
    const [free, paid] = await Promise.all([readGlobalBudget(ctx, "free", dayKey), readGlobalBudget(ctx, "paid", dayKey)]);
    const risks = riskReasons(current, next, { free: free.spentTodayMicroUsd, paid: paid.spentTodayMicroUsd });
    if (risks.length > 0) {
      if (!signedInRecently(admin.session._creationTime, now)) throw new ConvexError({ code: "REAUTH_REQUIRED" });
      if (!confirmMatches(args.confirm)) throw new ConvexError({ code: "CONFIRM_REQUIRED" });
    }

    const patch: OpsSettingsPatch = {
      globalDailyBudgetMicroUsd: microUsdToInt64(next.freeBudgetMicroUsd),
      paidGlobalDailyBudgetMicroUsd: microUsdToInt64(next.paidBudgetMicroUsd),
      killSwitches: next.killSwitches,
    };
    await writeOpsSettings(ctx, admin.user._id, patch, now, {
      via: "ai-console",
      risky: risks.length > 0,
      ...(risks.length > 0 ? { risks: risks.map((risk) => risk.kind).join(",") } : {}),
    });
    const saved = await ctx.db.query("ops_settings")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
      .unique();
    return { version: saved?.updatedAt ?? now, risky: risks.length > 0 };
  },
});

function definedSwitches(patch: Partial<Record<keyof SpendControls["killSwitches"], boolean | undefined>> | undefined) {
  const out: Partial<Record<keyof SpendControls["killSwitches"], boolean>> = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (typeof value === "boolean") out[key as keyof SpendControls["killSwitches"]] = value;
  }
  return out;
}


/* WP93 Phase 3: per-founder daily cap overrides (storage and meter: Codex C2, #296). */

const expiryValidator = v.union(...EXPIRY_CHOICES.map((choice) => v.literal(choice)));

/**
 * The overrides the meter would honour at `nowMs` for these founders. Expired or
 * partial ones are left out. The caller passes the time, so a cached result
 * never outlives an expiry that no write marked.
 */
export const capOverrides = query({
  args: { ownerIds: v.array(v.string()), nowMs: v.number() },
  handler: async (ctx, args) => {
    const now = args.nowMs;
    await requireSuperAdmin(ctx);
    const ids = [...new Set(args.ownerIds)].slice(0, CAP_OVERRIDE_READ_MAX)
      .map((id) => ctx.db.normalizeId("users", id))
      .filter((id): id is Id<"users"> => id !== null);
    const rows = await Promise.all(ids.map((ownerId) => ctx.db.query("ai_budgets")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .unique()));
    const overrides = [];
    for (const row of rows) {
      const capMicroUsd = activeCapOverrideMicroUsd(row, now);
      if (row === null || capMicroUsd === undefined) continue;
      overrides.push({
        ownerId: row.ownerId as string,
        capMicroUsd,
        expiresAt: row.capOverrideExpiresAt ?? now,
        setAt: row.capOverrideSetAt ?? now,
        reason: row.capOverrideReason ?? "",
      });
    }
    return { overrides, truncated: new Set(args.ownerIds).size > CAP_OVERRIDE_READ_MAX };
  },
});

/**
 * Raises one founder's daily cap until a set time, never past midnight UTC.
 * Always risky: it needs a sign-in from the last 10 minutes and the typed confirm.
 */
export const setCapOverride = mutation({
  args: {
    ownerId: v.id("users"),
    capMicroUsd: v.int64(),
    expiry: expiryValidator,
    reason: v.optional(v.string()),
    confirm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    const target = await ctx.db.get("users", args.ownerId);
    if (target === null || target.isAnonymous === true) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    const reason = cleanReason(args.reason);
    if (reason === null) throw new ConvexError({ code: "CAP_REASON_REQUIRED" });
    if (args.capMicroUsd < 0n) throw new ConvexError({ code: "INVALID_BUDGET" });
    if (args.capMicroUsd > BigInt(CAP_OVERRIDE_CEILING_MICRO_USD)) throw new ConvexError({ code: "CAP_TOO_HIGH" });
    const capMicroUsd = int64ToMicroUsd(args.capMicroUsd);
    const { plan } = await readMembershipState(ctx, args.ownerId);
    const planCapMicroUsd = OWNER_DAILY_CAP_MICRO_USD[plan];
    const refusal = capOverrideRefusal(capMicroUsd, planCapMicroUsd);
    if (refusal !== null) throw new ConvexError({ code: refusal });
    if (!signedInRecently(admin.session._creationTime, now)) throw new ConvexError({ code: "REAUTH_REQUIRED" });
    if (!confirmMatches(args.confirm)) throw new ConvexError({ code: "CONFIRM_REQUIRED" });

    const expiresAt = expiryFor(args.expiry, now);
    const fields = {
      capOverrideMicroUsd: microUsdToInt64(capMicroUsd),
      capOverrideExpiresAt: expiresAt,
      capOverrideSetBy: admin.user._id,
      capOverrideSetAt: now,
      capOverrideReason: reason,
      updatedAt: now,
    };
    const stored = await ctx.db.query("ai_budgets")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (stored === null) {
      // No AI call yet: a zero row in the meter's own shape, which its first reservation rolls forward.
      const zero = zeroAiBudgets(args.ownerId, utcDayKey(now));
      await ctx.db.insert("ai_budgets", {
        ownerId: args.ownerId,
        freeLifetimeSpentMicroUsd: microUsdToInt64(zero.freeLifetimeSpentMicroUsd),
        reservedMicroUsd: microUsdToInt64(zero.reservedMicroUsd),
        freeReservedMicroUsd: microUsdToInt64(zero.freeReservedMicroUsd),
        dayKey: zero.dayKey,
        daySpentMicroUsd: microUsdToInt64(zero.daySpentMicroUsd),
        dayEscalations: microUsdToInt64(zero.dayEscalations),
        ...fields,
      });
    } else {
      await ctx.db.patch("ai_budgets", stored._id, fields);
    }
    await auditCapChange(ctx, admin.user._id, "ops.cap_override.set", args.ownerId, {
      capMicroUsd: String(capMicroUsd),
      planCapMicroUsd: String(planCapMicroUsd),
      expiresAt,
      reason,
      via: "ai-console",
      risky: true,
    }, now);
    return { override: { ownerId: args.ownerId as string, capMicroUsd, expiresAt, setAt: now, reason } };
  },
});

/** Ends a raise early. Lowering spend is one click: no fresh sign-in, still audited. */
export const clearCapOverride = mutation({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const admin = await requireSuperAdmin(ctx, now);
    const stored = await ctx.db.query("ai_budgets")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    const capMicroUsd = activeCapOverrideMicroUsd(stored, now);
    if (stored === null || capMicroUsd === undefined) return { changed: false };
    await ctx.db.patch("ai_budgets", stored._id, {
      capOverrideMicroUsd: undefined,
      capOverrideExpiresAt: undefined,
      capOverrideSetBy: undefined,
      capOverrideSetAt: undefined,
      capOverrideReason: undefined,
      updatedAt: now,
    });
    await auditCapChange(ctx, admin.user._id, "ops.cap_override.cleared", args.ownerId, {
      capMicroUsd: String(capMicroUsd),
      via: "ai-console",
    }, now);
    return { changed: true };
  },
});

async function auditCapChange(
  ctx: MutationCtx,
  adminId: Id<"users">,
  action: "ops.cap_override.set" | "ops.cap_override.cleared",
  ownerId: Id<"users">,
  metadata: Record<string, string | number | boolean>,
  now: number,
): Promise<void> {
  await ctx.db.insert("audit_events", {
    ownerId: adminId,
    actorType: "user",
    actorUserId: adminId,
    action,
    subjectType: "ai_budgets",
    subjectId: ownerId,
    metadata: JSON.stringify(metadata),
    createdAt: now,
  });
}
