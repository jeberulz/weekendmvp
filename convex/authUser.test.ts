/// <reference types="vite/client" />

import type { AuthProviderMaterializedConfig } from "@convex-dev/auth/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  AUTH_ACCOUNT_COLLISION_MESSAGE,
  createOrUpdateAuthUser,
  normalizeAuthEmail,
} from "./authUser";
import { safeAuthRedirect } from "./auth";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const googleProvider = {
  id: "google",
  type: "oidc",
} as AuthProviderMaterializedConfig;

const emailProvider = {
  id: "email",
  type: "email",
} as AuthProviderMaterializedConfig;

describe("Convex Auth user compatibility", () => {
  test("accepts both legacy-shaped and Convex Auth-shaped users", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const legacyId = await ctx.db.insert("users", {
        tokenIdentifier: "legacy|one",
        email: "legacy@example.test",
        displayName: "Legacy",
        stripeCustomerId: "customer_reference",
        createdAt: 1,
      });
      const authId = await ctx.db.insert("users", {
        name: "Auth user",
        email: "auth@example.test",
        emailVerificationTime: 2,
      });

      expect(await ctx.db.get("users", legacyId)).toMatchObject({
        tokenIdentifier: "legacy|one",
        displayName: "Legacy",
      });
      expect(await ctx.db.get("users", authId)).toMatchObject({
        name: "Auth user",
        emailVerificationTime: 2,
      });
    });
  });

  test("normalizes new auth email ownership", () => {
    expect(normalizeAuthEmail("  USER@Example.TEST ")).toBe(
      "user@example.test",
    );
  });

  test("denies implicit linking in both provider orders", async () => {
    for (const [first, second] of [
      [googleProvider, emailProvider],
      [emailProvider, googleProvider],
    ] as const) {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        await createOrUpdateAuthUser(ctx, {
          existingUserId: null,
          type: first.type === "email" ? "email" : "oauth",
          provider: first,
          profile: { email: "same@example.test", emailVerified: true },
        });

        await expect(
          createOrUpdateAuthUser(ctx, {
            existingUserId: null,
            type: second.type === "email" ? "email" : "oauth",
            provider: second,
            profile: { email: "same@example.test", emailVerified: true },
          }),
        ).rejects.toThrow(AUTH_ACCOUNT_COLLISION_MESSAGE);
      });
    }
  });

  test("updates only the already-linked user and preserves legacy fields", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "owner@example.test",
        tokenIdentifier: "legacy|owner",
        createdAt: 10,
      });

      const result = await createOrUpdateAuthUser(ctx, {
        existingUserId: userId,
        type: "verification",
        provider: emailProvider,
        profile: { email: "OWNER@example.test", emailVerified: true },
      });
      const user = await ctx.db.get("users", userId);

      expect(result).toBe(userId);
      expect(user).toMatchObject({
        email: "owner@example.test",
        tokenIdentifier: "legacy|owner",
        createdAt: 10,
      });
      expect(user?.emailVerificationTime).toEqual(expect.any(Number));
    });
  });
});

describe("server-derived current-user contract", () => {
  test("deterministically denies an anonymous caller", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.currentUser.requireCurrent, {})).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });

  test("resolves the Convex Auth user ID without accepting a caller ID", async () => {
    const t = convexTest(schema, modules);
    let userId!: Id<"users">;
    let sessionId!: Id<"authSessions">;
    await t.run(async (ctx) => {
      userId = await ctx.db.insert("users", {
        email: "current@example.test",
        name: "Current",
      });
      sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: 1,
      });
    });

    const result = await t
      .withIdentity({
        subject: `${userId}|${sessionId}`,
        issuer: "https://local.test",
        tokenIdentifier: "https://local.test|token_reference",
      })
      .query(api.currentUser.requireCurrent, {});

    expect(result).toEqual({
      id: userId,
      email: "current@example.test",
      name: "Current",
      image: undefined,
    });
  });

  test("denies an identity whose referenced session was deleted", async () => {
    const t = convexTest(schema, modules);
    let userId!: Id<"users">;
    let sessionId!: Id<"authSessions">;
    await t.run(async (ctx) => {
      userId = await ctx.db.insert("users", {
        email: "signed-out@example.test",
      });
      sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: 1,
      });
      await ctx.db.delete("authSessions", sessionId);
    });

    await expect(
      t
        .withIdentity({
          subject: `${userId}|${sessionId}`,
          issuer: "https://local.test",
          tokenIdentifier: "https://local.test|deleted_session_reference",
        })
        .query(api.currentUser.requireCurrent, {}),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  test("denies a session that belongs to a different user", async () => {
    const t = convexTest(schema, modules);
    let userId!: Id<"users">;
    let sessionId!: Id<"authSessions">;
    await t.run(async (ctx) => {
      userId = await ctx.db.insert("users", {
        email: "identity@example.test",
      });
      const sessionOwnerId = await ctx.db.insert("users", {
        email: "session-owner@example.test",
      });
      sessionId = await ctx.db.insert("authSessions", {
        userId: sessionOwnerId,
        expirationTime: 1,
      });
    });

    await expect(
      t
        .withIdentity({
          subject: `${userId}|${sessionId}`,
          issuer: "https://local.test",
          tokenIdentifier: "https://local.test|wrong_owner_reference",
        })
        .query(api.currentUser.requireCurrent, {}),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  test("denies an anonymous Convex Auth user document", async () => {
    const t = convexTest(schema, modules);
    let userId!: Id<"users">;
    let sessionId!: Id<"authSessions">;
    await t.run(async (ctx) => {
      userId = await ctx.db.insert("users", { isAnonymous: true });
      sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: 1,
      });
    });

    await expect(
      t
        .withIdentity({
          subject: `${userId}|${sessionId}`,
          issuer: "https://local.test",
          tokenIdentifier: "https://local.test|anonymous_reference",
        })
        .query(api.currentUser.requireCurrent, {}),
    ).rejects.toThrow("UNAUTHENTICATED");
  });
});

describe("server redirect contract", () => {
  test.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/project?tab=build", "/dashboard/project?tab=build"],
    ["https://evil.example/dashboard", "/dashboard"],
    ["//evil.example/dashboard", "/dashboard"],
    ["/signin", "/dashboard"],
  ])("allowlists %s", (target, expected) => {
    expect(safeAuthRedirect(target)).toBe(expected);
  });
});
