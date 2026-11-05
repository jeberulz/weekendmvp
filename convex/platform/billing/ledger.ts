import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { assertTaskRefundEligible } from "../transitions";
import type { LedgerReason } from "../validators";

type LedgerWrite = {
  ownerId: Id<"users">;
  projectId?: Id<"projects">;
  purchaseId?: Id<"purchases">;
  taskId?: Id<"tasks">;
  reason: LedgerReason;
  delta: bigint;
  idempotencyKey: string;
  provider?: string;
  providerEventId?: string;
  bucket?: "allowance" | "bonus";
  /** Positive source amounts on a debit or refund; their sum is |delta|. */
  bucketSplit?: { allowance: bigint; bonus: bigint };
  allowancePeriodEnd?: number;
  allowNegative: boolean;
};

function idempotencyMatches(existing: Doc<"credit_ledger">, write: LedgerWrite) {
  return (
    existing.ownerId === write.ownerId &&
    existing.projectId === write.projectId &&
    existing.purchaseId === write.purchaseId &&
    existing.taskId === write.taskId &&
    existing.reason === write.reason &&
    existing.delta === write.delta &&
    existing.idempotencyKey === write.idempotencyKey &&
    existing.provider === write.provider &&
    existing.providerEventId === write.providerEventId &&
    (write.bucket === undefined || existing.bucket === write.bucket) &&
    (write.bucketSplit === undefined || (
      existing.bucketSplit?.allowance === write.bucketSplit.allowance &&
      existing.bucketSplit?.bonus === write.bucketSplit.bonus
    )) &&
    (write.allowancePeriodEnd === undefined || existing.allowancePeriodEnd === write.allowancePeriodEnd)
  );
}

type BucketSplit = { allowance: bigint; bonus: bigint };

function splitForWrite(write: LedgerWrite, allowance: bigint): BucketSplit {
  const magnitude = write.delta < 0n ? -write.delta : write.delta;
  if (write.bucketSplit) {
    const { allowance: fromAllowance, bonus } = write.bucketSplit;
    if (fromAllowance < 0n || bonus < 0n || fromAllowance + bonus !== magnitude) {
      throw new ConvexError({ code: "INVALID_BUCKET_SPLIT" });
    }
    return write.bucketSplit;
  }
  if (write.reason === "task_debit") {
    const fromAllowance = allowance < magnitude ? allowance : magnitude;
    return { allowance: fromAllowance, bonus: magnitude - fromAllowance };
  }
  return write.bucket === "allowance"
    ? { allowance: magnitude, bonus: 0n }
    : { allowance: 0n, bonus: magnitude };
}

async function requireTrustedTaskChain(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  projectId: Id<"projects">,
) {
  const [task, project] = await Promise.all([
    ctx.db.get("tasks", taskId),
    ctx.db.get("projects", projectId),
  ]);
  if (
    !task ||
    !project ||
    task.projectId !== project._id ||
    task.ownerId !== project.ownerId ||
    task.archivedAt !== undefined ||
    project.archivedAt !== undefined
  ) {
    throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  }
  return task;
}

