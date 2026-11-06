import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { tenantTakedownState, TENANT_TAKEDOWN_READY_KEY } from "../../../lib/tenant-takedown";

const configRead = vi.hoisted(() => vi.fn());
vi.mock("@vercel/global-config", () => ({
  createClient: () => ({ get: configRead }),
}));

const modules = import.meta.glob("/convex/**/*.ts");

async function seed(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const strangerId = await ctx.db.insert("users", { email: "stranger@example.test" });
    const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 60_000 });
    const strangerSessionId = await ctx.db.insert("authSessions", { userId: strangerId, expirationTime: Date.now() + 60_000 });
    await ctx.db.insert("super_admins", {
      userId: adminId,
      role: "super_admin",
      boundAt: Date.now(),
      boundVia: "deployment_bootstrap",
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      title: "HydroTrail",
      source: "own_idea",
      status: "draft",
      idempotencyKey: "wp78:takedown:test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId,
      projectId,
      status: "published",
      hostname: "hydrotrail.weekendmvp.app",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const documentId = await ctx.db.insert("documents", {
      ownerId,
      projectId,
      kind: "site_copy",
      format: "json",
      title: "HydroTrail landing",
      body: "{}",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("site_versions", {
      ownerId,
      projectId,
      siteConfigId,
      status: "published",
      version: 1n,
      documentId,
      createdAt: Date.now(),
      publishedAt: Date.now(),
    });
    await ctx.db.patch(siteConfigId, { currentVersionId: versionId });
    return { adminId, adminSessionId, strangerId, strangerSessionId, siteConfigId };
  });
}

function asUser(t: TestConvex<typeof schema>, userId: Id<"users">, sessionId: Id<"authSessions">) {
  return t.withIdentity({
    subject: `${userId}|${sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${userId}`,
  });
}

describe("WP78 super-admin takedown", () => {
  beforeEach(() => {
    vi.stubEnv("TENANT_GLOBAL_CONFIG_ID", "ecfg_test");
    vi.stubEnv("TENANT_GLOBAL_CONFIG_WRITE_TOKEN", "test-token");
    vi.stubEnv("TENANT_GLOBAL_CONFIG", "https://global-config.vercel.com/ecfg_test?token=read-test");
    configRead.mockReset().mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("stranger cannot make a Global Config write", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await expect(asUser(t, ids.strangerId, ids.strangerSessionId).action(
      api.platform.sites.takedown.takeDown,
      { siteConfigId: ids.siteConfigId, reason: "Security takedown" },
    )).rejects.toThrow("FORBIDDEN");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("expired super-admin session cannot make a Global Config write", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => await ctx.db.patch(ids.adminSessionId, {
      expirationTime: Date.now() - 1,
    }));
    await expect(asUser(t, ids.adminId, ids.adminSessionId).action(
      api.platform.sites.takedown.takeDown,
      { siteConfigId: ids.siteConfigId, reason: "Security takedown" },
    )).rejects.toThrow("FORBIDDEN");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("missing slug key is clear only when the ready sentinel is present", async () => {
    configRead.mockImplementation(async (key: string) =>
      key === TENANT_TAKEDOWN_READY_KEY ? true : undefined);
    expect(await tenantTakedownState("hydrotrail")).toBe("clear");
    configRead.mockResolvedValue(undefined);
    expect(await tenantTakedownState("hydrotrail")).toBe("unavailable");
    configRead.mockImplementation(async (key: string) =>
      key === TENANT_TAKEDOWN_READY_KEY ? true : true);
    expect(await tenantTakedownState("hydrotrail")).toBe("blocked");
    configRead.mockRejectedValue(new Error("offline"));
    expect(await tenantTakedownState("hydrotrail")).toBe("unavailable");
  });

  test("denylist write precedes one audited state change; retry is idempotent", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const admin = asUser(t, ids.adminId, ids.adminSessionId);
    const args = { siteConfigId: ids.siteConfigId, reason: "Security takedown" };
    expect(await t.query(api.platform.sites.read.isPublished, {
      hostname: "hydrotrail.weekendmvp.app",
    })).toBe(true);
    expect(await admin.action(api.platform.sites.takedown.takeDown, args)).toEqual({ changed: true });
    expect(await admin.action(api.platform.sites.takedown.takeDown, args)).toEqual({ changed: false });
    const result = await t.run(async (ctx) => ({
      site: await ctx.db.get(ids.siteConfigId),
      events: await ctx.db.query("audit_events").collect(),
    }));
    expect(result.site?.takedownAt).toBeTypeOf("number");
    expect(result.site?.currentVersionId).toBeUndefined();
    expect(result.events.filter((event) => event.action === "site.taken_down")).toHaveLength(1);
    expect(await t.query(api.platform.sites.read.isPublished, {
      hostname: "hydrotrail.weekendmvp.app",
    })).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("unverified denylist write leaves Convex unchanged and can be retried", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const admin = asUser(t, ids.adminId, ids.adminSessionId);
    configRead.mockResolvedValueOnce(undefined);
    await expect(admin.action(api.platform.sites.takedown.takeDown, {
      siteConfigId: ids.siteConfigId, reason: "Security takedown",
    })).rejects.toThrow("TAKEDOWN_DENYLIST_UNAVAILABLE");
    const site = await t.run(async (ctx) => await ctx.db.get(ids.siteConfigId));
    expect(site?.takedownAt).toBeUndefined();
  });
});
