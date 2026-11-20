/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { ERRORS_PER_MINUTE_MAX } from "./errors";
import { FEEDBACK_PER_HOUR_MAX } from "./entries";

const modules = import.meta.glob("/convex/**/*.ts");
const HOUR = 60 * 60 * 1000;

const SESSION_EXPIRY = 9_999_999_999_999;

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "feedback-admin@example.test", emailVerificationTime: 1 });
    const founderId = await ctx.db.insert("users", { email: "feedback-founder@example.test" });
    const otherId = await ctx.db.insert("users", { email: "feedback-other@example.test" });
    const adminSession = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: SESSION_EXPIRY });
    const founderSession = await ctx.db.insert("authSessions", { userId: founderId, expirationTime: SESSION_EXPIRY });
    const otherSession = await ctx.db.insert("authSessions", { userId: otherId, expirationTime: SESSION_EXPIRY });
    await ctx.db.insert("super_admins", { userId: adminId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap" });
    const projectId = await ctx.db.insert("projects", {
      ownerId: founderId, source: "own_idea", status: "draft", title: "Business", idempotencyKey: "fb-test", createdAt: 1, updatedAt: 1,
    });
    return { adminId, founderId, otherId, adminSession, founderSession, otherSession, projectId };
  });
  const as = (userId: string, sessionId: string) =>
    t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test", tokenIdentifier: `https://local.test|${userId}` });
  return {
    t,
    ...ids,
    admin: as(ids.adminId, ids.adminSession),
    founder: as(ids.founderId, ids.founderSession),
    other: as(ids.otherId, ids.otherSession),
  };
}

const CONTEXT = {
  surface: "workspace" as const,
  route: "/dashboard/b/k57abcdefghijklmnopqrstuvwxyz1234/email?tab=1",
  buildVersion: "abc1234",
  stepStates: [{ key: "blueprint", state: "succeeded" }, { key: "email", state: "needs_you" }],
};

describe("WP95 feedback.entries.submit", () => {
  test("stores the note with owner id, masked route and step states", async () => {
    const { t, founder, founderId, projectId } = await seed();
    await founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "  The email page is slow  ", rating: 4, projectId });
    const rows = await t.run((ctx) => ctx.db.query("feedback_entries").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ownerId: founderId,
      projectId,
      surface: "workspace",
      note: "The email page is slow",
      rating: 4,
      route: "/dashboard/b/[id]/email",
      buildVersion: "abc1234",
      stepStates: [{ key: "blueprint", state: "succeeded" }, { key: "email", state: "needs_you" }],
    });
  });

  test("a rating is optional, and the wizard has no business", async () => {
    const { t, founder } = await seed();
    await founder.mutation(api.feedback.entries.submit, { surface: "wizard", route: "/start/own", note: "Step 3 was unclear", stepStates: [], buildVersion: "dev" });
    const [row] = await t.run((ctx) => ctx.db.query("feedback_entries").collect());
    expect(row?.rating).toBeUndefined();
    expect(row?.projectId).toBeUndefined();
  });

  test("refuses signed-out callers, empty and oversize notes, and bad ratings", async () => {
    const { t, founder } = await seed();
    await expect(t.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "hello" })).rejects.toThrow();
    await expect(founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "   " })).rejects.toThrow();
    await expect(founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "x".repeat(1_001) })).rejects.toThrow();
    for (const rating of [0, 6, 2.5, Number.NaN]) {
      await expect(founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "ok", rating })).rejects.toThrow();
    }
    expect(await t.run((ctx) => ctx.db.query("feedback_entries").collect())).toHaveLength(0);
  });

  test("accepts exactly the limit, counting an emoji once", async () => {
    const { t, founder } = await seed();
    await founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "🙂".repeat(1_000) });
    expect(await t.run((ctx) => ctx.db.query("feedback_entries").collect())).toHaveLength(1);
  });

  test("a business that is not the caller's is refused and nothing is stored", async () => {
    const { t, other, projectId } = await seed();
    await expect(other.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "hi", projectId })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("feedback_entries").collect())).toHaveLength(0);
  });

  test("drops step states that are not plain tokens and caps the list", async () => {
    const { t, founder } = await seed();
    const many = Array.from({ length: 40 }, (_, index) => ({ key: `step_${index}`, state: "waiting" }));
    await founder.mutation(api.feedback.entries.submit, {
      ...CONTEXT,
      note: "ok",
      stepStates: [{ key: "Hello there, my chat said this", state: "x" }, { key: "email", state: "../etc" }, ...many],
    });
    const [row] = await t.run((ctx) => ctx.db.query("feedback_entries").collect());
    expect(row?.stepStates).toHaveLength(16);
    expect(row?.stepStates.every((entry) => /^[a-z0-9_]+$/.test(entry.key))).toBe(true);
  });

  test("stores nothing but the declared fields, so chat text has nowhere to go", async () => {
    const { t, founder } = await seed();
    await founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "fine" });
    const [row] = await t.run((ctx) => ctx.db.query("feedback_entries").collect());
    expect(Object.keys(row ?? {}).sort()).toEqual(
      ["_creationTime", "_id", "buildVersion", "createdAt", "note", "ownerId", "route", "stepStates", "surface"].sort(),
    );
  });

  test("rate limits an owner per hour, and another owner is unaffected", async () => {
    const { founder, other } = await seed();
    for (let index = 0; index < FEEDBACK_PER_HOUR_MAX; index += 1) {
      await founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: `note ${index}` });
    }
    await expect(founder.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "one more" })).rejects.toThrow();
    await other.mutation(api.feedback.entries.submit, { ...CONTEXT, note: "mine" });
  });
});

