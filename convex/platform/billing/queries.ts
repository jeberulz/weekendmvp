import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireCurrentPlatformUser } from "../authz";

export const summary = query({
  args: { historyLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const requested = args.historyLimit ?? 20;
    const historyLimit = Number.isFinite(requested)
      ? Math.max(1, Math.min(50, Math.floor(requested)))
      : 20;
    const account = await ctx.db
      .query("credit_accounts")
      .withIndex("by_ownerId", (index) => index.eq("ownerId", user._id))
      .unique();
    const ledger = account
      ? await ctx.db
          .query("credit_ledger")
          .withIndex("by_accountId_and_createdAt", (index) =>
            index.eq("accountId", account._id),
          )
          .order("desc")
          .take(historyLimit)
      : [];
    const purchaseBatches = await Promise.all(
      (["pending", "paid", "failed", "disputed", "refunded"] as const).map(
        async (status) =>
          await ctx.db
            .query("purchases")
            .withIndex("by_ownerId_and_status_and_createdAt", (index) =>
              index.eq("ownerId", user._id).eq("status", status),
            )
            .order("desc")
            .take(historyLimit),
      ),
    );
    const purchases = purchaseBatches
      .flat()
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, historyLimit);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_ownerId_and_updatedAt", (index) => index.eq("ownerId", user._id))
      .order("desc")
      .take(25);

    return {
      balance: account?.balance ?? 0n,
      paidActionsSuspended: (account?.balance ?? 0n) < 0n,
      ledger: ledger.map((row) => ({
        id: row._id,
        reason: row.reason,
        delta: row.delta,
        balanceAfter: row.balanceAfter,
        createdAt: row.createdAt,
      })),
      purchases: purchases.map((purchase) => ({
        id: purchase._id,
        status: purchase.status,
        amountMinor: purchase.amountMinor,
        currency: purchase.currency,
        credits: purchase.credits,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
        providerCheckoutSessionId: purchase.providerCheckoutSessionId,
      })),
      projects: projects
        .filter((project) => project.archivedAt === undefined)
        .map((project) => ({
          id: project._id,
          title: project.title,
          status: project.status,
        })),
    };
  },
});
