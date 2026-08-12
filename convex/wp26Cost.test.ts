/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import workflowComponent from "@convex-dev/workflow/test";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  CAP_MICRO_USD,
  PROVIDER_COST_ACTION,
  VALIDATION_REPORT_CREDITS,
} from "./platform/engine/cost";

/**
 * WP26-S4. Durable spend accounting and the exact-once refund.
 *
 * The cap arithmetic is covered as pure functions in
 * `platform/engine/cost.test.ts`; this file covers what only a database can
 * show — that spend survives, is scoped to one run, cannot be double-counted,
 * and that a failed run returns the customer's credits exactly once.
 */

const modules = import.meta.glob("./**/*.ts");

function testConvex() {
  const t = convexTest(schema, modules);
  workflowComponent.register(t);
  return t;
}

type Fixture = { ownerId: Id<"users">; projectId: Id<"projects"> };

async function seed(
  t: TestConvex<typeof schema>,
  email: string,
  credits = 100n,
): Promise<Fixture> {
  return await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email });
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      source: "own_idea",
      status: "draft",
      title: "Collectible authentication",
      idempotencyKey: `project:${email}`,
      createdAt: now,
      updatedAt: now,
    });
    const accountId = await ctx.db.insert("credit_accounts", {
      ownerId,
      balance: credits,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("credit_ledger", {
      ownerId,
      accountId,
      reason: "purchase_grant",
      delta: credits,
      balanceAfter: credits,
      idempotencyKey: `grant:${email}`,
      createdAt: now,
    });
    return { ownerId, projectId };
  });
}

async function createRun(
  t: TestConvex<typeof schema>,
  fixture: Fixture,
  idempotencyKey = "run-1",
) {
  return await t.mutation(internal.platform.engine.tasks.createRun, {
    ownerId: fixture.ownerId,
    projectId: fixture.projectId,
    idempotencyKey,
    title: "Validation report",
  });
}

async function balanceOf(t: TestConvex<typeof schema>, ownerId: Id<"users">) {
  return await t.run(async (ctx) => {
    const account = await ctx.db
      .query("credit_accounts")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .unique();
    return account?.balance ?? 0n;
  });
}

describe("spend accounting", () => {
  test("a fresh run has spent nothing", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    expect(
      await t.query(internal.platform.engine.cost.spentMicroUsd, { taskId }),
    ).toBe(0);
  });

  test("recorded spend accumulates", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 1n,
      attempt: 1,
      reservedMicroUsd: 20_000,
      billedMicroUsd: 12_345,
    });
    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 2n,
      attempt: 1,
      reservedMicroUsd: 20_000,
      billedMicroUsd: 7_655,
    });

    expect(
      await t.query(internal.platform.engine.cost.spentMicroUsd, { taskId }),
    ).toBe(20_000);
  });

  test("the running total is actual spend, not the reservation", async () => {
    // A call may cost far less than its worst case; charging the estimate
    // would starve later steps of budget they are entitled to.
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 1n,
      attempt: 1,
      reservedMicroUsd: 1_000_000,
      billedMicroUsd: 1_000,
    });

    expect(
      await t.query(internal.platform.engine.cost.spentMicroUsd, { taskId }),
    ).toBe(1_000);
  });

  test("a redelivered settle does not double-count the same attempt", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    const first = await t.mutation(
      internal.platform.engine.cost.recordProviderCost,
      { taskId, position: 1n, attempt: 1, reservedMicroUsd: 0, billedMicroUsd: 5_000 },
    );
    const second = await t.mutation(
      internal.platform.engine.cost.recordProviderCost,
      { taskId, position: 1n, attempt: 1, reservedMicroUsd: 0, billedMicroUsd: 5_000 },
    );

    expect(first).toEqual({ recorded: true });
    expect(second).toEqual({ recorded: false });
    expect(
      await t.query(internal.platform.engine.cost.spentMicroUsd, { taskId }),
    ).toBe(5_000);
  });

  test("the retry is charged separately from the first attempt", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 1n,
      attempt: 1,
      reservedMicroUsd: 0,
      billedMicroUsd: 3_000,
    });
    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 1n,
      attempt: 2,
      reservedMicroUsd: 0,
      billedMicroUsd: 3_000,
    });

    expect(
      await t.query(internal.platform.engine.cost.spentMicroUsd, { taskId }),
    ).toBe(6_000);
  });

  test("two runs in one project do not pool their budgets", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const runA = await createRun(t, fixture, "run-a");
    const runB = await createRun(t, fixture, "run-b");

    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId: runA.taskId,
      position: 1n,
      attempt: 1,
      reservedMicroUsd: 0,
      billedMicroUsd: 900_000,
    });

    expect(
      await t.query(internal.platform.engine.cost.spentMicroUsd, {
        taskId: runB.taskId,
      }),
    ).toBe(0);
  });

  test("a negative cost is refused rather than crediting the budget", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await expect(
      t.mutation(internal.platform.engine.cost.recordProviderCost, {
        taskId,
        position: 1n,
        attempt: 1,
        reservedMicroUsd: 0,
        billedMicroUsd: -1_000,
      }),
    ).rejects.toThrow();
  });
});

