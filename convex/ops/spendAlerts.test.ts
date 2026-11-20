/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import resendTest from "@convex-dev/resend/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "../_generated/api";
import { addGlobalReservation, addGlobalSpend } from "../ai/budgets";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const today = "2026-11-20";
const yesterday = "2026-11-19";

async function setup() {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  resendTest.register(t, "ownerSpendResend");
  const bindingId = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const founderId = await ctx.db.insert("users", { name: "Private Founder", email: "private@example.test" });
    await ctx.db.insert("ops_settings", {
      singletonKey: "workspace", ownerId: founderId, workspaceEnabled: false,
      cohortMode: "allowlist", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 1_000_000n, paidGlobalDailyBudgetMicroUsd: 2_000_000n,
      killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: Date.now(),
    });
    await addGlobalSpend(ctx, "free", today, 500_000, 0);
    await addGlobalReservation(ctx, "free", today, 300_000);
    return ctx.db.insert("super_admins", { role: "super_admin", userId: ownerId, boundAt: Date.now(), boundVia: "deployment_bootstrap" });
  });
  return { t, bindingId };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(today + "T12:00:00Z"));
  vi.stubEnv("AUTH_RESEND_KEY", "platform-test-key");
  vi.stubEnv("AUTH_RESEND_FROM", "Ops <ops@example.test>");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type BatchEmail = { subject: string; text: string; to: string[] };
function provider(statuses: number[] = []) {
  const batches: BatchEmail[][] = [];
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    expect(url).toBe("https://api.resend.com/emails/batch");
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer platform-test-key");
    const batch: BatchEmail[] = JSON.parse(String(options.body));
    batches.push(batch);
    const status = statuses.shift() ?? 200;
    return Response.json(status === 200 ? { data: batch.map((_, i) => ({ id: `mock-${i}` })) } : {}, { status });
  });
  vi.stubGlobal("fetch", fetcher);
  return batches;
}

describe("WP93 owner spend notifications", () => {
  test("one job and one email per newly crossed threshold, including late charges and concurrent ticks", async () => {
    const { t } = await setup();
    const batches = provider();
    await t.run(async (ctx) => {
      await addGlobalSpend(ctx, "paid", yesterday, 2_000_000, 0);
      await addGlobalReservation(ctx, "paid", today, 1_600_000);
    });
    await Promise.all([1, 2].map(() => t.mutation(internal.ops.spend.checkDailyAlarms, {})));
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter((job) => job.name === "ops/spendAlerts:send")).toHaveLength(4);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const emails = batches.flat();
    expect(emails).toHaveLength(4);
    expect(emails.every((email) => email.to.join() === "owner@example.test")).toBe(true);
    const bodies = emails.map((email) => email.text);
    expect(bodies).toContain([
      `The free AI pool reached its 80% threshold for ${today} UTC.`,
      "Spent: $0.50", "In flight: $0.30", "Daily budget: $1.00", "https://www.weekendmvp.app/admin/ai",
    ].join("\n"));
    expect(bodies.filter((body) => body.includes(yesterday))).toHaveLength(2);
    expect(bodies.join()).not.toMatch(/private|founder|example\.test/i);
    expect(await t.mutation(internal.ops.spend.checkDailyAlarms, {})).toMatchObject({ raised: [], priorDayRaised: [] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(batches.flat()).toHaveLength(4);
  });

  test("a binding revoked after detection skips delivery and links the reason to the threshold audit", async () => {
    const { t, bindingId } = await setup();
    const batches = provider();
    await t.mutation(internal.ops.spend.checkDailyAlarms, {});
    await t.run((ctx) => ctx.db.patch("super_admins", bindingId, { revokedAt: Date.now() }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(batches).toEqual([]);
    const events = await t.run((ctx) => ctx.db.query("audit_events").collect());
    expect(events).toHaveLength(2);
    const alarm = events.find((event) => event.action === "ops.spend.threshold")!;
    const notification = events.find((event) => event.action === "ops.spend.notification")!;
    expect(notification.subjectId).toBe(alarm._id);
    expect(JSON.parse(notification.metadata!)).toMatchObject({ outcome: "no_single_active_binding" });
  });

  test.each([
    { statuses: [503, 200], finalStatus: "sent" },
    { statuses: [503, 503], finalStatus: "failed" },
  ])("Resend retries once and records $finalStatus", async ({ statuses, finalStatus }) => {
    const { t } = await setup();
    const batches = provider(statuses);
    expect(await t.mutation(internal.ops.spend.checkDailyAlarms, {})).toMatchObject({ raised: ["free80"] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual(batches[0]);
    const row = await t.run(async (ctx) => (await ctx.db.query("audit_events").collect())
      .find((event) => event.action === "ops.spend.notification"));
    const { emailId } = JSON.parse(row!.metadata!);
    expect(await t.run((ctx) => ctx.runQuery(components.ownerSpendResend.lib.getStatus, { emailId })))
      .toMatchObject({ status: finalStatus });
    expect(await t.mutation(internal.ops.spend.checkDailyAlarms, {})).toMatchObject({ raised: [] });
  });

  test("an unconfigured sender records bounded enqueue failures without replaying the threshold", async () => {
    const { t } = await setup();
    vi.stubEnv("AUTH_RESEND_KEY", "");
    const batches = provider();
    await t.mutation(internal.ops.spend.checkDailyAlarms, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(batches).toEqual([]);
    const events = await t.run((ctx) => ctx.db.query("audit_events").collect());
    expect(events.filter((event) => event.action === "ops.spend.threshold")).toHaveLength(1);
    expect(events.filter((event) => event.action === "ops.spend.notification")
      .map((event) => JSON.parse(event.metadata!).outcome)).toEqual(["enqueue_retry_scheduled", "enqueue_failed"]);
  });
});
