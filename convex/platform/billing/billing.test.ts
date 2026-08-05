/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { PLATFORM_BILLING_PURPOSE, PLATFORM_CREDIT_PACKS } from "./catalog";

const modules = import.meta.glob("/convex/**/*.ts");

type UserFixture = {
  userId: Id<"users">;
  sessionId: Id<"authSessions">;
  projectId: Id<"projects">;
};

async function createUserFixture(
  t: TestConvex<typeof schema>,
  label: string,
): Promise<UserFixture> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: `${label}@example.test` });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: 9_999_999_999_999,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId: userId,
      source: "own_idea",
      title: `${label} project`,
      status: "draft",
      idempotencyKey: `${label}-project`,
      createdAt: 1,
      updatedAt: 1,
    });
    return { userId, sessionId, projectId };
  });
}

function asUser(t: TestConvex<typeof schema>, fixture: UserFixture) {
  return t.withIdentity({
    subject: `${fixture.userId}|${fixture.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${fixture.userId}`,
  });
}

async function createAttachedPurchase(
  t: TestConvex<typeof schema>,
  fixture: UserFixture,
  label: string,
) {
  return await t.run(async (ctx) => {
    const purchaseId = await ctx.db.insert("purchases", {
      ownerId: fixture.userId,
      projectId: fixture.projectId,
      provider: "stripe",
      status: "pending",
      amountMinor: 2_900n,
      currency: "usd",
      credits: 25n,
      idempotencyKey: `purchase-${label}`,
      providerCheckoutSessionId: `cs_test_${label}`,
      createdAt: 1,
      updatedAt: 1,
    });
    return purchaseId;
  });
}

async function payPurchase(
  t: TestConvex<typeof schema>,
  purchaseId: Id<"purchases">,
  label: string,
) {
  return await t.mutation(internal.platform.billing.events.process, {
    kind: "checkout_paid",
    purpose: PLATFORM_BILLING_PURPOSE,
    eventId: `evt_paid_${label}`,
    purchaseId,
    checkoutSessionId: `cs_test_${label}`,
    paymentIntentId: `pi_${label}`,
    amountMinor: 2_900,
    currency: "usd",
  });
}

describe("WP24 server-owned checkout contract", () => {
  test("freezes the exact three approved packs", () => {
    expect(PLATFORM_CREDIT_PACKS).toEqual([
      expect.objectContaining({ id: "starter", amountMinor: 2_900, credits: 25 }),
      expect.objectContaining({ id: "builder", amountMinor: 7_900, credits: 75 }),
      expect.objectContaining({ id: "studio", amountMinor: 19_900, credits: 220 }),
    ]);
  });

  test("prepares one owner-scoped pending purchase per idempotency key", async () => {
    const t = convexTest(schema, modules);
    const owner = await createUserFixture(t, "checkout-owner");
    const stranger = await createUserFixture(t, "checkout-stranger");
    const authenticated = asUser(t, owner);
    const args = {
      projectId: owner.projectId,
      packId: "starter",
      idempotencyKey: "checkout:1234567890abcdef",
    };
    const [first, duplicate] = await Promise.all([
      authenticated.mutation(api.platform.billing.checkout.prepare, args),
      authenticated.mutation(api.platform.billing.checkout.prepare, args),
    ]);
    expect(duplicate.purchaseId).toBe(first.purchaseId);
    expect(first).toMatchObject({
      projectId: owner.projectId,
      status: "pending",
      amountMinor: 2_900n,
      credits: 25n,
      currency: "usd",
    });

    await expect(
      asUser(t, stranger).mutation(api.platform.billing.checkout.prepare, args),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      authenticated.mutation(api.platform.billing.checkout.prepare, {
        ...args,
        packId: "forged-999-credit-pack",
      }),
    ).rejects.toThrow("UNKNOWN_CREDIT_PACK");
  });
});

