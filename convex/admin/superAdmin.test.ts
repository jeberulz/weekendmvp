/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { currentAccount, requireSuperAdmin } from "./superAdmin";

const modules = import.meta.glob("/convex/**/*.ts");

const OWNER_EMAIL = "owner@example.test";

type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

async function signedIn(
  t: TestConvex<typeof schema>,
  user: { email?: string; verified?: boolean; anonymous?: boolean; account?: boolean },
): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      ...(user.email ? { email: user.email } : {}),
      ...(user.verified === false ? {} : { emailVerificationTime: 1 }),
      ...(user.anonymous ? { isAnonymous: true } : {}),
    });
    if (user.account !== false) {
      await ctx.db.insert("authAccounts", { userId, provider: "email", providerAccountId: user.email ?? "anon" });
    }
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

function as(t: TestConvex<typeof schema>, member: Member) {
  return t.withIdentity({ subject: `${member.userId}|${member.sessionId}`, issuer: "https://convex.test" });
}

async function auditDetails(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => (await ctx.db.query("editorial_audit").take(50)).map((entry) => entry.detail));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bootstrap", () => {
  test("refuses, and records the refusal, while no owner email is configured", async () => {
    const t = convexTest(schema, modules);
    await signedIn(t, { email: OWNER_EMAIL });
    const result = await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
    expect(result).toEqual({ outcome: "refused", reason: "not_configured" });
    expect(await auditDetails(t)).toEqual(["Bootstrap refused: no owner email is configured for this deployment."]);
    expect(await t.run(async (ctx) => (await ctx.db.query("super_admins").take(5)).length)).toBe(0);
  });

  test("binds only a verified, signed-in account, and never echoes the email", async () => {
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", OWNER_EMAIL);
    for (const owner of [
      { email: undefined },
      { email: OWNER_EMAIL, verified: false },
      { email: OWNER_EMAIL, anonymous: true },
      { email: OWNER_EMAIL, account: false },
    ]) {
      const t = convexTest(schema, modules);
      await signedIn(t, owner);
      const result = await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
      expect(result).toEqual({ outcome: "refused", reason: "no_verified_account" });
      expect(JSON.stringify(await auditDetails(t))).not.toContain(OWNER_EMAIL);
    }
  });

  test("refuses an ambiguous email", async () => {
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", OWNER_EMAIL);
    const t = convexTest(schema, modules);
    await signedIn(t, { email: OWNER_EMAIL });
    await signedIn(t, { email: OWNER_EMAIL });
    expect(await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).toEqual({
      outcome: "refused",
      reason: "ambiguous_account",
    });
  });

  test("binds the normalised email's account once; repeating it changes nothing", async () => {
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", "  Owner@Example.TEST ");
    const t = convexTest(schema, modules);
    const owner = await signedIn(t, { email: OWNER_EMAIL });
    const first = await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
    expect(first.outcome).toBe("bound");
    const second = await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
    expect(second).toEqual({ outcome: "already_bound", boundAt: first.outcome === "bound" ? first.boundAt : -1 });
    const rows = await t.run(async (ctx) => await ctx.db.query("super_admins").take(5));
    expect(rows.map((row) => row.userId)).toEqual([owner.userId]);
    expect(await t.query(internal.admin.superAdmin.bindingStatus, {})).toEqual({
      configured: true,
      activeBindings: 1,
      boundAt: rows[0].boundAt,
    });
  });

  test("a second account cannot take the capability while one holds it", async () => {
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", OWNER_EMAIL);
    const t = convexTest(schema, modules);
    await signedIn(t, { email: OWNER_EMAIL });
    await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
    await signedIn(t, { email: "other@example.test" });
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", "other@example.test");
    expect(await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).toEqual({
      outcome: "refused",
      reason: "another_account_bound",
    });
  });
});