describe("the pre-call reservation", () => {
  test("passes on a fresh run and reports what it reserved", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    const result = await t.query(
      internal.platform.engine.cost.assertReservation,
      { taskId, position: 1n },
    );
    expect(result.spentMicroUsd).toBe(0);
    expect(result.reservedMicroUsd).toBeGreaterThan(0);
  });

  test("refuses the next call once prior spend leaves no room", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    // Spend to just under the cap. A post-hoc check would still say "under".
    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 0n,
      attempt: 1,
      reservedMicroUsd: 0,
      billedMicroUsd: CAP_MICRO_USD - 1,
    });

    const spent = await t.query(internal.platform.engine.cost.spentMicroUsd, {
      taskId,
    });
    expect(spent).toBeLessThan(CAP_MICRO_USD);

    await expect(
      t.query(internal.platform.engine.cost.assertReservation, {
        taskId,
        position: 1n,
      }),
    ).rejects.toThrow();
  });

  test("the unpaid render step is never refused, whatever was spent", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 0n,
      attempt: 1,
      reservedMicroUsd: 0,
      billedMicroUsd: CAP_MICRO_USD,
    });

    await expect(
      t.query(internal.platform.engine.cost.assertReservation, {
        taskId,
        position: 6n,
      }),
    ).resolves.toEqual({
      spentMicroUsd: CAP_MICRO_USD,
      reservedMicroUsd: 0,
    });
  });

  test("an unreadable cost row fails the reservation instead of counting as free", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.run(async (ctx) => {
      const task = await ctx.db.get("tasks", taskId);
      await ctx.db.insert("audit_events", {
        ownerId: task!.ownerId,
        projectId: task!.projectId,
        actorType: "provider",
        action: PROVIDER_COST_ACTION,
        subjectType: "task",
        subjectId: taskId,
        metadata: "{ not json",
        createdAt: Date.now() + 1,
      });
    });

    await expect(
      t.query(internal.platform.engine.cost.spentMicroUsd, { taskId }),
    ).rejects.toThrow();
  });
});

describe("cost telemetry carries no customer text", () => {
  test("a cost row stores only numbers, ids, and fixed enums", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.cost.recordProviderCost, {
      taskId,
      position: 1n,
      attempt: 1,
      reservedMicroUsd: 20_000,
      billedMicroUsd: 12_345,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("audit_events")
        .withIndex("by_projectId_and_createdAt", (q) =>
          q.eq("projectId", fixture.projectId),
        )
        .collect(),
    );
    const costRows = rows.filter((row) => row.action === PROVIDER_COST_ACTION);
    expect(costRows).toHaveLength(1);

    const metadata: unknown = JSON.parse(costRows[0]!.metadata ?? "null");
    // Every metadata value is a number: there is nowhere for customer text to sit.
    expect(
      Object.values(metadata as Record<string, unknown>).every(
        (value) => typeof value === "number",
      ),
    ).toBe(true);
    expect(JSON.stringify(costRows[0])).not.toContain("Collectible authentication");
    expect(JSON.stringify(costRows[0])).not.toContain("owner@example.com");
  });
});

