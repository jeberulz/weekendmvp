/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../schema";
import { checkLimit } from "./limits";

const modules = import.meta.glob("/convex/**/*.ts");

describe("WP70 workspace rate limits", () => {
  test("a named owner limit is gated and refuses the fourth wizard start", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const ownerId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
      const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
      await ctx.db.insert("ops_settings", {
        ownerId: adminId, singletonKey: "workspace", workspaceEnabled: false,
        cohortMode: "open", freeSignupsOpen: false,
        globalDailyBudgetMicroUsd: 1_000_000n, paidGlobalDailyBudgetMicroUsd: 0n,
        killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
        updatedAt: Date.now(),
      });
      return ownerId;
    });
    await expect(t.run((ctx) => checkLimit(ctx, "wizardStart", ownerId))).rejects.toThrow("AI_DISABLED");
    await t.run(async (ctx) => {
      const row = await ctx.db.query("ops_settings").unique();
      if (row) await ctx.db.patch("ops_settings", row._id, { workspaceEnabled: true });
    });
    await expect(t.run((ctx) => checkLimit(ctx, "studioVideo", ownerId))).rejects.toThrow("AI_DISABLED");
    await expect(t.run((ctx) => checkLimit(ctx, "publish", ownerId))).rejects.toThrow("WORKSPACE_DISABLED");
    for (let i = 0; i < 3; i += 1) await t.run((ctx) => checkLimit(ctx, "wizardStart", ownerId));
    await expect(t.run((ctx) => checkLimit(ctx, "wizardStart", ownerId))).rejects.toThrow();
    for (let i = 0; i < 40; i += 1) await t.run((ctx) => checkLimit(ctx, "wrenMessage", ownerId));
    await expect(t.run((ctx) => checkLimit(ctx, "wrenMessage", ownerId))).rejects.toThrow();
  });
});