describe("WP95 feedback.errors.report", () => {
  const base = { source: "boundary" as const, route: "/dashboard/b/k57abcdefghijklmnopqrstuvwxyz1234/team", buildVersion: "abc1234" };

  test("records class, masked route and the owned business only", async () => {
    const { t, founder, founderId, projectId } = await seed();
    const result = await founder.mutation(api.feedback.errors.report, { ...base, errorClass: "TypeError", projectId });
    expect(result).toEqual({ recorded: true });
    const [row] = await t.run((ctx) => ctx.db.query("client_errors").collect());
    expect(row).toMatchObject({ ownerId: founderId, projectId, source: "boundary", errorClass: "TypeError", route: "/dashboard/b/[id]/team", buildVersion: "abc1234" });
    expect(Object.keys(row ?? {}).sort()).toEqual(
      ["_creationTime", "_id", "buildVersion", "createdAt", "errorClass", "ownerId", "projectId", "route", "source"].sort(),
    );
  });

  test("never throws: no session, a sentence as class, someone else's business", async () => {
    const { t, other, projectId } = await seed();
    expect(await t.mutation(api.feedback.errors.report, { ...base, errorClass: "TypeError" })).toEqual({ recorded: false });
    expect(await other.mutation(api.feedback.errors.report, { ...base, errorClass: "Could not load Luna's plan for hello@example.com" })).toEqual({ recorded: false });
    expect(await other.mutation(api.feedback.errors.report, { ...base, errorClass: "RESOURCE_NOT_FOUND", projectId })).toEqual({ recorded: true });
    const rows = await t.run((ctx) => ctx.db.query("client_errors").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.projectId).toBeUndefined();
  });

  test("a dedupe key records once per owner", async () => {
    const { t, founder, other } = await seed();
    const args = { ...base, source: "wren" as const, errorClass: "failed", dedupeKey: "wren:k57message" };
    expect(await founder.mutation(api.feedback.errors.report, args)).toEqual({ recorded: true });
    expect(await founder.mutation(api.feedback.errors.report, args)).toEqual({ recorded: false });
    expect(await other.mutation(api.feedback.errors.report, args)).toEqual({ recorded: true });
    expect(await t.run((ctx) => ctx.db.query("client_errors").collect())).toHaveLength(2);
  });

  test("caps rows per owner per minute", async () => {
    const { t, founder } = await seed();
    for (let index = 0; index < ERRORS_PER_MINUTE_MAX + 5; index += 1) {
      await founder.mutation(api.feedback.errors.report, { ...base, errorClass: "Error" });
    }
    expect(await t.run((ctx) => ctx.db.query("client_errors").collect())).toHaveLength(ERRORS_PER_MINUTE_MAX);
  });
});