async function getOrCreateAccount(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<Doc<"credit_accounts">> {
  const existing = await ctx.db
    .query("credit_accounts")
    .withIndex("by_ownerId", (query) => query.eq("ownerId", ownerId))
    .unique();
  if (existing) return existing;

  const now = Date.now();
  const accountId = await ctx.db.insert("credit_accounts", {
    ownerId,
    balance: 0n,
    createdAt: now,
    updatedAt: now,
  });
  const account = await ctx.db.get("credit_accounts", accountId);
  if (!account) throw new ConvexError({ code: "CREDIT_ACCOUNT_CREATE_FAILED" });
  return account;
}

export async function applyLedgerDelta(
  ctx: MutationCtx,
  write: LedgerWrite,
): Promise<{ duplicate: boolean; balance: bigint; ledgerId: Id<"credit_ledger"> }> {
  if (write.delta === 0n) {
    throw new ConvexError({ code: "ZERO_CREDIT_DELTA" });
  }

  const existing = await ctx.db
    .query("credit_ledger")
    .withIndex("by_ownerId_and_idempotencyKey", (query) =>
      query.eq("ownerId", write.ownerId).eq("idempotencyKey", write.idempotencyKey),
    )
    .unique();
  if (existing) {
    if (!idempotencyMatches(existing, write)) {
      throw new ConvexError({ code: "LEDGER_IDEMPOTENCY_CONFLICT" });
    }
    return {
      duplicate: true,
      balance: existing.balanceAfter,
      ledgerId: existing._id,
    };
  }

  if (write.provider && write.providerEventId) {
    const providerDuplicate = await ctx.db
      .query("credit_ledger")
      .withIndex("by_provider_and_providerEventId", (query) =>
        query
          .eq("provider", write.provider)
          .eq("providerEventId", write.providerEventId),
      )
      .unique();
    if (providerDuplicate) {
      if (!idempotencyMatches(providerDuplicate, write)) {
        throw new ConvexError({ code: "PROVIDER_EVENT_CONFLICT" });
      }
      return {
        duplicate: true,
        balance: providerDuplicate.balanceAfter,
        ledgerId: providerDuplicate._id,
      };
    }
  }

  let account = await getOrCreateAccount(ctx, write.ownerId);
  if (write.reason === "task_debit" && (account.allowanceRemaining ?? 0n) > 0n &&
    account.allowancePeriodEnd !== undefined && account.allowancePeriodEnd <= Date.now()) {
    await applyLedgerDelta(ctx, {
      ownerId: write.ownerId,
      reason: "allowance_expiry",
      delta: -(account.allowanceRemaining ?? 0n),
      idempotencyKey: `allowance-expiry:period:${write.ownerId}:${account.allowancePeriodEnd}`,
      bucket: "allowance",
      allowNegative: true,
    });
    const refreshed = await ctx.db.get("credit_accounts", account._id);
    if (!refreshed) throw new ConvexError({ code: "CREDIT_ACCOUNT_NOT_FOUND" });
    account = refreshed;
  }
  const nextBalance = account.balance + write.delta;
  if (nextBalance < 0n && !write.allowNegative) {
    throw new ConvexError({ code: "INSUFFICIENT_CREDITS" });
  }

  const split = splitForWrite(write, account.allowanceRemaining ?? 0n);
  const allowanceDelta = write.delta < 0n ? -split.allowance : split.allowance;
  const nextAllowance = (account.allowanceRemaining ?? 0n) + allowanceDelta;
  if (nextAllowance < 0n) {
    throw new ConvexError({ code: "INSUFFICIENT_ALLOWANCE" });
  }
  const bucketSplit = write.reason === "task_debit" || write.reason === "task_refund"
    ? split
    : write.bucketSplit;
  const allowancePeriodEnd = write.allowancePeriodEnd ?? (
    write.reason === "task_debit" && split.allowance > 0n ? account.allowancePeriodEnd : undefined
  );

  const now = Date.now();
  const ledgerId = await ctx.db.insert("credit_ledger", {
    ownerId: write.ownerId,
    accountId: account._id,
    projectId: write.projectId,
    purchaseId: write.purchaseId,
    taskId: write.taskId,
    reason: write.reason,
    bucket: write.bucket,
    bucketSplit,
    allowancePeriodEnd,
    delta: write.delta,
    balanceAfter: nextBalance,
    idempotencyKey: write.idempotencyKey,
    provider: write.provider,
    providerEventId: write.providerEventId,
    createdAt: now,
  });
  await ctx.db.patch("credit_accounts", account._id, {
    balance: nextBalance,
    allowanceRemaining: nextAllowance,
    updatedAt: now,
  });
  return { duplicate: false, balance: nextBalance, ledgerId };
}

export const debitTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    credits: v.int64(),
  },
  handler: async (ctx, args) => {
    const task = await requireTrustedTaskChain(ctx, args.taskId, args.projectId);
    if (args.credits <= 0n) {
      throw new ConvexError({ code: "INVALID_CREDIT_AMOUNT" });
    }
    return await applyLedgerDelta(ctx, {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      reason: "task_debit",
      delta: -args.credits,
      idempotencyKey: `task-debit:${task._id}`,
      allowNegative: false,
    });
  },
});

export const refundFailedTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const task = await requireTrustedTaskChain(ctx, args.taskId, args.projectId);
    assertTaskRefundEligible(task.status);
    if (task.status === "cancelled") {
      const sent = await ctx.db.query("ai_usage")
        .withIndex("by_taskId_and_sentAt", (query) => query.eq("taskId", task._id).gt("sentAt", 0))
        .first();
      if (sent) throw new ConvexError({ code: "TASK_REFUND_NOT_ALLOWED" });
    }
    const debit = await ctx.db
      .query("credit_ledger")
      .withIndex("by_ownerId_and_idempotencyKey", (query) =>
        query
          .eq("ownerId", task.ownerId)
          .eq("idempotencyKey", `task-debit:${task._id}`),
      )
      .unique();
    if (
      !debit ||
      debit.reason !== "task_debit" ||
      debit.taskId !== task._id ||
      debit.projectId !== task.projectId ||
      debit.delta >= 0n
    ) {
      throw new ConvexError({ code: "TASK_DEBIT_NOT_FOUND" });
    }
    const refund = await applyLedgerDelta(ctx, {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      reason: "task_refund",
      delta: -debit.delta,
      idempotencyKey: `task-refund:${debit._id}`,
      bucketSplit: debit.bucketSplit ?? { allowance: 0n, bonus: -debit.delta },
      allowancePeriodEnd: debit.allowancePeriodEnd,
      allowNegative: false,
    });
    if (refund.duplicate) {
      const current = await ctx.db.query("credit_accounts")
        .withIndex("by_ownerId", (query) => query.eq("ownerId", task.ownerId)).unique();
      if (!current) throw new ConvexError({ code: "CREDIT_ACCOUNT_NOT_FOUND" });
      return { ...refund, balance: current.balance };
    }
    if (!debit.bucketSplit || debit.bucketSplit.allowance === 0n) return refund;

    const account = await ctx.db.query("credit_accounts")
      .withIndex("by_ownerId", (query) => query.eq("ownerId", task.ownerId)).unique();
    if (!account) throw new ConvexError({ code: "CREDIT_ACCOUNT_NOT_FOUND" });
    // The original allowance expired or a newer period replaced it. Record the
    // exact original split on the refund, then remove that old-period portion
    // in the same transaction so it cannot become spendable again.
    if (debit.allowancePeriodEnd !== undefined &&
      (debit.allowancePeriodEnd <= Date.now() || account.allowancePeriodEnd !== debit.allowancePeriodEnd)) {
      const expiry = await applyLedgerDelta(ctx, {
        ownerId: task.ownerId,
        projectId: task.projectId,
        taskId: task._id,
        reason: "allowance_expiry",
        delta: -debit.bucketSplit.allowance,
        idempotencyKey: `allowance-expiry:task-refund:${debit._id}`,
        bucket: "allowance",
        allowNegative: true,
      });
      return { ...refund, balance: expiry.balance };
    }
    return refund;
  },
});
