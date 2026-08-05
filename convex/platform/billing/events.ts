import { ConvexError, v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { assertPurchaseTransition } from "../transitions";
import { PLATFORM_BILLING_PURPOSE } from "./catalog";
import { applyLedgerDelta } from "./ledger";

export type PlatformProviderEvent = {
  kind: "checkout_paid" | "checkout_failed" | "refund" | "dispute";
  purpose: typeof PLATFORM_BILLING_PURPOSE;
  eventId: string;
  purchaseId?: string;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  amountMinor?: number;
  currency?: string;
  fullRefund?: boolean;
};

function assertStripeReference(value: string | undefined, prefix: string) {
  if (value !== undefined && !value.startsWith(prefix)) {
    throw new ConvexError({ code: "INVALID_PROVIDER_REFERENCE" });
  }
}

async function resolvePurchase(
  ctx: MutationCtx,
  event: PlatformProviderEvent,
): Promise<Doc<"purchases">> {
  const purchaseId = event.purchaseId
    ? ctx.db.normalizeId("purchases", event.purchaseId)
    : null;
  const byId = purchaseId ? await ctx.db.get("purchases", purchaseId) : null;
  const bySession = event.checkoutSessionId
    ? await ctx.db
        .query("purchases")
        .withIndex("by_provider_and_providerCheckoutSessionId", (query) =>
          query
            .eq("provider", "stripe")
            .eq("providerCheckoutSessionId", event.checkoutSessionId),
        )
        .unique()
    : null;
  const byPaymentIntent = event.paymentIntentId
    ? await ctx.db
        .query("purchases")
        .withIndex("by_provider_and_providerPaymentIntentId", (query) =>
          query
            .eq("provider", "stripe")
            .eq("providerPaymentIntentId", event.paymentIntentId),
        )
        .unique()
    : null;

  const matches = [byId, bySession, byPaymentIntent].filter(
    (candidate): candidate is Doc<"purchases"> => candidate !== null,
  );
  if (matches.length === 0) {
    throw new ConvexError({ code: "PURCHASE_NOT_READY", retryable: true });
  }
  if (matches.some((candidate) => candidate._id !== matches[0]._id)) {
    throw new ConvexError({ code: "PROVIDER_REFERENCE_CONFLICT" });
  }
  const purchase = matches[0];
  if (purchase.provider !== "stripe") {
    throw new ConvexError({ code: "PURCHASE_NOT_FOUND" });
  }
  if (
    event.purchaseId &&
    purchase._id !== purchaseId
  ) {
    throw new ConvexError({ code: "PROVIDER_REFERENCE_CONFLICT" });
  }
  if (
    event.checkoutSessionId &&
    purchase.providerCheckoutSessionId !== event.checkoutSessionId
  ) {
    throw new ConvexError({ code: "PURCHASE_NOT_READY", retryable: true });
  }
  if (
    event.paymentIntentId &&
    purchase.providerPaymentIntentId &&
    purchase.providerPaymentIntentId !== event.paymentIntentId
  ) {
    throw new ConvexError({ code: "PROVIDER_REFERENCE_CONFLICT" });
  }
  return purchase;
}

function assertStoredMoney(purchase: Doc<"purchases">, event: PlatformProviderEvent) {
  if (
    event.amountMinor === undefined ||
    !Number.isSafeInteger(event.amountMinor) ||
    BigInt(event.amountMinor) !== purchase.amountMinor ||
    event.currency?.toLowerCase() !== purchase.currency
  ) {
    throw new ConvexError({ code: "PROVIDER_MONEY_MISMATCH" });
  }
}

export async function settleProviderEvent(
  ctx: MutationCtx,
  event: PlatformProviderEvent,
) {
  if (event.purpose !== PLATFORM_BILLING_PURPOSE) {
    throw new ConvexError({ code: "FOREIGN_BILLING_PURPOSE" });
  }
  if (!/^evt_[A-Za-z0-9_]+$/.test(event.eventId)) {
    throw new ConvexError({ code: "INVALID_PROVIDER_EVENT" });
  }
  assertStripeReference(event.checkoutSessionId, "cs_test_");
  assertStripeReference(event.paymentIntentId, "pi_");

  const purchase = await resolvePurchase(ctx, event);

  if (event.kind === "checkout_paid") {
    if (!event.paymentIntentId) {
      throw new ConvexError({ code: "PAYMENT_REFERENCE_MISSING", retryable: true });
    }
    assertStoredMoney(purchase, event);
    if (purchase.status !== "pending") {
      return { outcome: "ignored" as const, status: purchase.status };
    }
    const nextStatus = assertPurchaseTransition(purchase.status, "paid");
    const ledger = await applyLedgerDelta(ctx, {
      ownerId: purchase.ownerId,
      projectId: purchase.projectId,
      purchaseId: purchase._id,
      reason: "purchase_grant",
      delta: purchase.credits,
      idempotencyKey: `stripe:${event.eventId}`,
      provider: "stripe",
      providerEventId: event.eventId,
      allowNegative: false,
    });
    await ctx.db.patch("purchases", purchase._id, {
      status: nextStatus,
      providerPaymentIntentId: event.paymentIntentId,
      updatedAt: Date.now(),
    });
    return {
      outcome: ledger.duplicate ? ("duplicate" as const) : ("applied" as const),
      status: nextStatus,
    };
  }

  if (event.kind === "checkout_failed") {
    if (purchase.status !== "pending") {
      return { outcome: "ignored" as const, status: purchase.status };
    }
    const nextStatus = assertPurchaseTransition(purchase.status, "failed");
    await ctx.db.patch("purchases", purchase._id, {
      status: nextStatus,
      updatedAt: Date.now(),
    });
    return { outcome: "applied" as const, status: nextStatus };
  }

  if (purchase.status === "pending") {
    throw new ConvexError({ code: "PURCHASE_NOT_READY", retryable: true });
  }
  if (purchase.status === "failed" || purchase.status === "refunded") {
    return { outcome: "ignored" as const, status: purchase.status };
  }

  if (event.kind === "dispute" && purchase.status === "disputed") {
    const existing = await ctx.db
      .query("credit_ledger")
      .withIndex("by_provider_and_providerEventId", (query) =>
        query.eq("provider", "stripe").eq("providerEventId", event.eventId),
      )
      .unique();
    if (
      existing &&
      (existing.purchaseId !== purchase._id || existing.reason !== "dispute")
    ) {
      throw new ConvexError({ code: "PROVIDER_EVENT_CONFLICT" });
    }
    return {
      outcome: existing ? ("duplicate" as const) : ("ignored" as const),
      status: purchase.status,
    };
  }

  if (event.kind === "refund") {
    if (event.fullRefund !== true) {
      throw new ConvexError({ code: "PARTIAL_REFUND_POLICY_UNSUPPORTED" });
    }
    assertStoredMoney(purchase, event);
    const nextStatus = assertPurchaseTransition(purchase.status, "refunded");
    if (purchase.status === "disputed") {
      await ctx.db.patch("purchases", purchase._id, {
        status: nextStatus,
        updatedAt: Date.now(),
      });
      return { outcome: "applied_without_delta" as const, status: nextStatus };
    }
    const ledger = await applyLedgerDelta(ctx, {
      ownerId: purchase.ownerId,
      projectId: purchase.projectId,
      purchaseId: purchase._id,
      reason: "purchase_refund",
      delta: -purchase.credits,
      idempotencyKey: `stripe:${event.eventId}`,
      provider: "stripe",
      providerEventId: event.eventId,
      allowNegative: true,
    });
    await ctx.db.patch("purchases", purchase._id, {
      status: nextStatus,
      updatedAt: Date.now(),
    });
    return {
      outcome: ledger.duplicate ? ("duplicate" as const) : ("applied" as const),
      status: nextStatus,
    };
  }

  const nextStatus = assertPurchaseTransition(purchase.status, "disputed");
  const ledger = await applyLedgerDelta(ctx, {
    ownerId: purchase.ownerId,
    projectId: purchase.projectId,
    purchaseId: purchase._id,
    reason: "dispute",
    delta: -purchase.credits,
    idempotencyKey: `stripe:${event.eventId}`,
    provider: "stripe",
    providerEventId: event.eventId,
    allowNegative: true,
  });
  await ctx.db.patch("purchases", purchase._id, {
    status: nextStatus,
    updatedAt: Date.now(),
  });
  return {
    outcome: ledger.duplicate ? ("duplicate" as const) : ("applied" as const),
    status: nextStatus,
  };
}

export const process = internalMutation({
  args: {
    kind: v.union(
      v.literal("checkout_paid"),
      v.literal("checkout_failed"),
      v.literal("refund"),
      v.literal("dispute"),
    ),
    purpose: v.literal(PLATFORM_BILLING_PURPOSE),
    eventId: v.string(),
    purchaseId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    amountMinor: v.optional(v.number()),
    currency: v.optional(v.string()),
    fullRefund: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => await settleProviderEvent(ctx, args),
});
