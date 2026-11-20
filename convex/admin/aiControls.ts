/**
 * WP93 Phase 2: the owner's ops controls behind `/admin/ai/controls`.
 *
 * Every function checks `requireSuperAdmin`; every write goes through the
 * shared, audited write paths in `convex/ops/settings.ts`. The server
 * enforces every rule in `lib/admin/ai-costs/controls.ts`; the console only
 * explains them.
 */

import { ConvexError, v } from "convex/values";

import { mutation, query } from "../_generated/server";
import { readGlobalBudget } from "../ai/budgets";
import { DEFAULT_OPS_SETTINGS, writeCohortMember, writeOpsSettings, type OpsSettingsPatch } from "../ops/settings";
import { requireSuperAdmin } from "./superAdmin";
import {
  budgetAllowed,
  cleanReason,
  confirmMatches,
  normalizeEmail,
  riskReasons,
  signedInRecently,
  type SpendControls,
} from "../../lib/admin/ai-costs/controls";
import { int64ToMicroUsd, microUsdToInt64, utcDayKey } from "../../lib/workspace/contracts/metering";

const COHORT_LIST_MAX = 200;
const EMAIL_MATCHES_MAX = 5;
const AUDIT_SCAN_MAX = 200;
const RECENT_CHANGES_MAX = 20;

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
        // Cohort rows name an account: show its email (super admin only), never more.
        const userId = row.action.startsWith("ops.cohort.") ? ctx.db.normalizeId("users", row.subjectId) : null;
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

