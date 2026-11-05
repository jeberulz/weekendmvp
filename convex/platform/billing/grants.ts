import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { requireBusinessForOwner } from "../authz";
import { WORKSPACE_PLAN_LIMITS, type WorkspacePlanId } from "../plans";
import { STARTER_CREDITS } from "../../../lib/workspace/contracts/jobs";
import { applyLedgerDelta } from "./ledger";

type PaidPlan = Exclude<WorkspacePlanId, "free">;

function assertPeriod(periodStart: number, periodEnd: number): void {
  if (!Number.isSafeInteger(periodStart) || !Number.isSafeInteger(periodEnd) || periodStart < 0 || periodEnd <= periodStart) {
    throw new ConvexError({ code: "INVALID_ALLOWANCE_PERIOD" });
  }
}

async function accountForOwner(ctx: MutationCtx, ownerId: Id<"users">) {
  return await ctx.db.query("credit_accounts")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique();
}

async function grantAllowance(
  ctx: MutationCtx,
  input: {
    ownerId: Id<"users">;
    plan: PaidPlan;
    periodEnd: number;
    idempotencyKey: string;
    provider?: string;
    providerEventId?: string;
  },
) {
  if (!await ctx.db.get("users", input.ownerId)) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  const amount = BigInt(WORKSPACE_PLAN_LIMITS[input.plan].limits.monthlyCredits);
  const grant = {
    ownerId: input.ownerId,
    reason: "plan_grant" as const,
    delta: amount,
    idempotencyKey: input.idempotencyKey,
    provider: input.provider,
    providerEventId: input.providerEventId,
    bucket: "allowance" as const,
    // A prior dispute may have put the single balance below zero. A real
    // grant still posts, while paid actions remain suspended until recovery.
    allowNegative: true,
  };
  // A retry must exit before the expiry step. Otherwise it could expire the
  // allowance just granted on its first execution.
  const existing = await ctx.db.query("credit_ledger")
    .withIndex("by_ownerId_and_idempotencyKey", (q) =>
      q.eq("ownerId", input.ownerId).eq("idempotencyKey", input.idempotencyKey),
    ).unique();
  if (existing) return await applyLedgerDelta(ctx, grant);

  const previous = await accountForOwner(ctx, input.ownerId);
  const unused = previous?.allowanceRemaining ?? 0n;
  if (unused > 0n) {
    await applyLedgerDelta(ctx, {
      ownerId: input.ownerId,
      reason: "allowance_expiry",
      delta: -unused,
      idempotencyKey: `allowance-expiry:${input.idempotencyKey}`,
      bucket: "allowance",
      allowNegative: true,
    });
  }
  const result = await applyLedgerDelta(ctx, grant);
  const account = await accountForOwner(ctx, input.ownerId);
  if (!account) throw new ConvexError({ code: "CREDIT_ACCOUNT_CREATE_FAILED" });
  await ctx.db.patch("credit_accounts", account._id, { allowancePeriodEnd: input.periodEnd });
  return result;
}

/** WP74 verifies Free and calls this after creating the first workspace business. */
export const grantStarter = internalMutation({
  args: { ownerId: v.id("users"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    if (!await ctx.db.get("users", args.ownerId)) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    const write = {
      ownerId: args.ownerId,
      projectId: args.projectId,
      reason: "starter_grant" as const,
      delta: BigInt(STARTER_CREDITS),
      idempotencyKey: `starter-grant:${args.ownerId}`,
      bucket: "bonus" as const,
      allowNegative: true,
    };
    const existing = await ctx.db.query("credit_ledger")
      .withIndex("by_ownerId_and_idempotencyKey", (q) =>
        q.eq("ownerId", args.ownerId).eq("idempotencyKey", write.idempotencyKey),
      ).unique();
    if (existing) return await applyLedgerDelta(ctx, write);
    const project = await requireBusinessForOwner(ctx, args.projectId, args.ownerId);
    if (!project.workspace || project.workspace.createdVia !== "wizard") {
      throw new ConvexError({ code: "STARTER_GRANT_NOT_ALLOWED" });
    }
    return await applyLedgerDelta(ctx, write);
  },
});

/** WP80 wires a verified paid Stripe invoice to this internal mutation. */
export const grantPaidInvoice = internalMutation({
  args: {
    ownerId: v.id("users"),
    invoiceId: v.string(),
    plan: v.union(v.literal("builders_hub"), v.literal("growth")),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    if (!/^in_[A-Za-z0-9_]{3,128}$/.test(args.invoiceId)) {
      throw new ConvexError({ code: "INVALID_INVOICE_ID" });
    }
    assertPeriod(args.periodStart, args.periodEnd);
    return await grantAllowance(ctx, {
      ownerId: args.ownerId,
      plan: args.plan,
      periodEnd: args.periodEnd,
      idempotencyKey: `plan-grant:stripe:${args.invoiceId}`,
      provider: "stripe",
      providerEventId: args.invoiceId,
    });
  },
});

/** WP80 verifies a live lifetime or comp grant before calling this. */
export const grantRecurring = internalMutation({
  args: {
    ownerId: v.id("users"),
    grantId: v.string(),
    plan: v.union(v.literal("builders_hub"), v.literal("growth")),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    assertPeriod(args.periodStart, args.periodEnd);
    if (args.grantId.length < 8 || args.grantId.length > 128 || !/^[A-Za-z0-9_:-]+$/.test(args.grantId))
      throw new ConvexError({ code: "INVALID_GRANT_ID" });
    return await grantAllowance(ctx, {
      ownerId: args.ownerId,
      plan: args.plan,
      periodEnd: args.periodEnd,
      idempotencyKey: `plan-grant:${args.grantId}:${args.periodStart}`,
      provider: "grant",
      providerEventId: `${args.grantId}:${args.periodStart}`,
    });
  },
});
