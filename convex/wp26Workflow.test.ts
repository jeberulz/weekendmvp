/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import workflowComponent from "@convex-dev/workflow/test";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { PIPELINE, stepIdempotencyKey } from "./platform/engine/pipeline";

/**
 * WP26-S3. Durable run and step state.
 *
 * These cover the state machine the executor sits on: run creation, resume,
 * cooperative cancellation, exactly-once completion, and the attempt ledger
 * that makes the crash window detectable. The retry/reconcile decisions
 * themselves are covered in `platform/engine/executor.test.ts`.
 */

const modules = import.meta.glob("./**/*.ts");

function testConvex() {
  const t = convexTest(schema, modules);
  workflowComponent.register(t);
  return t;
}

type Fixture = {
  ownerId: Id<"users">;
  projectId: Id<"projects">;
};

async function seed(t: TestConvex<typeof schema>, email: string): Promise<Fixture> {
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

describe("run creation", () => {
  test("creates one task and one step per pipeline position", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId, created } = await createRun(t, fixture);

    expect(created).toBe(true);
    const steps = await t.run(async (ctx) =>
      ctx.db
        .query("task_steps")
        .withIndex("by_taskId_and_position", (q) => q.eq("taskId", taskId))
        .collect(),
    );
    expect(steps).toHaveLength(PIPELINE.length);
    expect(steps.map((s) => Number(s.position)).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(steps.every((s) => s.status === "pending")).toBe(true);
  });

  test("a duplicate start returns the same run instead of opening a second", async () => {
    // Two paid pipelines for one purchase is the failure this prevents.
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const first = await createRun(t, fixture, "same-key");
    const second = await createRun(t, fixture, "same-key");

    expect(second.taskId).toBe(first.taskId);
    expect(second.created).toBe(false);

    const taskCount = await t.run(async (ctx) =>
      (await ctx.db.query("tasks").collect()).length,
    );
    expect(taskCount).toBe(1);
  });

  test("refuses a project the caller does not own", async () => {
    const t = testConvex();
    const alice = await seed(t, "alice@example.com");
    const bob = await seed(t, "bob@example.com");

    await expect(
      t.mutation(internal.platform.engine.tasks.createRun, {
        ownerId: bob.ownerId,
        projectId: alice.projectId,
        idempotencyKey: "cross-owner",
        title: "Validation report",
      }),
    ).rejects.toThrow();
  });
});

describe("resume", () => {
  test("reports the last succeeded position, not the last touched one", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    for (const position of [0, 1]) {
      await t.mutation(internal.platform.engine.tasks.markStepRunning, {
        taskId,
        position: BigInt(position),
      });
      await t.mutation(internal.platform.engine.tasks.completeStep, {
        taskId,
        position: BigInt(position),
        outcome: "succeeded",
      });
    }
    // Step 2 started but never finished — the crash point.
    await t.mutation(internal.platform.engine.tasks.markStepRunning, {
      taskId,
      position: 2n,
    });

    const last = await t.query(
      internal.platform.engine.tasks.lastCompletedPosition,
      { taskId },
    );
    expect(last).toBe(1);
  });

  test("a fresh run resumes from before the first step", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    expect(
      await t.query(internal.platform.engine.tasks.lastCompletedPosition, {
        taskId,
      }),
    ).toBe(-1);
  });

  test("re-entering a running step is a no-op rather than an illegal transition", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.markStepRunning, {
      taskId,
      position: 0n,
    });
    await expect(
      t.mutation(internal.platform.engine.tasks.markStepRunning, {
        taskId,
        position: 0n,
      }),
    ).resolves.toBeNull();
  });
});

describe("cancellation", () => {
  test("cancelling a running run makes the state visible to the next step", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });

    const result = await t.mutation(internal.platform.engine.tasks.requestCancel, {
      taskId,
    });
    expect(result.cancelled).toBe(true);

    const state = await t.query(internal.platform.engine.tasks.runState, {
      taskId,
    });
    expect(state.cancelled).toBe(true);
    expect(state.status).toBe("cancelled");
  });

  test("cancelling twice is a no-op, not an error", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.requestCancel, { taskId });
    await expect(
      t.mutation(internal.platform.engine.tasks.requestCancel, { taskId }),
    ).resolves.toEqual({ cancelled: true });
  });

  test("a cancelled run can never be completed as succeeded", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });
    await t.mutation(internal.platform.engine.tasks.requestCancel, { taskId });

    const applied = await t.mutation(internal.platform.engine.tasks.completeRun, {
      taskId,
      outcome: "succeeded",
    });
    expect(applied).toEqual({ applied: false, status: "cancelled" });
  });

  test("a run cancelled while queued does not get dragged back to running", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.requestCancel, { taskId });
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });

    const state = await t.query(internal.platform.engine.tasks.runState, {
      taskId,
    });
    expect(state.status).toBe("cancelled");
  });
});

