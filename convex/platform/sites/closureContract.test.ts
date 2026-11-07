import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../schema";

const modules = import.meta.glob("/convex/**/*.ts");

function indexNames(table: { " indexes": () => { indexDescriptor: string }[] }): string[] {
  return table[" indexes"]().map((index) => index.indexDescriptor);
}

describe("WP78 account-closure C-DATA contract", () => {
  test("existing users and projects remain valid without closure fields", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
      const projectId = await ctx.db.insert("projects", {
        ownerId, source: "own_idea", title: "Existing business", status: "draft",
        idempotencyKey: "wp78:closure:legacy", createdAt: now, updatedAt: now,
      });
      return { ownerId, projectId };
    });
    expect((await t.run((ctx) => ctx.db.get(ids.ownerId)))?.accountClosureRequestedAt)
      .toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(ids.projectId)))?.deletionRequestedAt)
      .toBeUndefined();
    expect(schema.tables.users.validator.fields.accountClosureRequestedAt.isOptional)
      .toBe("optional");
  });

  test("owner-project cursor keeps its place when updatedAt changes", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
      const otherId = await ctx.db.insert("users", { email: "other@example.test" });
      const projectIds = [];
      for (let n = 0; n < 3; n += 1) {
        projectIds.push(await ctx.db.insert("projects", {
          ownerId, source: "own_idea", title: `Business ${n}`, status: "draft",
          idempotencyKey: `wp78:closure:${n}`, createdAt: now + n, updatedAt: now + n,
          ...(n === 1 ? { archivedAt: now } : {}),
        }));
      }
      await ctx.db.insert("projects", {
        ownerId: otherId, source: "own_idea", title: "Other owner's business", status: "draft",
        idempotencyKey: "wp78:closure:other", createdAt: now, updatedAt: now,
      });
      return { ownerId, projectIds };
    });
    const first = await t.run((ctx) => ctx.db.query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ids.ownerId))
      .paginate({ cursor: null, numItems: 1 }));
    expect(first.page.map((project) => project._id)).toEqual([ids.projectIds[0]]);
    expect(first.isDone).toBe(false);
    await t.run((ctx) => ctx.db.patch(ids.projectIds[0], { updatedAt: Date.now() + 60_000 }));
    const second = await t.run((ctx) => ctx.db.query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ids.ownerId))
      .paginate({ cursor: first.continueCursor, numItems: 10 }));
    expect(second.page.map((project) => project._id)).toEqual(ids.projectIds.slice(1));
    expect(indexNames(schema.tables.projects)).toContain("by_ownerId");
  });

  test("a project created after the first page appears later in the owner scan", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await t.run((ctx) => ctx.db.insert("users", { email: "late@example.test" }));
    await t.run(async (ctx) => {
      for (let n = 0; n < 2; n += 1) {
        await ctx.db.insert("projects", {
          ownerId, source: "own_idea", title: `Early ${n}`, status: "draft",
          idempotencyKey: `wp78:closure:early:${n}`, createdAt: n, updatedAt: n,
        });
      }
    });
    const first = await t.run((ctx) => ctx.db.query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .paginate({ cursor: null, numItems: 1 }));
    expect(first.isDone).toBe(false);
    const lateId = await t.run((ctx) => ctx.db.insert("projects", {
      ownerId, source: "own_idea", title: "Late project", status: "draft",
      idempotencyKey: "wp78:closure:late", createdAt: 3, updatedAt: 3,
    }));
    const rest = await t.run((ctx) => ctx.db.query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .paginate({ cursor: first.continueCursor, numItems: 10 }));
    expect(rest.page.map((project) => project._id)).toContain(lateId);
    expect(rest.isDone).toBe(true);
  });

  test("one owner epoch and an owned cursor job fit the additive schema", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
      await ctx.db.patch(ownerId, { accountClosureRequestedAt: now });
      const jobId = await ctx.db.insert("account_closure_jobs", {
        ownerId, requestedAt: now, nextAttemptAt: now,
        state: "scheduled", attempts: 0, projectsProcessed: 0,
        createdAt: now, updatedAt: now,
      });
      return { ownerId, jobId, now };
    });
    const jobs = await t.run((ctx) => ctx.db.query("account_closure_jobs")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ids.ownerId))
      .take(2));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      _id: ids.jobId, ownerId: ids.ownerId,
      requestedAt: ids.now, state: "scheduled", projectsProcessed: 0,
    });
    await t.run((ctx) => ctx.db.patch(ids.jobId, { cursor: "next-page", projectsProcessed: 1 }));
    expect((await t.run((ctx) => ctx.db.get(ids.jobId)))?.cursor).toBe("next-page");
    const fields = schema.tables.account_closure_jobs.validator.fields;
    for (const name of ["ownerId", "requestedAt", "nextAttemptAt", "state", "attempts", "projectsProcessed"] as const) {
      expect(fields[name].isOptional).toBe("required");
    }
    expect(fields.cursor.isOptional).toBe("optional");
    expect(fields.cursorResetAt.isOptional).toBe("optional");
    expect(indexNames(schema.tables.account_closure_jobs)).toEqual(expect.arrayContaining([
      "by_ownerId", "by_state_and_nextAttemptAt",
    ]));
    expect("cancelledAt" in fields).toBe(false);
  });

  test("a second closure job is visible to the future bounded duplicate guard", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await t.run((ctx) => ctx.db.insert("users", { email: "duplicate@example.test" }));
    await t.run(async (ctx) => {
      for (let n = 0; n < 2; n += 1) {
        await ctx.db.insert("account_closure_jobs", {
          ownerId, requestedAt: 1, nextAttemptAt: 1,
          state: "scheduled", attempts: 0, projectsProcessed: 0,
          createdAt: 1 + n, updatedAt: 1 + n,
        });
      }
    });
    const jobs = await t.run((ctx) => ctx.db.query("account_closure_jobs")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .take(2));
    expect(jobs).toHaveLength(2);
  });
});
