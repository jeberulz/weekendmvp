import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { requireBusinessForOwner } from "../platform/authz";
import { readMembershipState } from "../platform/membership/state";
import { assertFeatureEnabledForOwner, getOpsSettings } from "../ops/settings";
import {
  addGlobalReservation,
  addGlobalSpend,
  readGlobalBudget,
  readOwnerBudget,
  reserveOwnerBudget,
  spendOwnerBudget,
} from "./budgets";
import {
  assertReserveArgs,
  chargeOnFail,
  firstReserveFailure,
  globalPoolFor,
  int64ToMicroUsd,
  isMicroUsd,
  lateSettleAdjustment,
  microUsdToInt64,
  reservationExpiresAt,
  sweepOutcome,
  utcDayKey,
  type BilledState,
  type FailArgs,
  type FinalizeResult,
  type MarkSentResult,
  type MeterErrorClass,
  type MeterFeature,
  type ReserveArgs,
  type ReserveResult,
  type SettleArgs,
} from "../../lib/workspace/contracts/metering";

const featureValidator = v.union(v.literal("ai"), v.literal("studioVideo"));
const providerValidator = v.union(v.literal("anthropic"), v.literal("openai_images"), v.literal("recraft"), v.literal("video"));
const tierValidator = v.union(v.literal("fast"), v.literal("draft"), v.literal("deep"), v.literal("image"), v.literal("video"));
const billedValidator = v.union(v.literal("none"), v.literal("possible"), v.literal("actual"));
const errorClassValidator = v.union(
  v.literal("retryable"), v.literal("indeterminate"), v.literal("permanent"),
  v.literal("refusal"), v.literal("schema_invalid"), v.literal("timeout"),
);

const reserveArgs = {
  ownerId: v.optional(v.id("users")),
  projectId: v.optional(v.id("projects")),
  taskId: v.optional(v.id("tasks")),
  attemptKey: v.string(),
  promptRef: v.string(),
  provider: providerValidator,
  model: v.string(),
  tier: tierValidator,
  feature: featureValidator,
  reservedMicroUsd: v.number(),
  creditDebitId: v.optional(v.id("credit_ledger")),
  batch: v.optional(v.literal(true)),
  escalation: v.optional(v.literal(true)),
  reask: v.optional(v.literal(true)),
};

type ReserveInput = ReserveArgs & {
  ownerId?: Id<"users">;
  projectId?: Id<"projects">;
  taskId?: Id<"tasks">;
  creditDebitId?: Id<"credit_ledger">;
};