describe("completion is exactly once", () => {
  test("a duplicate completion signal leaves the first outcome intact", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });

    const first = await t.mutation(internal.platform.engine.tasks.completeRun, {
      taskId,
      outcome: "succeeded",
    });
    const second = await t.mutation(internal.platform.engine.tasks.completeRun, {
      taskId,
      outcome: "failed",
    });

    expect(first).toEqual({ applied: true, status: "succeeded" });
    expect(second).toEqual({ applied: false, status: "succeeded" });
  });

  // Scope note: `convex-test` takes a global lock in its transaction fake, so
  // `Promise.all` here executes sequentially. This asserts that a second
  // completion signal arriving after the first is rejected — it does NOT
  // demonstrate behaviour under real OCC contention, which only a deployed
  // backend can show.
  test("a second completion signal cannot overwrite the first", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);
    await t.mutation(internal.platform.engine.tasks.markRunning, { taskId });

    const results = await Promise.all([
      t.mutation(internal.platform.engine.tasks.completeRun, {
        taskId,
        outcome: "succeeded",
      }),
      t.mutation(internal.platform.engine.tasks.completeRun, {
        taskId,
        outcome: "failed",
      }),
    ]);

    expect(results.filter((r) => r.applied)).toHaveLength(1);
    const statuses = new Set(results.map((r) => r.status));
    expect(statuses.size).toBe(1);
  });
});

describe("the paid-attempt ledger", () => {
  test("no attempt record reads as null", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    expect(
      await t.query(internal.platform.engine.tasks.readAttempt, {
        taskId,
        position: 1n,
      }),
    ).toBeNull();
  });

  test("an unsettled attempt is visible as the crash window", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });

    expect(
      await t.query(internal.platform.engine.tasks.readAttempt, {
        taskId,
        position: 1n,
      }),
    ).toEqual({ attempt: 1, settled: false });
  });

  test("settling closes the window", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });
    await t.mutation(internal.platform.engine.tasks.settleAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
      outcome: "failed",
      errorCode: "PROVIDER_HTTP_503",
    });

    expect(
      await t.query(internal.platform.engine.tasks.readAttempt, {
        taskId,
        position: 1n,
      }),
    ).toEqual({ attempt: 1, settled: true });
  });

  test("a redelivered begin does not mint a phantom second call", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });
    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("workflow_runs")
        .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", taskId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
  });

  test("the retry gets its own record and reads as the latest attempt", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });
    await t.mutation(internal.platform.engine.tasks.settleAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
      outcome: "failed",
      errorCode: "PROVIDER_HTTP_429",
    });
    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 2,
    });

    expect(
      await t.query(internal.platform.engine.tasks.readAttempt, {
        taskId,
        position: 1n,
      }),
    ).toEqual({ attempt: 2, settled: false });
  });

  test("attempts are scoped to their own step, not shared across the pipeline", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });

    expect(
      await t.query(internal.platform.engine.tasks.readAttempt, {
        taskId,
        position: 2n,
      }),
    ).toBeNull();
  });

  test("settling an attempt that was never begun fails rather than erasing evidence", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await expect(
      t.mutation(internal.platform.engine.tasks.settleAttempt, {
        taskId,
        position: 1n,
        attempt: 1,
        outcome: "succeeded",
      }),
    ).rejects.toThrow();
  });

  test("settling twice does not reopen a terminal attempt", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });
    await t.mutation(internal.platform.engine.tasks.settleAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
      outcome: "succeeded",
    });
    const second = await t.mutation(
      internal.platform.engine.tasks.settleAttempt,
      { taskId, position: 1n, attempt: 1, outcome: "failed" },
    );
    expect(second).toEqual({ applied: false });
  });

  test("the key is derived from the task, so two runs never share an attempt", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const runA = await createRun(t, fixture, "run-a");
    const runB = await createRun(t, fixture, "run-b");

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId: runA.taskId,
      position: 1n,
      attempt: 1,
    });

    expect(
      await t.query(internal.platform.engine.tasks.readAttempt, {
        taskId: runB.taskId,
        position: 1n,
      }),
    ).toBeNull();
    expect(stepIdempotencyKey("run-a", 1)).not.toBe(stepIdempotencyKey("run-b", 1));
  });
});

describe("telemetry carries no customer text", () => {
  test("attempt rows store only derived keys, counters, and our own error codes", async () => {
    const t = testConvex();
    const fixture = await seed(t, "owner@example.com");
    const { taskId } = await createRun(t, fixture);

    await t.mutation(internal.platform.engine.tasks.beginAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
    });
    await t.mutation(internal.platform.engine.tasks.settleAttempt, {
      taskId,
      position: 1n,
      attempt: 1,
      outcome: "failed",
      errorCode: "PROVIDER_HTTP_503",
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("workflow_runs")
        .withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", taskId))
        .collect(),
    );

    for (const row of rows) {
      // The only free-form strings on the row are the derived key and our own
      // error code. Neither may echo anything the customer typed.
      expect(row.idempotencyKey).toBe(`${stepIdempotencyKey("run-1", 1)}:attempt:1`);
      expect(row.errorCode).toBe("PROVIDER_HTTP_503");

      // Enumerating the string-valued fields catches a *new* free-text column
      // being added later, which a substring scan for today's fixture values
      // would happily miss.
      const stringFields = Object.entries(row)
        .filter(([, value]) => typeof value === "string")
        .map(([key]) => key)
        .sort();
      expect(stringFields).toEqual([
        "_id",
        "errorCode",
        "idempotencyKey",
        "ownerId",
        "projectId",
        "status",
        "taskId",
        "type",
      ]);

      const serialized = JSON.stringify(row, (_key, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      expect(serialized).not.toContain("Collectible authentication");
      expect(serialized).not.toContain("owner@example.com");
    }
  });
});
