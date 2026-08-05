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
    existing.providerEventId === write.providerEventId
  );
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

  const account = await getOrCreateAccount(ctx, write.ownerId);
  const nextBalance = account.balance + write.delta;
  if (nextBalance < 0n && !write.allowNegative) {
    throw new ConvexError({ code: "INSUFFICIENT_CREDITS" });
  }

  const now = Date.now();
  const ledgerId = await ctx.db.insert("credit_ledger", {
    ownerId: write.ownerId,
    accountId: account._id,
    projectId: write.projectId,
    purchaseId: write.purchaseId,
    taskId: write.taskId,
    reason: write.reason,
    delta: write.delta,
    balanceAfter: nextBalance,
    idempotencyKey: write.idempotencyKey,
    provider: write.provider,
    providerEventId: write.providerEventId,
    createdAt: now,
  });
  await ctx.db.patch("credit_accounts", account._id, {
    balance: nextBalance,
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
    return await applyLedgerDelta(ctx, {
      ownerId: task.ownerId,
      projectId: task.projectId,
      taskId: task._id,
      reason: "task_refund",
      delta: -debit.delta,
      idempotencyKey: `task-refund:${debit._id}`,
      allowNegative: false,
    });
  },
});