describe("WP24 exact-once provider settlement", () => {
  test("grants exactly once and rejects forged money or references", async () => {
    const t = convexTest(schema, modules);
    const owner = await createUserFixture(t, "grant");
    const stranger = await createUserFixture(t, "grant-stranger");
    const purchaseId = await createAttachedPurchase(t, owner, "grant");
    await createAttachedPurchase(t, stranger, "grant-stranger");
    await expect(
      t.mutation(internal.platform.billing.events.process, {
        kind: "checkout_paid",
        purpose: PLATFORM_BILLING_PURPOSE,
        eventId: "evt_cross_owner",
        purchaseId,
        checkoutSessionId: "cs_test_grant-stranger",
        paymentIntentId: "pi_cross_owner",
        amountMinor: 2_900,
        currency: "usd",
      }),
    ).rejects.toThrow("PROVIDER_REFERENCE_CONFLICT");
    await expect(
      t.mutation(internal.platform.billing.events.process, {
        kind: "checkout_paid",
        purpose: PLATFORM_BILLING_PURPOSE,
        eventId: "evt_bad_amount",
        purchaseId,
        checkoutSessionId: "cs_test_grant",
        paymentIntentId: "pi_grant",
        amountMinor: 7_900,
        currency: "usd",
      }),
    ).rejects.toThrow("PROVIDER_MONEY_MISMATCH");

    await payPurchase(t, purchaseId, "grant");
    await payPurchase(t, purchaseId, "grant");
    const snapshot = await t.run(async (ctx) => ({
      purchase: await ctx.db.get("purchases", purchaseId),
      ledger: await ctx.db
        .query("credit_ledger")
        .withIndex("by_ownerId_and_idempotencyKey", (query) =>
          query.eq("ownerId", owner.userId).eq("idempotencyKey", "stripe:evt_paid_grant"),
        )
        .unique(),
      account: await ctx.db
        .query("credit_accounts")
        .withIndex("by_ownerId", (query) => query.eq("ownerId", owner.userId))
        .unique(),
    }));
    expect(snapshot.purchase).toMatchObject({ status: "paid" });
    expect(snapshot.ledger).toMatchObject({ delta: 25n, balanceAfter: 25n });
    expect(snapshot.account?.balance).toBe(25n);
  });

  test("retries an unordered refund, rejects unsupported partials, then reverses once", async () => {
    const t = convexTest(schema, modules);
    const owner = await createUserFixture(t, "refund");
    const purchaseId = await createAttachedPurchase(t, owner, "refund");
    await expect(
      t.mutation(internal.platform.billing.events.process, {
        kind: "refund",
        purpose: PLATFORM_BILLING_PURPOSE,
        eventId: "evt_refund_early",
        paymentIntentId: "pi_refund",
        amountMinor: 2_900,
        currency: "usd",
        fullRefund: true,
      }),
    ).rejects.toThrow("PURCHASE_NOT_READY");

    await payPurchase(t, purchaseId, "refund");
    await expect(
      t.mutation(internal.platform.billing.events.process, {
        kind: "refund",
        purpose: PLATFORM_BILLING_PURPOSE,
        eventId: "evt_refund_partial",
        paymentIntentId: "pi_refund",
        amountMinor: 2_900,
        currency: "usd",
        fullRefund: false,
      }),
    ).rejects.toThrow("PARTIAL_REFUND_POLICY_UNSUPPORTED");

    const fullArgs = {
      kind: "refund" as const,
      purpose: "weekendmvp_platform_credits_v1" as const,
      eventId: "evt_refund_full",
      paymentIntentId: "pi_refund",
      amountMinor: 2_900,
      currency: "usd",
      fullRefund: true,
    };
    await t.mutation(internal.platform.billing.events.process, fullArgs);
    await t.mutation(internal.platform.billing.events.process, fullArgs);
    const result = await t.run(async (ctx) => {
      const account = await ctx.db
        .query("credit_accounts")
        .withIndex("by_ownerId", (query) => query.eq("ownerId", owner.userId))
        .unique();
      return {
        purchase: await ctx.db.get("purchases", purchaseId),
        account,
        ledger: account
          ? await ctx.db
              .query("credit_ledger")
              .withIndex("by_accountId_and_createdAt", (query) =>
              query.eq("accountId", account._id),
              )
              .take(10)
          : [],
      };
    });
    expect(result.purchase?.status).toBe("refunded");
    expect(result.account?.balance).toBe(0n);
    expect(result.ledger.map((row) => row.delta)).toEqual([25n, -25n]);
  });

  test("a dispute can make balance negative and a later refund does not double reverse", async () => {
    const t = convexTest(schema, modules);
    const owner = await createUserFixture(t, "dispute");
    const purchaseId = await createAttachedPurchase(t, owner, "dispute");
    await payPurchase(t, purchaseId, "dispute");

    const taskId = await t.run(async (ctx) =>
      await ctx.db.insert("tasks", {
        ownerId: owner.userId,
        projectId: owner.projectId,
        type: "research",
        status: "queued",
        title: "Spend",
        idempotencyKey: "task-dispute",
        createdAt: 2,
        updatedAt: 2,
      }),
    );
    await t.mutation(internal.platform.billing.ledger.debitTask, {
      taskId,
      projectId: owner.projectId,
      credits: 20n,
    });
    const disputeArgs = {
      kind: "dispute",
      purpose: PLATFORM_BILLING_PURPOSE,
      eventId: "evt_dispute",
      paymentIntentId: "pi_dispute",
      amountMinor: 2_900,
      currency: "usd",
    } as const;
    await t.mutation(internal.platform.billing.events.process, disputeArgs);
    expect(
      await t.mutation(internal.platform.billing.events.process, disputeArgs),
    ).toMatchObject({ outcome: "duplicate", status: "disputed" });
    expect(
      await t.mutation(internal.platform.billing.events.process, {
        ...disputeArgs,
        eventId: "evt_dispute_distinct_replay",
      }),
    ).toMatchObject({ outcome: "ignored", status: "disputed" });
    await t.mutation(internal.platform.billing.events.process, {
      kind: "refund",
      purpose: PLATFORM_BILLING_PURPOSE,
      eventId: "evt_after_dispute_refund",
      paymentIntentId: "pi_dispute",
      amountMinor: 2_900,
      currency: "usd",
      fullRefund: true,
    });
    const negativeSummary = await asUser(t, owner).query(api.platform.billing.queries.summary, {
      historyLimit: 20,
    });
    expect(negativeSummary.balance).toBe(-20n);
    expect(negativeSummary.paidActionsSuspended).toBe(true);
    expect(negativeSummary.purchases[0].status).toBe("refunded");
    expect(negativeSummary.ledger.filter((row) => row.reason === "dispute")).toHaveLength(1);
    expect(negativeSummary.ledger.filter((row) => row.reason === "purchase_refund")).toHaveLength(0);

    const recoveryPurchase = await createAttachedPurchase(t, owner, "recovery");
    await payPurchase(t, recoveryPurchase, "recovery");
    const recovered = await asUser(t, owner).query(api.platform.billing.queries.summary, {
      historyLimit: 20,
    });
    expect(recovered.balance).toBe(5n);
    expect(recovered.paidActionsSuspended).toBe(false);
  });
});

