import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "../../_generated/server";
import { requireOwnedProject } from "../authz";
import { assertCheckoutIdempotencyKey, getCreditPack } from "./catalog";

export const prepare = mutation({
  args: {
    projectId: v.id("projects"),
    packId: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    const pack = getCreditPack(args.packId);
    const idempotencyKey = assertCheckoutIdempotencyKey(args.idempotencyKey);
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_ownerId_and_idempotencyKey", (query) =>
        query.eq("ownerId", project.ownerId).eq("idempotencyKey", idempotencyKey),
      )
      .unique();

    if (existing) {
      if (
        existing.projectId !== project._id ||
        existing.amountMinor !== BigInt(pack.amountMinor) ||
        existing.currency !== "usd" ||
        existing.credits !== BigInt(pack.credits)
      ) {
        throw new ConvexError({ code: "PURCHASE_IDEMPOTENCY_CONFLICT" });
      }
      return {
        purchaseId: existing._id,
        projectId: existing.projectId,
        status: existing.status,
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        credits: existing.credits,
        providerCheckoutSessionId: existing.providerCheckoutSessionId,
      };
    }

    const now = Date.now();
    const purchaseId = await ctx.db.insert("purchases", {
      ownerId: project.ownerId,
      projectId: project._id,
      provider: "stripe",
      status: "pending",
      amountMinor: BigInt(pack.amountMinor),
      currency: "usd",
      credits: BigInt(pack.credits),
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    return {
      purchaseId,
      projectId: project._id,
      status: "pending" as const,
      amountMinor: BigInt(pack.amountMinor),
      currency: "usd",
      credits: BigInt(pack.credits),
      providerCheckoutSessionId: undefined,
    };
  },
});
export const attachSession = internalMutation({
  args: {
    purchaseId: v.id("purchases"),
    checkoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^cs_test_[A-Za-z0-9_]+$/.test(args.checkoutSessionId)) {
      throw new ConvexError({ code: "NON_TEST_CHECKOUT_SESSION" });
    }
    const purchase = await ctx.db.get("purchases", args.purchaseId);
    if (!purchase || purchase.provider !== "stripe") {
      throw new ConvexError({ code: "PURCHASE_NOT_FOUND" });
    }
    if (
      purchase.providerCheckoutSessionId &&
      purchase.providerCheckoutSessionId !== args.checkoutSessionId
    ) {
      throw new ConvexError({ code: "CHECKOUT_SESSION_CONFLICT" });
    }
    if (purchase.status !== "pending") {
      return { attached: false, status: purchase.status };
    }
    if (!purchase.providerCheckoutSessionId) {
      await ctx.db.patch("purchases", purchase._id, {
        providerCheckoutSessionId: args.checkoutSessionId,
        updatedAt: Date.now(),
      });
    }
    return { attached: true, status: purchase.status };
  },
});