describe("authorization uses the bound user ID and the live session", () => {
  async function boundWorld() {
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", OWNER_EMAIL);
    const t = convexTest(schema, modules);
    const owner = await signedIn(t, { email: OWNER_EMAIL });
    const customer = await signedIn(t, { email: "customer@example.test" });
    await t.mutation(internal.admin.superAdmin.bootstrapOwner, {});
    return { t, owner, customer };
  }

  test("only the bound owner's session resolves to the capability", async () => {
    const { t, owner, customer } = await boundWorld();
    const resolve = (member: Member) => as(t, member).run(async (ctx) => (await currentAccount(ctx))?.binding !== null);
    expect(await resolve(owner)).toBe(true);
    expect(await resolve(customer)).toBe(false);
    expect(await t.run(async (ctx) => currentAccount(ctx))).toBeNull();
    await expect(as(t, customer).run(async (ctx) => requireSuperAdmin(ctx))).rejects.toThrow();
    await expect(t.run(async (ctx) => requireSuperAdmin(ctx))).rejects.toThrow();
  });

  test("forged and mismatched identities resolve to no account", async () => {
    const { t, owner, customer } = await boundWorld();
    const forged = [
      { subject: `${owner.userId}|${customer.sessionId}` },
      { subject: `${owner.userId}` },
      { subject: `not-an-id|${owner.sessionId}` },
      { subject: `${owner.userId}|not-a-session` },
    ];
    for (const identity of forged) {
      expect(await t.withIdentity(identity).run(async (ctx) => currentAccount(ctx)), identity.subject).toBeNull();
    }
  });

  test("a deleted or expired session ends access", async () => {
    const { t, owner } = await boundWorld();
    await t.run(async (ctx) => ctx.db.patch("authSessions", owner.sessionId, { expirationTime: 10 }));
    expect(await as(t, owner).run(async (ctx) => currentAccount(ctx, Date.now()))).toBeNull();
    await t.run(async (ctx) => ctx.db.delete("authSessions", owner.sessionId));
    expect(await as(t, owner).run(async (ctx) => currentAccount(ctx))).toBeNull();
  });

  test("changing the email neither moves nor duplicates the capability", async () => {
    const { t, owner, customer } = await boundWorld();
    await t.run(async (ctx) => ctx.db.patch("users", owner.userId, { email: "renamed@example.test" }));
    await t.run(async (ctx) => ctx.db.patch("users", customer.userId, { email: OWNER_EMAIL }));
    expect(await as(t, owner).run(async (ctx) => (await currentAccount(ctx))?.binding !== null)).toBe(true);
    expect(await as(t, customer).run(async (ctx) => (await currentAccount(ctx))?.binding ?? null)).toBeNull();
    expect((await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).outcome).toBe("refused");
  });

  test("revocation ends access, keeps the history, and needs a reason", async () => {
    const { t, owner } = await boundWorld();
    await expect(t.mutation(internal.admin.superAdmin.revokeSuperAdmin, { reason: "" })).rejects.toThrow();
    expect(await t.mutation(internal.admin.superAdmin.revokeSuperAdmin, { reason: "Rotating the owner account" })).toEqual({
      revoked: 1,
    });
    expect(await as(t, owner).run(async (ctx) => (await currentAccount(ctx))?.binding ?? null)).toBeNull();
    const rows = await t.run(async (ctx) => await ctx.db.query("super_admins").take(5));
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedReason).toBe("Rotating the owner account");
    expect(await auditDetails(t)).toContain("Super-admin capability revoked (1 active binding).");
    // Binding again is an explicit operator action and creates a new record.
    expect((await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).outcome).toBe("bound");
    expect(await t.run(async (ctx) => (await ctx.db.query("super_admins").take(5)).length)).toBe(2);
  });

  test("a long revoked history neither hides the active binding nor lets a second one in", async () => {
    const { t, owner, customer } = await boundWorld();
    await t.run(async (ctx) => {
      for (let index = 0; index < 60; index += 1) {
        await ctx.db.insert("super_admins", {
          userId: customer.userId,
          role: "super_admin",
          boundAt: index,
          boundVia: "deployment_bootstrap",
          revokedAt: index + 1,
          revokedReason: "History",
        });
      }
    });
    expect((await t.query(internal.admin.superAdmin.bindingStatus, {})).activeBindings).toBe(1);
    vi.stubEnv("SUPER_ADMIN_BOOTSTRAP_EMAIL", "customer@example.test");
    expect(await t.mutation(internal.admin.superAdmin.bootstrapOwner, {})).toEqual({
      outcome: "refused",
      reason: "another_account_bound",
    });
    expect(await t.mutation(internal.admin.superAdmin.revokeSuperAdmin, { reason: "Rotating the owner account" })).toEqual({
      revoked: 1,
    });
    expect(await as(t, owner).run(async (ctx) => (await currentAccount(ctx))?.binding ?? null)).toBeNull();
  });

  test("revocation still ends every binding when the data breaks the one-holder invariant", async () => {
    const { t, customer } = await boundWorld();
    await t.run(async (ctx) => {
      for (let index = 0; index < 11; index += 1) {
        await ctx.db.insert("super_admins", { userId: customer.userId, role: "super_admin", boundAt: index, boundVia: "deployment_bootstrap" });
      }
    });
    await expect(t.query(internal.admin.superAdmin.bindingStatus, {})).rejects.toThrow(/INVARIANT|Too many/);
    expect(await t.mutation(internal.admin.superAdmin.revokeSuperAdmin, { reason: "Emergency revocation" })).toEqual({
      revoked: 12,
    });
    expect((await t.query(internal.admin.superAdmin.bindingStatus, {})).activeBindings).toBe(0);
  });
});
