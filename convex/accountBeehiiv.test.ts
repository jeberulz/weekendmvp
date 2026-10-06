import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { syncBeehiivAccount } from "./accountBeehiiv";

const modules = import.meta.glob("./**/*.ts");

const env = {
  BEEHIIV_API_KEY: "test-key",
  BEEHIIV_PUBLICATION_ID: "pub_test",
  BEEHIIV_ACCOUNT_AUTOMATION_ID: "aut_account",
};
const reply = (status: number, data: unknown = {}) => new Response(JSON.stringify(data), { status });

describe("new account Beehiiv sync", () => {
  test("creates a new subscriber with separate confirmation and onboarding", async () => {
    const transport = vi.fn().mockResolvedValueOnce(reply(404)).mockResolvedValueOnce(reply(200));
    expect(await syncBeehiivAccount("new@example.test", env, transport)).toEqual({ state: "synced", result: "new_double_opt_in" });
    const [url, options] = transport.mock.calls[1];
    expect(url).toContain("/subscriptions");
    expect(JSON.parse(options.body)).toMatchObject({
      email: "new@example.test", reactivate_existing: false,
      double_opt_override: "on", send_welcome_email: false,
      automation_ids: ["aut_account"],
    });
  });

  test("enrolls an existing active subscriber once without resubscribing", async () => {
    const transport = vi.fn().mockResolvedValueOnce(reply(200, { data: { status: "active" } })).mockResolvedValueOnce(reply(200));
    expect(await syncBeehiivAccount("active@example.test", env, transport)).toEqual({ state: "synced", result: "existing_active_enrolled" });
    expect(transport.mock.calls[1][0]).toContain("/automations/aut_account/journeys");
    expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual({ email: "active@example.test" });
  });

  test.each(["inactive", "validating", "pending", "unsubscribed"])(
    "preserves an existing %s contact",
    async (status) => {
      const transport = vi.fn().mockResolvedValue(reply(200, { data: { status } }));
      expect(await syncBeehiivAccount("old@example.test", env, transport)).toEqual({ state: "skipped", result: "existing_not_active" });
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );

  test("fails without configuration before making any network request", async () => {
    const transport = vi.fn();
    await expect(syncBeehiivAccount("new@example.test", {}, transport)).rejects.toThrow("configuration_required");
    expect(transport).not.toHaveBeenCalled();
  });

  test("does not replay an ambiguous provider write", async () => {
    const transport = vi.fn().mockResolvedValueOnce(reply(404)).mockRejectedValueOnce(new Error("network"));
    await expect(syncBeehiivAccount("new@example.test", env, transport)).rejects.toThrow("create_outcome_unknown");
  });

  test("durable claim, retry and replay state stays bounded by account", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "queued@example.test", emailVerificationTime: Date.now() });
      await ctx.db.insert("account_beehiiv_sync", {
        userId, email: "queued@example.test", state: "pending", attempts: 0, updatedAt: Date.now(),
      });
      return userId;
    });
    expect(await t.mutation(internal.accountBeehiiv.claim, { userId })).toEqual({ email: "queued@example.test" });
    expect(await t.mutation(internal.accountBeehiiv.claim, { userId })).toBeNull();
    await t.mutation(internal.accountBeehiiv.finish, { userId, outcome: "retry", result: "lookup_unavailable" });
    expect(await t.mutation(internal.accountBeehiiv.claim, { userId })).toEqual({ email: "queued@example.test" });
    await t.mutation(internal.accountBeehiiv.finish, { userId, outcome: "synced", result: "new_double_opt_in" });
    expect(await t.mutation(internal.accountBeehiiv.claim, { userId })).toBeNull();
    const row = await t.run(async (ctx) => ctx.db.query("account_beehiiv_sync")
      .withIndex("by_user", (q) => q.eq("userId", userId)).unique());
    expect(row).toMatchObject({ state: "synced", attempts: 2, result: "new_double_opt_in" });
  });

  test("operator replay is limited to safe failed lookups and configuration", async () => {
    const t = convexTest(schema, modules);
    const [safeId, ambiguousId] = await t.run(async (ctx) => {
      const safeId = await ctx.db.insert("users", { email: "safe@example.test" });
      const ambiguousId = await ctx.db.insert("users", { email: "ambiguous@example.test" });
      await ctx.db.insert("account_beehiiv_sync", {
        userId: safeId, email: "safe@example.test", state: "failed", attempts: 5,
        updatedAt: 1, result: "lookup_unavailable:retry_limit",
      });
      await ctx.db.insert("account_beehiiv_sync", {
        userId: ambiguousId, email: "ambiguous@example.test", state: "failed", attempts: 1,
        updatedAt: 1, result: "journey_outcome_unknown",
      });
      return [safeId, ambiguousId] as const;
    });
    expect(await t.mutation(internal.accountBeehiiv.retryFailed, { userId: safeId })).toBe(true);
    expect(await t.mutation(internal.accountBeehiiv.retryFailed, { userId: ambiguousId })).toBe(false);
    expect(await t.mutation(internal.accountBeehiiv.claim, { userId: safeId })).toEqual({ email: "safe@example.test" });
  });
});