async function verifiedProject(
  ctx: MutationCtx,
  args: ReserveInput,
): Promise<Id<"projects"> | undefined> {
  if (args.ownerId === undefined) return undefined;
  const owner = await ctx.db.get("users", args.ownerId);
  if (owner === null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  let projectId = args.projectId;
  if (args.taskId !== undefined) {
    const task = await ctx.db.get("tasks", args.taskId);
    if (task === null || task.ownerId !== args.ownerId || task.archivedAt !== undefined ||
      (task.status !== "queued" && task.status !== "running") ||
      (projectId !== undefined && task.projectId !== projectId)) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    projectId = task.projectId;
  }
  if (projectId !== undefined) await requireBusinessForOwner(ctx, projectId, args.ownerId);
  return projectId;
}

async function verifyCreditDebit(
  ctx: MutationCtx,
  args: ReserveInput,
  projectId: Id<"projects"> | undefined,
): Promise<boolean> {
  if (args.creditDebitId === undefined) return false;
  const debit = await ctx.db.get("credit_ledger", args.creditDebitId);
  if (debit === null || debit.ownerId !== args.ownerId || debit.taskId !== args.taskId ||
    debit.projectId !== projectId || debit.reason !== "task_debit" || debit.delta >= 0n ||
    debit.idempotencyKey !== `task-debit:${args.taskId}`) {
    throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  }
  const refund = await ctx.db.query("credit_ledger")
    .withIndex("by_ownerId_and_idempotencyKey", (q) =>
      q.eq("ownerId", debit.ownerId).eq("idempotencyKey", `task-refund:${debit._id}`))
    .unique();
  if (refund !== null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  const account = await ctx.db.get("credit_accounts", debit.accountId);
  if (account === null || account.ownerId !== args.ownerId) {
    throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  }
  return true;
}

async function settingsForCall(
  ctx: MutationCtx,
  feature: MeterFeature,
  ownerId?: Id<"users">,
) {
  if (ownerId !== undefined) return await assertFeatureEnabledForOwner(ctx, feature, ownerId);
  const settings = await getOpsSettings(ctx);
  if (!settings.workspaceEnabled) throw new ConvexError({ code: "WORKSPACE_DISABLED" });
  const aiUnavailable = settings.killSwitches.ai ||
    (settings.globalDailyBudgetMicroUsd <= 0n && settings.paidGlobalDailyBudgetMicroUsd <= 0n);
  if (aiUnavailable || (feature === "studioVideo" && settings.killSwitches.studioVideo)) {
    throw new ConvexError({ code: "AI_DISABLED", scope: aiUnavailable ? "ai" : "studioVideo" });
  }
  return settings;
}

function sameAttempt(
  existing: Doc<"ai_usage">,
  args: ReserveInput,
  projectId: Id<"projects"> | undefined,
): boolean {
  return existing.ownerId === args.ownerId &&
    existing.projectId === projectId &&
    existing.taskId === args.taskId &&
    existing.promptRef === args.promptRef &&
    existing.provider === args.provider &&
    existing.model === args.model &&
    existing.tier === args.tier &&
    existing.feature === args.feature &&
    existing.reservedMicroUsd === microUsdToInt64(args.reservedMicroUsd) &&
    existing.creditDebitId === args.creditDebitId &&
    existing.batch === args.batch &&
    existing.escalation === args.escalation &&
    existing.reask === args.reask;
}

export const reserve = internalMutation({
  args: reserveArgs,
  handler: async (ctx, args): Promise<ReserveResult> => {
    assertReserveArgs(args);
    const projectId = await verifiedProject(ctx, args);
    const creditFunded = await verifyCreditDebit(ctx, args, projectId);
    const settings = await settingsForCall(ctx, args.feature, args.ownerId);
    const duplicate = await ctx.db.query("ai_usage")
      .withIndex("by_attemptKey", (q) => q.eq("attemptKey", args.attemptKey))
      .unique();
    if (duplicate !== null) {
      if (!sameAttempt(duplicate, args, projectId)) throw new Error("attemptKey reused for a different call");
      return { usageId: duplicate._id, existing: true };
    }

    const ownerPlan = args.ownerId === undefined
      ? undefined
      : (await readMembershipState(ctx, args.ownerId)).plan;
    const now = Date.now();
    const dayKey = utcDayKey(now);
    const pool = globalPoolFor({ plan: ownerPlan, creditFunded });
    const [freeGlobal, paidGlobal, ownerBudget] = await Promise.all([
      readGlobalBudget(ctx, "free", dayKey),
      readGlobalBudget(ctx, "paid", dayKey),
      args.ownerId === undefined ? Promise.resolve(null) : readOwnerBudget(ctx, args.ownerId),
    ]);
    const failure = firstReserveFailure({
      dayKey,
      killSwitches: settings.killSwitches,
      global: {
        free: { budgetMicroUsd: int64ToMicroUsd(settings.globalDailyBudgetMicroUsd), ...freeGlobal },
        paid: { budgetMicroUsd: int64ToMicroUsd(settings.paidGlobalDailyBudgetMicroUsd), ...paidGlobal },
      },
      owner: args.ownerId === undefined || ownerPlan === undefined
        ? undefined
        : { plan: ownerPlan, budgets: ownerBudget?.budget ?? null },
    }, {
      ownerId: args.ownerId,
      feature: args.feature,
      reservedMicroUsd: args.reservedMicroUsd,
      escalation: args.escalation,
      creditFunded,
    });
    if (failure !== null) throw new ConvexError(failure);

    const usageId = await ctx.db.insert("ai_usage", {
      ownerId: args.ownerId,
      projectId,
      taskId: args.taskId,
      attemptKey: args.attemptKey,
      promptRef: args.promptRef,
      provider: args.provider,
      model: args.model,
      tier: args.tier,
      feature: args.feature,
      plan: ownerPlan,
      globalPool: pool,
      creditFunded,
      creditDebitId: args.creditDebitId,
      batch: args.batch,
      escalation: args.escalation,
      reask: args.reask,
      status: "reserved",
      reservedMicroUsd: microUsdToInt64(args.reservedMicroUsd),
      costMicroUsd: 0n,
      inputTokens: 0n,
      cacheReadTokens: 0n,
      cacheWriteTokens: 0n,
      outputTokens: 0n,
      estimated: false,
      latencyMs: 0,
      createdAt: now,
      dayKey,
      expiresAt: reservationExpiresAt(now, args.batch === true),
    });
    if (args.ownerId !== undefined && ownerBudget !== null) {
      await reserveOwnerBudget(ctx, args.ownerId, {
        ownerId: args.ownerId, plan: ownerPlan, creditFunded,
        reservedMicroUsd: args.reservedMicroUsd, escalation: args.escalation,
        globalPool: pool, dayKey,
      }, ownerBudget, now);
    }
    await addGlobalReservation(ctx, pool, dayKey, args.reservedMicroUsd);
    return { usageId, existing: false };
  },
});

async function requireUsage(ctx: MutationCtx, usageId: Id<"ai_usage">): Promise<Doc<"ai_usage">> {
  const row = await ctx.db.get("ai_usage", usageId);
  if (row === null) throw new Error(`unknown ai_usage id ${usageId}`);
  return row;
}

export const markSent = internalMutation({
  args: { usageId: v.id("ai_usage") },
  handler: async (ctx, args): Promise<MarkSentResult> => {
    const row = await requireUsage(ctx, args.usageId);
    if (row.status !== "reserved") return { usageId: row._id, changed: false, sentAt: row.sentAt };
    if (row.sentAt !== undefined) return { usageId: row._id, changed: false, sentAt: row.sentAt };
    await settingsForCall(ctx, row.feature, row.ownerId);
    const sentAt = Date.now();
    await ctx.db.patch("ai_usage", row._id, { sentAt });
    return { usageId: row._id, changed: true, sentAt };
  },
});

function usageBudgetShape(row: Doc<"ai_usage">) {
  return {
    ownerId: row.ownerId,
    plan: row.plan,
    creditFunded: row.creditFunded,
    reservedMicroUsd: int64ToMicroUsd(row.reservedMicroUsd),
    globalPool: row.globalPool,
    dayKey: row.dayKey,
  };
}

async function applyFinalSpend(
  ctx: MutationCtx,
  row: Doc<"ai_usage">,
  chargeMicroUsd: number,
  releaseReservation: boolean,
  now: number,
): Promise<void> {
  const shape = usageBudgetShape(row);
  await spendOwnerBudget(ctx, shape, chargeMicroUsd, releaseReservation, now);
  await addGlobalSpend(
    ctx, row.globalPool, row.dayKey, chargeMicroUsd,
    releaseReservation ? int64ToMicroUsd(row.reservedMicroUsd) : 0,
  );
}

const settleArgs = {
  usageId: v.id("ai_usage"),
  inputTokens: v.number(),
  cacheReadTokens: v.number(),
  cacheWriteTokens: v.number(),
  outputTokens: v.number(),
  images: v.optional(v.number()),
  videoSeconds: v.optional(v.number()),
  costMicroUsd: v.number(),
  estimated: v.boolean(),
  latencyMs: v.number(),
  stopReason: v.optional(v.string()),
};

function assertSettleArgs(args: SettleArgs): void {
  for (const [name, value] of Object.entries(args)) {
    if (["inputTokens", "cacheReadTokens", "cacheWriteTokens", "outputTokens", "images", "costMicroUsd"].includes(name) &&
      value !== undefined && !isMicroUsd(value)) throw new RangeError(`${name} must be a safe non-negative integer`);
  }
  if (!Number.isFinite(args.latencyMs) || args.latencyMs < 0) throw new RangeError("latencyMs must be non-negative");
  if (args.videoSeconds !== undefined && (!Number.isFinite(args.videoSeconds) || args.videoSeconds < 0)) {
    throw new RangeError("videoSeconds must be non-negative");
  }
}

export const settle = internalMutation({
  args: settleArgs,
  handler: async (ctx, args): Promise<FinalizeResult> => {
    assertSettleArgs(args);
    const row = await requireUsage(ctx, args.usageId);
    const charged = int64ToMicroUsd(row.costMicroUsd);
    if (row.status !== "reserved") {
      let adjustment = 0;
      if (row.sweptAt !== undefined && row.lateCostMicroUsd === undefined) {
        adjustment = lateSettleAdjustment({ chargedMicroUsd: charged, actualMicroUsd: args.costMicroUsd });
        await ctx.db.patch("ai_usage", row._id, { lateCostMicroUsd: microUsdToInt64(args.costMicroUsd) });
        if (adjustment > 0) await applyFinalSpend(ctx, row, adjustment, false, Date.now());
      }
      return { usageId: row._id, alreadyFinal: true, status: row.status, costMicroUsd: charged, lateAdjustmentMicroUsd: adjustment };
    }
    const now = Date.now();
    await ctx.db.patch("ai_usage", row._id, {
      status: "settled",
      costMicroUsd: microUsdToInt64(args.costMicroUsd),
      inputTokens: microUsdToInt64(args.inputTokens),
      cacheReadTokens: microUsdToInt64(args.cacheReadTokens),
      cacheWriteTokens: microUsdToInt64(args.cacheWriteTokens),
      outputTokens: microUsdToInt64(args.outputTokens),
      images: args.images === undefined ? undefined : microUsdToInt64(args.images),
      videoSeconds: args.videoSeconds,
      estimated: args.estimated,
      latencyMs: args.latencyMs,
      stopReason: args.stopReason,
      finalizedAt: now,
      settledAt: now,
      billed: "actual",
    });
    await applyFinalSpend(ctx, row, args.costMicroUsd, true, now);
    return { usageId: row._id, alreadyFinal: false, status: "settled", costMicroUsd: args.costMicroUsd };
  },
});

async function finalizeFailure(
  ctx: MutationCtx,
  row: Doc<"ai_usage">,
  billed: BilledState,
  errorClass: MeterErrorClass,
  latencyMs: number,
  costMicroUsd: number | undefined,
  now: number,
  swept: boolean,
): Promise<FinalizeResult> {
  const charged = chargeOnFail({
    reservedMicroUsd: int64ToMicroUsd(row.reservedMicroUsd), billed, costMicroUsd,
  });
  await ctx.db.patch("ai_usage", row._id, {
    status: "failed", billed, errorClass, latencyMs,
    costMicroUsd: microUsdToInt64(charged), finalizedAt: now,
    sweptAt: swept ? now : undefined,
  });
  await applyFinalSpend(ctx, row, charged, true, now);
  return { usageId: row._id, alreadyFinal: false, status: "failed", costMicroUsd: charged };
}

export const fail = internalMutation({
  args: {
    usageId: v.id("ai_usage"), billed: billedValidator,
    costMicroUsd: v.optional(v.number()), errorClass: errorClassValidator,
    latencyMs: v.number(),
  },
  handler: async (ctx, args): Promise<FinalizeResult> => {
    const input: FailArgs = args;
    if (input.costMicroUsd !== undefined && !isMicroUsd(input.costMicroUsd)) {
      throw new RangeError("costMicroUsd must be a safe non-negative integer");
    }
    if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0) throw new RangeError("latencyMs must be non-negative");
    const row = await requireUsage(ctx, args.usageId);
    if (row.status !== "reserved") return {
      usageId: row._id, alreadyFinal: true, status: row.status,
      costMicroUsd: int64ToMicroUsd(row.costMicroUsd), lateAdjustmentMicroUsd: 0,
    };
    return await finalizeFailure(ctx, row, args.billed, args.errorClass, args.latencyMs, args.costMicroUsd, Date.now(), false);
  },
});

/** Bounded cron worker. It never reserves or sends, and must finish rows after shutdown. */
export const sweepStale = internalMutation({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<{ swept: number; hasMore: boolean }> => {
    if (!Number.isSafeInteger(args.limit) || args.limit < 1 || args.limit > 100) {
      throw new RangeError("sweep limit must be 1..100");
    }
    const now = Date.now();
    const rows = await ctx.db.query("ai_usage")
      .withIndex("by_status_and_expiresAt", (q) => q.eq("status", "reserved").lte("expiresAt", now))
      .take(args.limit + 1);
    for (const row of rows.slice(0, args.limit)) {
      const outcome = sweepOutcome({
        status: row.status, expiresAt: row.expiresAt, sentAt: row.sentAt,
        reservedMicroUsd: int64ToMicroUsd(row.reservedMicroUsd),
      }, now);
      if (outcome !== null) {
        await finalizeFailure(ctx, row, outcome.billed, outcome.errorClass, now - row.createdAt, outcome.chargeMicroUsd, now, true);
      }
    }
    return { swept: Math.min(rows.length, args.limit), hasMore: rows.length > args.limit };
  },
});
