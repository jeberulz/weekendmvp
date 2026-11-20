import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { readGlobalBudget } from "../ai/budgets";
import { rosterTaskKey } from "../crew/launchRoster";
import { readMembershipState } from "../platform/membership/state";
import { requireSuperAdmin, soleActiveSuperAdminUserId } from "./superAdmin";
import {
  FREE_LIFETIME_CEILING_MICRO_USD,
  OWNER_DAILY_CAP_MICRO_USD,
  int64ToMicroUsd,
} from "../../lib/workspace/contracts/metering";
import type {
  ControlRoom,
  OwnerSummary,
  ProjectCost,
  TimelineRow,
  UsagePlan,
  UsageRow,
} from "../../lib/admin/ai-costs/types";

/**
 * WP93. Read-only queries behind the owner's AI cost console (`/admin/ai`).
 *
 * - Every query starts with `requireSuperAdmin` (WP38): one generic
 *   `FORBIDDEN` for everyone else.
 * - Metadata only. Nothing here reads `chat_messages.body`, artifact
 *   documents or business names; `ai_usage` holds no prompt or reply text.
 * - Every read is bounded. Callers page through `usagePage` and stop at their
 *   own cap; the UI says when a range was cut off. A daily rollup table filled
 *   by a cron is a Codex need (`docs/wp/wp93-stories.md`).
 * - Money converts with the meter's `int64ToMicroUsd`; no rounding here.
 */

/** Rows per `usagePage` call. ~0.6 KB each, so a page stays far under the read limits. */
export const USAGE_PAGE_MAX = 1_000;
/** The widest window `usagePage` serves: 31 UTC days plus edge padding. */
const WINDOW_MAX_MS = 32 * 24 * 60 * 60 * 1000;
/** Owners per `ownerSummaries` call; each reads a handful of small indexed ranges. */
export const OWNER_IDS_MAX = 25;
/** Businesses read per owner. */
const BUSINESSES_PER_OWNER_MAX = 50;
/** Businesses per `launchCosts` call. */
export const PROJECT_IDS_MAX = 25;
/** Calls read per business; a launch is ~10–30 calls plus change rounds and Wren. */
const CALLS_PER_PROJECT_MAX = 600;
/** Timeline rows per page. */
const TIMELINE_PAGE_MAX = 200;
/** Recent seed items scanned for error details on a platform timeline page. */
const SEED_ITEMS_SCAN_MAX = 500;
const COHORT_COUNT_MAX = 500;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function assertDayKey(dayKey: string): void {
  if (!DAY_KEY.test(dayKey) || new Date(`${dayKey}T00:00:00.000Z`).toISOString().slice(0, 10) !== dayKey) {
    throw new ConvexError({ code: "INVALID_DAY" });
  }
}

function assertPageSize(numItems: number, max: number): void {
  if (!Number.isSafeInteger(numItems) || numItems < 1 || numItems > max) {
    throw new ConvexError({ code: "INVALID_PAGE_SIZE", max });
  }
}

function optionalMicro(value: bigint | undefined): number | null {
  return value === undefined ? null : int64ToMicroUsd(value);
}

/** The console's projection of one `ai_usage` row. */
export function toUsageRow(row: Doc<"ai_usage">): UsageRow {
  return {
    id: row._id,
    ownerId: row.ownerId ?? null,
    projectId: row.projectId ?? null,
    promptRef: row.promptRef,
    provider: row.provider,
    model: row.model,
    tier: row.tier,
    plan: row.plan ?? null,
    globalPool: row.globalPool,
    creditFunded: row.creditFunded,
    ownerBudgetBypass: row.ownerBudgetBypass === true,
    batch: row.batch === true,
    escalation: row.escalation === true,
    reask: row.reask === true,
    status: row.status,
    reservedMicroUsd: int64ToMicroUsd(row.reservedMicroUsd),
    costMicroUsd: int64ToMicroUsd(row.costMicroUsd),
    lateCostMicroUsd: optionalMicro(row.lateCostMicroUsd),
    inputTokens: int64ToMicroUsd(row.inputTokens),
    cacheReadTokens: int64ToMicroUsd(row.cacheReadTokens),
    cacheWriteTokens: int64ToMicroUsd(row.cacheWriteTokens),
    outputTokens: int64ToMicroUsd(row.outputTokens),
    images: optionalMicro(row.images),
    estimated: row.estimated,
    latencyMs: row.latencyMs,
    stopReason: row.stopReason ?? null,
    billed: row.billed ?? null,
    errorClass: row.errorClass ?? null,
    swept: row.sweptAt !== undefined,
    createdAt: row.createdAt,
    dayKey: row.dayKey,
  };
}