describe("credits: debit and exact-once refund", () => {
  test("a failed run refunds the customer exactly once", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com", 100n);
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.billing.ledger.debitTask, {
      taskId,
      projectId: fixture.projectId,
      credits: VALIDATION_REPORT_CREDITS,
    });
    expect(await balanceOf(t, fixture.ownerId)).toBe(85n);

    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });
    await t.mutation(internal.platform.engine.tasks.completeRun, {
      taskId,
      outcome: "failed",
    });

    await t.mutation(internal.platform.billing.ledger.refundFailedTask, {
      taskId,
      projectId: fixture.projectId,
    });
    await t.mutation(internal.platform.billing.ledger.refundFailedTask, {
      taskId,
      projectId: fixture.projectId,
    });

    expect(await balanceOf(t, fixture.ownerId)).toBe(100n);

    const refunds = await t.run(async (ctx) =>
      (await ctx.db.query("credit_ledger").collect()).filter(
        (row) => row.reason === "task_refund",
      ),
    );
    expect(refunds).toHaveLength(1);
  });

  // Scope note: `convex-test` serializes transactions with a global lock, so
  // `Promise.all` runs these sequentially. This shows the second refund is
  // rejected on its merits, not that the ledger survives real OCC contention.
  test("a second concurrent refund does not double-credit", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com", 100n);
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.billing.ledger.debitTask, {
      taskId,
      projectId: fixture.projectId,
      credits: VALIDATION_REPORT_CREDITS,
    });
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });
    await t.mutation(internal.platform.engine.tasks.completeRun, {
      taskId,
      outcome: "failed",
    });

    await Promise.all([
      t.mutation(internal.platform.billing.ledger.refundFailedTask, {
        taskId,
        projectId: fixture.projectId,
      }),
      t.mutation(internal.platform.billing.ledger.refundFailedTask, {
        taskId,
        projectId: fixture.projectId,
      }),
    ]);

    expect(await balanceOf(t, fixture.ownerId)).toBe(100n);
  });

  test("a succeeded run is not refunded", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com", 100n);
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.billing.ledger.debitTask, {
      taskId,
      projectId: fixture.projectId,
      credits: VALIDATION_REPORT_CREDITS,
    });
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });
    await t.mutation(internal.platform.engine.tasks.completeRun, {
      taskId,
      outcome: "succeeded",
    });

    await expect(
      t.mutation(internal.platform.billing.ledger.refundFailedTask, {
        taskId,
        projectId: fixture.projectId,
      }),
    ).rejects.toThrow();
    expect(await balanceOf(t, fixture.ownerId)).toBe(85n);
  });

  test("a cancelled run cannot be refunded — the frozen contract has no path", async () => {
    // Documents the escalation in docs/wp/wp26-progress.md rather than hiding
    // it: `assertTaskRefundEligible` admits only `failed`, and `cancelled` is
    // terminal. A customer who cancels mid-run currently forfeits their credits.
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com", 100n);
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.billing.ledger.debitTask, {
      taskId,
      projectId: fixture.projectId,
      credits: VALIDATION_REPORT_CREDITS,
    });
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });
    await t.mutation(internal.platform.engine.tasks.requestCancel, { taskId });

    await expect(
      t.mutation(internal.platform.billing.ledger.refundFailedTask, {
        taskId,
        projectId: fixture.projectId,
      }),
    ).rejects.toThrow();
    expect(await balanceOf(t, fixture.ownerId)).toBe(85n);
  });

  test("a funded start creates the run and charges for it", async () => {
    // The control for the test below: without this, "it threw and made no
    // task" would pass even if `startValidationReport` were broken outright.
    const t = testConvex();
    const fixture = await seed(t, "funded@example.com", 100n);

    const result = await t.mutation(
      internal.platform.engine.workflow.startValidationReport,
      {
        ownerId: fixture.ownerId,
        projectId: fixture.projectId,
        idempotencyKey: "run-funded",
        title: "Validation report",
        rawIdea: "An idea",
      },
    );

    expect(result.started).toBe(true);
    expect(await balanceOf(t, fixture.ownerId)).toBe(100n - VALIDATION_REPORT_CREDITS);

    const debits = await t.run(async (ctx) =>
      (await ctx.db.query("credit_ledger").collect()).filter(
        (row) => row.reason === "task_debit",
      ),
    );
    expect(debits).toHaveLength(1);
    expect(debits[0]!.delta).toBe(-VALIDATION_REPORT_CREDITS);
  });

  test("a duplicate start charges only once", async () => {
    const t = testConvex();
    const fixture = await seed(t, "funded@example.com", 100n);
    const args = {
      ownerId: fixture.ownerId,
      projectId: fixture.projectId,
      idempotencyKey: "run-dup",
      title: "Validation report",
      rawIdea: "An idea",
    };

    const first = await t.mutation(
      internal.platform.engine.workflow.startValidationReport,
      args,
    );
    const second = await t.mutation(
      internal.platform.engine.workflow.startValidationReport,
      args,
    );

    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.taskId).toBe(first.taskId);
    expect(await balanceOf(t, fixture.ownerId)).toBe(100n - VALIDATION_REPORT_CREDITS);
  });

  test("starting a run without enough credits creates no task at all", async () => {
    const t = testConvex();
    const fixture = await seed(t, "broke@example.com", 3n);

    await expect(
      t.mutation(internal.platform.engine.workflow.startValidationReport, {
        ownerId: fixture.ownerId,
        projectId: fixture.projectId,
        idempotencyKey: "run-poor",
        title: "Validation report",
        rawIdea: "An idea",
      }),
    ).rejects.toThrow();

    // The debit and the task creation share one mutation, so a rejected charge
    // must leave no orphan run behind.
    const tasks = await t.run(async (ctx) => ctx.db.query("tasks").collect());
    expect(tasks).toHaveLength(0);
    expect(await balanceOf(t, fixture.ownerId)).toBe(3n);
  });
});
