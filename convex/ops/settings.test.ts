/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import {
  assertFeatureEnabled,
  assertFeatureEnabledForOwner,
  assertWorkspaceCohort,
  DEFAULT_OPS_SETTINGS,
  getOpsSettings,
} from "./settings";

const modules = import.meta.glob("/convex/**/*.ts");

describe("C-OPS defaults and cohort", () => {
  test("missing singleton disables every feature", async () => {
    const t = convexTest(schema, modules);
    await expect(t.run(getOpsSettings)).resolves.toEqual(DEFAULT_OPS_SETTINGS);
    const snapshot = await t.run(getOpsSettings);
    snapshot.workspaceEnabled = true;
    snapshot.killSwitches.ai = false;
    await expect(t.run(getOpsSettings)).resolves.toEqual(DEFAULT_OPS_SETTINGS);
    for (const feature of ["workspace", "freeSignups", "ai", "studioVideo", "publish", "email", "social", "ads"] as const) {
      await expect(t.run((ctx) => assertFeatureEnabled(ctx, feature)))
        .rejects.toThrow(feature === "ai" || feature === "studioVideo" ? "AI_DISABLED" : "WORKSPACE_DISABLED");
    }
  });

  test("allowlist limits enabled workspace to included owners", async () => {
    const t = convexTest(schema, modules);
    const { allowedId, blockedId, allowedSessionId, blockedSessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
      const allowedId = await ctx.db.insert("users", { email: "allowed@example.test" });
      const blockedId = await ctx.db.insert("users", { email: "blocked@example.test" });
      const allowedSessionId = await ctx.db.insert("authSessions", { userId: allowedId, expirationTime: 9_999_999_999_999 });
      const blockedSessionId = await ctx.db.insert("authSessions", { userId: blockedId, expirationTime: 9_999_999_999_999 });
      await ctx.db.insert("ops_settings", {
        ownerId: adminId,
        singletonKey: "workspace",
        workspaceEnabled: true,
        cohortMode: "allowlist",
        freeSignupsOpen: false,
        globalDailyBudgetMicroUsd: 50_000_000n,
        paidGlobalDailyBudgetMicroUsd: 0n,
        killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
        updatedAt: 1,
      });
      await ctx.db.insert("workspace_cohort", { ownerId: allowedId, addedBy: adminId, addedAt: 1 });
      return { allowedId, blockedId, allowedSessionId, blockedSessionId };
    });

    await expect(t.run((ctx) => assertWorkspaceCohort(ctx, allowedId))).resolves.toBeNull();
    await expect(t.run((ctx) => assertWorkspaceCohort(ctx, blockedId)))
      .rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(t.run((ctx) => assertFeatureEnabled(ctx, "ai"))).rejects.toThrow("AI_DISABLED");
    const allowed = t.withIdentity({ subject: `${allowedId}|${allowedSessionId}`, issuer: "https://local.test" });
    const blocked = t.withIdentity({ subject: `${blockedId}|${blockedSessionId}`, issuer: "https://local.test" });
    await expect(allowed.run((ctx) => assertFeatureEnabled(ctx, "workspace"))).resolves.toMatchObject({
      workspaceEnabled: true,
      cohortMode: "allowlist",
    });
    await expect(blocked.run((ctx) => assertFeatureEnabled(ctx, "workspace")))
      .rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(t.run((ctx) => assertFeatureEnabled(ctx, "workspace")))
      .rejects.toThrow("UNAUTHENTICATED");
  });

  test("only a bound super admin can operate the off-by-default control plane", async () => {
    const t = convexTest(schema, modules);
    const { adminId, adminSessionId, customerId, customerSessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
      const customerId = await ctx.db.insert("users", { email: "customer@example.test" });
      const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: 9_999_999_999_999 });
      const customerSessionId = await ctx.db.insert("authSessions", { userId: customerId, expirationTime: 9_999_999_999_999 });
      await ctx.db.insert("super_admins", { userId: adminId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap" });
      return { adminId, adminSessionId, customerId, customerSessionId };
    });
    const as = (userId: typeof adminId, sessionId: typeof adminSessionId) =>
      t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
    const admin = as(adminId, adminSessionId);
    const customer = as(customerId, customerSessionId);

    await expect(customer.query(api.ops.settings.readForAdmin, {})).rejects.toThrow("FORBIDDEN");
    await expect(customer.mutation(api.ops.settings.updateForAdmin, { workspaceEnabled: true }))
      .rejects.toThrow("FORBIDDEN");
    await expect(customer.mutation(api.ops.settings.setCohortMember, { ownerId: customerId, allowed: true }))
      .rejects.toThrow("FORBIDDEN");
    await expect(admin.query(api.ops.settings.readForAdmin, {})).resolves.toEqual(DEFAULT_OPS_SETTINGS);
    await expect(admin.mutation(api.ops.settings.updateForAdmin, { globalDailyBudgetMicroUsd: -1n }))
      .rejects.toThrow("INVALID_BUDGET");
    await expect(admin.mutation(api.ops.settings.updateForAdmin, { paidGlobalDailyBudgetMicroUsd: -1n }))
      .rejects.toThrow("INVALID_BUDGET");

    const enabled = await admin.mutation(api.ops.settings.updateForAdmin, { workspaceEnabled: true });
    expect(enabled.workspaceEnabled).toBe(true);
    expect(enabled.killSwitches).toEqual(DEFAULT_OPS_SETTINGS.killSwitches);
    await expect(t.run((ctx) => assertFeatureEnabled(ctx, "ai"))).rejects.toThrow("AI_DISABLED");
    expect(await admin.mutation(api.ops.settings.setCohortMember, { ownerId: customerId, allowed: true }))
      .toEqual({ allowed: true, changed: true });
    expect(await admin.mutation(api.ops.settings.setCohortMember, { ownerId: customerId, allowed: true }))
      .toEqual({ allowed: true, changed: false });
    await expect(t.run((ctx) => assertWorkspaceCohort(ctx, customerId))).resolves.toBeNull();
    expect(await admin.mutation(api.ops.settings.setCohortMember, { ownerId: customerId, allowed: false }))
      .toEqual({ allowed: false, changed: true });
    await expect(t.run((ctx) => assertWorkspaceCohort(ctx, customerId))).rejects.toThrow("RESOURCE_NOT_FOUND");
    await admin.mutation(api.ops.settings.updateForAdmin, { cohortMode: "open" });
    await expect(t.run((ctx) => assertWorkspaceCohort(ctx, customerId))).resolves.toBeNull();
    await admin.mutation(api.ops.settings.updateForAdmin, {
      globalDailyBudgetMicroUsd: 50_000_000n,
      paidGlobalDailyBudgetMicroUsd: 25_000_000n,
      killSwitches: { ai: false },
    });
    await expect(t.run((ctx) => assertFeatureEnabledForOwner(ctx, "ai", customerId))).resolves.toMatchObject({
      globalDailyBudgetMicroUsd: 50_000_000n,
      paidGlobalDailyBudgetMicroUsd: 25_000_000n,
    });
    await admin.mutation(api.ops.settings.updateForAdmin, { killSwitches: { studioVideo: false } });
    await expect(t.run((ctx) => assertFeatureEnabledForOwner(ctx, "studioVideo", customerId)))
      .resolves.toMatchObject({ workspaceEnabled: true });
    await admin.mutation(api.ops.settings.updateForAdmin, { killSwitches: { ai: true } });
    await expect(t.run((ctx) => assertFeatureEnabledForOwner(ctx, "studioVideo", customerId)))
      .rejects.toThrow("AI_DISABLED");
    await admin.mutation(api.ops.settings.updateForAdmin, {
      globalDailyBudgetMicroUsd: 0n,
      paidGlobalDailyBudgetMicroUsd: 25_000_000n,
      killSwitches: { ai: false },
    });
    await expect(t.run((ctx) => assertFeatureEnabledForOwner(ctx, "ai", customerId)))
      .resolves.toMatchObject({ paidGlobalDailyBudgetMicroUsd: 25_000_000n });
    await admin.mutation(api.ops.settings.updateForAdmin, { paidGlobalDailyBudgetMicroUsd: 0n });
    await expect(t.run((ctx) => assertFeatureEnabledForOwner(ctx, "ai", customerId)))
      .rejects.toThrow("AI_DISABLED");
    await admin.mutation(api.ops.settings.updateForAdmin, { killSwitches: { ai: true } });
    await expect(t.run((ctx) => assertFeatureEnabled(ctx, "ai"))).rejects.toThrow("AI_DISABLED");
    await admin.mutation(api.ops.settings.updateForAdmin, { workspaceEnabled: false });
    expect((await admin.query(api.ops.settings.readForAdmin, {})).workspaceEnabled).toBe(false);

    const audit = await t.run(async (ctx) => await ctx.db.query("audit_events").take(20));
    expect(audit.map((row) => row.action)).toEqual([
      "ops.settings.changed", "ops.cohort.added", "ops.cohort.removed",
      "ops.settings.changed", "ops.settings.changed", "ops.settings.changed", "ops.settings.changed",
      "ops.settings.changed", "ops.settings.changed", "ops.settings.changed", "ops.settings.changed",
    ]);
  });
});
