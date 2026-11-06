import { register as registerResend } from "@convex-dev/resend/test";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { components, internal } from "../../_generated/api";
import crons from "../../crons";
import schema from "../../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-01-01T00:00:00.000Z");

describe("WP79 tenant email retention", () => {
  it("registers the two daily component cleanups with explicit retention windows", () => {
    const specs = JSON.parse((crons as unknown as { export: () => string }).export());
    expect(specs["tenant email finalized cleanup"]).toMatchObject({
      name: "growth/email/cleanup:finalized",
      schedule: { type: "daily", hourUTC: 2, minuteUTC: 15 },
      args: [{ olderThan: 7 * DAY_MS }],
    });
    expect(specs["tenant email abandoned cleanup"]).toMatchObject({
      name: "growth/email/cleanup:abandoned",
      schedule: { type: "daily", hourUTC: 2, minuteUTC: 45 },
      args: [{ olderThan: 30 * DAY_MS }],
    });
  });

  it("removes due finalized and abandoned rows during shutdown without sending mail", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network disabled"));
    try {
      const t = convexTest(schema, modules);
      registerResend(t);
      const component = components.resend;
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", { email: "admin@example.test" });
        await ctx.db.insert("ops_settings", {
          ownerId, singletonKey: "workspace", workspaceEnabled: false,
          cohortMode: "open", freeSignupsOpen: false,
          globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
          killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
          updatedAt: Date.now(),
        });
      });
      const cancelledId = await t.mutation(component.lib.createManualEmail, {
        from: "sender@example.test", to: "cancelled@example.test", subject: "Cancelled",
      });
      await t.mutation(component.lib.updateManualEmail, { emailId: cancelledId, status: "cancelled" });
      const queuedId = await t.mutation(component.lib.createManualEmail, {
        from: "sender@example.test", to: "queued@example.test", subject: "Queued",
      });

      vi.setSystemTime(START + 7 * DAY_MS);
      await t.mutation(internal.growth.email.cleanup.finalized, { olderThan: 7 * DAY_MS });
      expect(await t.query(component.lib.getStatus, { emailId: cancelledId })).not.toBeNull();
      vi.setSystemTime(START + 7 * DAY_MS + 1);
      await t.mutation(internal.growth.email.cleanup.finalized, { olderThan: 7 * DAY_MS });
      expect(await t.query(component.lib.getStatus, { emailId: cancelledId })).toBeNull();
      await t.mutation(internal.growth.email.cleanup.finalized, { olderThan: 7 * DAY_MS });
      expect((await t.query(component.lib.getStatus, { emailId: queuedId }))?.status).toBe("queued");

      vi.setSystemTime(START + 30 * DAY_MS);
      await t.mutation(internal.growth.email.cleanup.abandoned, { olderThan: 30 * DAY_MS });
      expect(await t.query(component.lib.getStatus, { emailId: queuedId })).not.toBeNull();
      vi.setSystemTime(START + 30 * DAY_MS + 1);
      await t.mutation(internal.growth.email.cleanup.abandoned, { olderThan: 30 * DAY_MS });
      expect(await t.query(component.lib.getStatus, { emailId: queuedId })).toBeNull();
      await t.mutation(internal.growth.email.cleanup.abandoned, { olderThan: 30 * DAY_MS });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
      vi.useRealTimers();
    }
  });
});