describe("WP24 atomic task spending", () => {
  test("concurrent spends cannot overdraw and failed task refunds are exact once", async () => {
    const t = convexTest(schema, modules);
    const owner = await createUserFixture(t, "spend");
    const purchaseId = await createAttachedPurchase(t, owner, "spend");
    await payPurchase(t, purchaseId, "spend");
    const [taskA, taskB] = await t.run(async (ctx) => {
      const makeTask = async (label: string) =>
        await ctx.db.insert("tasks", {
          ownerId: owner.userId,
          projectId: owner.projectId,
          type: "research" as const,
          status: "queued" as const,
          title: label,
          idempotencyKey: `task-${label}`,
          createdAt: 2,
          updatedAt: 2,
        });
      return [await makeTask("a"), await makeTask("b")] as const;
    });
    const spends = await Promise.allSettled([
      t.mutation(internal.platform.billing.ledger.debitTask, {
        taskId: taskA,
        projectId: owner.projectId,
        credits: 20n,
      }),
      t.mutation(internal.platform.billing.ledger.debitTask, {
        taskId: taskB,
        projectId: owner.projectId,
        credits: 20n,
      }),
    ]);
    expect(spends.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(spends.filter((result) => result.status === "rejected")).toHaveLength(1);

    const debitedTaskId = spends[0].status === "fulfilled" ? taskA : taskB;
    const duplicateDebits = await Promise.all([
      t.mutation(internal.platform.billing.ledger.debitTask, {
        taskId: debitedTaskId,
        projectId: owner.projectId,
        credits: 20n,
      }),
      t.mutation(internal.platform.billing.ledger.debitTask, {
        taskId: debitedTaskId,
        projectId: owner.projectId,
        credits: 20n,
      }),
    ]);
    expect(duplicateDebits.every((result) => result.duplicate)).toBe(true);
    await expect(
      t.mutation(internal.platform.billing.ledger.debitTask, {
        taskId: debitedTaskId,
        projectId: owner.projectId,
        credits: 19n,
      }),
    ).rejects.toThrow("LEDGER_IDEMPOTENCY_CONFLICT");
    await expect(
      t.mutation(internal.platform.billing.ledger.debitTask, {
        taskId: debitedTaskId,
        projectId: owner.projectId,
        credits: 20n,
        idempotencyKey: "caller-controlled",
      } as never),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      await ctx.db.patch("tasks", debitedTaskId, { status: "failed", updatedAt: 3 });
    });
    const refundArgs = {
      taskId: debitedTaskId,
      projectId: owner.projectId,
    };
    const refunds = await Promise.all([
      t.mutation(internal.platform.billing.ledger.refundFailedTask, refundArgs),
      t.mutation(internal.platform.billing.ledger.refundFailedTask, refundArgs),
    ]);
    expect(refunds.filter((result) => !result.duplicate)).toHaveLength(1);
    expect(refunds.filter((result) => result.duplicate)).toHaveLength(1);
    await expect(
      t.mutation(internal.platform.billing.ledger.refundFailedTask, {
        ...refundArgs,
        idempotencyKey: "caller-controlled-refund",
      } as never),
    ).rejects.toThrow();
    const summary = await asUser(t, owner).query(api.platform.billing.queries.summary, {
      historyLimit: 20,
    });
    expect(summary.balance).toBe(25n);
    expect(summary.ledger.filter((row) => row.reason === "task_debit")).toHaveLength(1);
    expect(summary.ledger.filter((row) => row.reason === "task_refund")).toHaveLength(1);
    expect(
      summary.ledger.reduce((sum, row) => sum + row.delta, 0n),
    ).toBe(summary.balance);
    const businessKeys = await t.run(async (ctx) => {
      const debit = await ctx.db
        .query("credit_ledger")
        .withIndex("by_ownerId_and_idempotencyKey", (query) =>
          query
            .eq("ownerId", owner.userId)
            .eq("idempotencyKey", `task-debit:${debitedTaskId}`),
        )
        .unique();
      const refund = debit
        ? await ctx.db
            .query("credit_ledger")
            .withIndex("by_ownerId_and_idempotencyKey", (query) =>
              query
                .eq("ownerId", owner.userId)
                .eq("idempotencyKey", `task-refund:${debit._id}`),
            )
            .unique()
        : null;
      return { debit, refund };
    });
    expect(businessKeys.debit).toMatchObject({ taskId: debitedTaskId });
    expect(businessKeys.refund).toMatchObject({ taskId: debitedTaskId });
  });
});