/**
 * One page of `ai_usage` rows created in `[startMs, endMs)`, oldest first.
 * Uses the built-in creation-time index: the meter inserts each row with
 * `createdAt = Date.now()` in the same mutation, so the two agree.
 */
export const usagePage = query({
  args: { startMs: v.number(), endMs: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (!Number.isFinite(args.startMs) || !Number.isFinite(args.endMs) ||
      args.endMs <= args.startMs || args.endMs - args.startMs > WINDOW_MAX_MS) {
      throw new ConvexError({ code: "INVALID_WINDOW" });
    }
    assertPageSize(args.paginationOpts.numItems, USAGE_PAGE_MAX);
    const result = await ctx.db.query("ai_usage")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", args.startMs).lt("_creationTime", args.endMs))
      .order("asc")
      .paginate(args.paginationOpts);
    return { page: result.page.map(toUsageRow), isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

async function ownerBudgetFor(ctx: QueryCtx, ownerId: Id<"users">, dayKey: string) {
  const row = await ctx.db.query("ai_budgets").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique();
  if (row === null) return { daySpentMicroUsd: 0, reservedMicroUsd: 0, freeLifetimeSpentMicroUsd: 0 };
  return {
    // The meter rolls the day on its next write; read it the same way.
    daySpentMicroUsd: row.dayKey === dayKey ? int64ToMicroUsd(row.daySpentMicroUsd) : 0,
    reservedMicroUsd: int64ToMicroUsd(row.reservedMicroUsd),
    freeLifetimeSpentMicroUsd: int64ToMicroUsd(row.freeLifetimeSpentMicroUsd),
  };
}

async function launchedBusinessCount(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  businesses: Doc<"projects">[],
): Promise<number> {
  const found = await Promise.all(businesses.map(async (project) => {
    const roster = await ctx.db.query("tasks")
      .withIndex("by_ownerId_and_jobKey", (q) => q.eq("ownerId", ownerId).eq("jobKey", rosterTaskKey(project._id)))
      .first();
    return roster !== null;
  }));
  return found.filter(Boolean).length;
}

async function summarizeOwner(ctx: QueryCtx, ownerId: Id<"users">, dayKey: string): Promise<OwnerSummary | null> {
  const user = await ctx.db.get("users", ownerId);
  if (user === null) return null;
  const [membership, budget, projects, cohort, lastCall] = await Promise.all([
    readMembershipState(ctx, ownerId),
    ownerBudgetFor(ctx, ownerId, dayKey),
    ctx.db.query("projects").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).take(BUSINESSES_PER_OWNER_MAX + 1),
    ctx.db.query("workspace_cohort").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique(),
    ctx.db.query("ai_usage").withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", ownerId)).order("desc").first(),
  ]);
  const plan: UsagePlan = membership.plan;
  const businesses = projects.slice(0, BUSINESSES_PER_OWNER_MAX).filter((project) => project.workspace !== undefined);
  return {
    ownerId,
    email: user.email ?? null,
    plan,
    inCohort: cohort !== null,
    dayCapMicroUsd: OWNER_DAILY_CAP_MICRO_USD[plan],
    freeLifetimeCeilingMicroUsd: FREE_LIFETIME_CEILING_MICRO_USD,
    ...budget,
    businesses: businesses.length,
    launches: await launchedBusinessCount(ctx, ownerId, businesses),
    businessesTruncated: projects.length > BUSINESSES_PER_OWNER_MAX,
    lastActiveAt: lastCall?.createdAt ?? null,
  };
}

/**
 * Per-founder facts for the founders table: email (super admin only), plan,
 * today's spend against the daily cap, lifetime free spend, businesses and
 * launches. Never a business name.
 */
export const ownerSummaries = query({
  args: { ownerIds: v.array(v.id("users")), dayKey: v.string() },
  handler: async (ctx, args): Promise<OwnerSummary[]> => {
    await requireSuperAdmin(ctx);
    assertDayKey(args.dayKey);
    if (args.ownerIds.length > OWNER_IDS_MAX) throw new ConvexError({ code: "TOO_MANY_IDS", max: OWNER_IDS_MAX });
    const unique = [...new Set(args.ownerIds)];
    const rows = await Promise.all(unique.map((ownerId) => summarizeOwner(ctx, ownerId, args.dayKey)));
    return rows.filter((row): row is OwnerSummary => row !== null);
  },
});

function isWren(promptRef: string): boolean {
  return promptRef.startsWith("wren-");
}

function isLaunchCall(promptRef: string): boolean {
  return promptRef.startsWith("crew-") && !promptRef.startsWith("crew-idea-seed");
}

function chargedOf(row: Doc<"ai_usage">): number {
  if (row.status === "reserved") return 0;
  const base = int64ToMicroUsd(row.costMicroUsd);
  return row.lateCostMicroUsd === undefined ? base : Math.max(base, int64ToMicroUsd(row.lateCostMicroUsd));
}

/**
 * The full cost of each business, from its first call (not cut by the
 * console's range). A launch is every non-Wren call on the business.
 */
export const launchCosts = query({
  args: { projectIds: v.array(v.id("projects")) },
  handler: async (ctx, args): Promise<ProjectCost[]> => {
    await requireSuperAdmin(ctx);
    if (args.projectIds.length > PROJECT_IDS_MAX) throw new ConvexError({ code: "TOO_MANY_IDS", max: PROJECT_IDS_MAX });
    const unique = [...new Set(args.projectIds)];
    return await Promise.all(unique.map(async (projectId): Promise<ProjectCost> => {
      const rows = await ctx.db.query("ai_usage")
        .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", projectId))
        .order("asc")
        .take(CALLS_PER_PROJECT_MAX + 1);
      const kept = rows.slice(0, CALLS_PER_PROJECT_MAX);
      let launchMicroUsd = 0;
      let wrenMicroUsd = 0;
      for (const row of kept) {
        if (isWren(row.promptRef)) wrenMicroUsd += chargedOf(row);
        else launchMicroUsd += chargedOf(row);
      }
      if (!Number.isSafeInteger(launchMicroUsd) || !Number.isSafeInteger(wrenMicroUsd)) {
        throw new Error("business cost exceeds the safe integer range");
      }
      return {
        projectId,
        ownerId: kept[0]?.ownerId ?? null,
        hasLaunch: kept.some((row) => isLaunchCall(row.promptRef)),
        firstCallAt: kept[0]?.createdAt ?? null,
        lastCallAt: kept.at(-1)?.createdAt ?? null,
        calls: kept.length,
        failedCalls: kept.filter((row) => row.status === "failed").length,
        launchMicroUsd,
        wrenMicroUsd,
        truncated: rows.length > CALLS_PER_PROJECT_MAX,
      };
    }));
  },
});

/**
 * One founder's calls, newest first (or the platform's ownerless calls when
 * `ownerId` is null). Metadata only. Failed seed calls carry their seed
 * item's `errorKind` and `errorDetail` (the provider's one-line message).
 */
export const ownerTimeline = query({
  args: { ownerId: v.union(v.id("users"), v.null()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    assertPageSize(args.paginationOpts.numItems, TIMELINE_PAGE_MAX);
    const ownerId = args.ownerId ?? undefined;
    const result = await ctx.db.query("ai_usage")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .paginate(args.paginationOpts);
    const details = new Map<string, { errorKind: string | null; errorDetail: string | null }>();
    const needsSeedDetail = result.page.some((row) => row.status === "failed" && row.promptRef.startsWith("crew-idea-seed"));
    if (needsSeedDetail) {
      // Seed items are stored under the sole super admin (WP90-S3) and have no usageId index.
      const runOwner = await soleActiveSuperAdminUserId(ctx);
      if (runOwner !== null) {
        const items = await ctx.db.query("idea_seed_items")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", runOwner))
          .order("desc")
          .take(SEED_ITEMS_SCAN_MAX);
        for (const item of items) {
          if (item.usageId !== undefined) {
            details.set(item.usageId, { errorKind: item.errorKind ?? null, errorDetail: item.errorDetail ?? null });
          }
        }
      }
    }
    const page: TimelineRow[] = result.page.map((row) => ({
      ...toUsageRow(row),
      errorKind: details.get(row._id)?.errorKind ?? null,
      errorDetail: details.get(row._id)?.errorDetail ?? null,
    }));
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

/**
 * Ops settings and today's pool counters (the meter's own sharded counters,
 * so these match the gate exactly). Readable while the workspace is off, like
 * `ops/spend.readDaily` (WP70 shutdown-monitoring ruling).
 */
export const controlRoom = query({
  args: { dayKey: v.string() },
  handler: async (ctx, args): Promise<ControlRoom> => {
    await requireSuperAdmin(ctx);
    assertDayKey(args.dayKey);
    const [settings, free, paid, ownerFree, ownerPaid, cohort] = await Promise.all([
      ctx.db.query("ops_settings").withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace")).unique(),
      readGlobalBudget(ctx, "free", args.dayKey),
      readGlobalBudget(ctx, "paid", args.dayKey),
      // The owner's uncapped calls count on separate counters (WP68 owner access).
      readGlobalBudget(ctx, "free", args.dayKey, true),
      readGlobalBudget(ctx, "paid", args.dayKey, true),
      ctx.db.query("workspace_cohort").take(COHORT_COUNT_MAX + 1),
    ]);
    const alarm = settings?.spendAlarmState?.dayKey === args.dayKey
      ? settings.spendAlarmState
      : settings?.spendAlarmPreviousDayState?.dayKey === args.dayKey ? settings.spendAlarmPreviousDayState : undefined;
    return {
      configured: settings !== null,
      workspaceEnabled: settings?.workspaceEnabled ?? false,
      cohortMode: settings?.cohortMode ?? "allowlist",
      cohortSize: Math.min(cohort.length, COHORT_COUNT_MAX),
      cohortSizeTruncated: cohort.length > COHORT_COUNT_MAX,
      freeBudgetMicroUsd: settings ? int64ToMicroUsd(settings.globalDailyBudgetMicroUsd) : 0,
      paidBudgetMicroUsd: settings ? int64ToMicroUsd(settings.paidGlobalDailyBudgetMicroUsd) : 0,
      killSwitches: settings?.killSwitches ?? { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      spendAlarmState: alarm ?? null,
      dayKey: args.dayKey,
      free: { spentMicroUsd: free.spentTodayMicroUsd, inFlightMicroUsd: free.inFlightMicroUsd },
      paid: { spentMicroUsd: paid.spentTodayMicroUsd, inFlightMicroUsd: paid.inFlightMicroUsd },
      uncappedOwner: {
        spentMicroUsd: ownerFree.spentTodayMicroUsd + ownerPaid.spentTodayMicroUsd,
        inFlightMicroUsd: ownerFree.inFlightMicroUsd + ownerPaid.inFlightMicroUsd,
      },
    };
  },
});