describe("WP95 feedback.admin reads", () => {
  test("every read refuses customers and anonymous callers with the same error", async () => {
    const { t, founder } = await seed();
    const calls = [
      (c: Pick<typeof t, "query">) => c.query(api.feedback.admin.listFeedback, { paginationOpts: { numItems: 10, cursor: null } }),
      (c: Pick<typeof t, "query">) => c.query(api.feedback.admin.listErrors, { paginationOpts: { numItems: 10, cursor: null } }),
      (c: Pick<typeof t, "query">) => c.query(api.feedback.admin.overview, { sinceMs: 0 }),
    ];
    for (const call of calls) {
      await expect(call(founder)).rejects.toThrow(/FORBIDDEN/);
      await expect(call(t)).rejects.toThrow(/FORBIDDEN/);
    }
  });

  test("lists newest first, with owner id and no email", async () => {
    const { t, admin, founder, founderId } = await seed();
    await t.run(async (ctx) => {
      await ctx.db.insert("feedback_entries", { ownerId: founderId, surface: "wizard", note: "older", route: "/start/own", stepStates: [], buildVersion: "a", createdAt: 1_000 });
      await ctx.db.insert("feedback_entries", { ownerId: founderId, surface: "workspace", note: "newer", rating: 5, route: "/dashboard/b/[id]", stepStates: [], buildVersion: "a", createdAt: 2_000 });
    });
    void founder;
    const result = await admin.query(api.feedback.admin.listFeedback, { paginationOpts: { numItems: 10, cursor: null } });
    expect(result.page.map((row) => row.note)).toEqual(["newer", "older"]);
    expect(result.page[0]).toMatchObject({ ownerId: founderId, rating: 5, projectId: null });
    expect(JSON.stringify(result)).not.toContain("@example.test");
  });

  test("a page larger than the cap is refused", async () => {
    const { admin } = await seed();
    await expect(admin.query(api.feedback.admin.listErrors, { paginationOpts: { numItems: 101, cursor: null } })).rejects.toThrow(/INVALID_PAGE_SIZE/);
  });

  test("the overview counts ratings and groups errors since the window start", async () => {
    const { t, admin, founderId } = await seed();
    const now = Date.now();
    await t.run(async (ctx) => {
      for (const [rating, createdAt] of [[5, now - 1_000], [3, now - 2_000], [undefined, now - 3_000], [1, now - 10 * HOUR]] as const) {
        await ctx.db.insert("feedback_entries", {
          ownerId: founderId, surface: "workspace", note: "n", ...(rating === undefined ? {} : { rating }),
          route: "/x", stepStates: [], buildVersion: "a", createdAt,
        });
      }
      for (const [errorClass, route] of [["TypeError", "/a"], ["TypeError", "/a"], ["failed", "/b"]] as const) {
        await ctx.db.insert("client_errors", {
          ownerId: founderId, source: "boundary", errorClass, route, buildVersion: "a", createdAt: now - 500,
        });
      }
    });
    const result = await admin.query(api.feedback.admin.overview, { sinceMs: now - HOUR });
    expect(result.feedback).toMatchObject({ count: 3, ratingAverage: 4, unrated: 1, truncated: false });
    expect(result.feedback.ratingCounts).toEqual([0, 0, 1, 0, 1]);
    expect(result.errors.count).toBe(3);
    expect(result.errors.byClass[0]).toEqual({ key: "TypeError", count: 2 });
    expect(result.errors.byRoute[0]).toEqual({ key: "/a", count: 2 });
  });
});
