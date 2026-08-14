/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  deliverResendMagicLink,
  EMAIL_MAGIC_LINK_MAX_AGE_SECONDS,
  emailMagicLinkProvider,
  MAGIC_LINK_DELIVERY_ERROR,
  normalizeMagicLinkEmail,
  type ResendEmailPayload,
  createResendMagicLinkEmail,
} from "./resendMagicLink";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const siteUrl = "https://app.example.test";
const sender = "Weekend MVP <auth@example.test>";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("custom Email provider and Resend payload", () => {
  test("uses the custom email provider with a bounded one-hour expiry", () => {
    expect(emailMagicLinkProvider.id).toBe("email");
    expect(emailMagicLinkProvider.type).toBe("email");
    expect(emailMagicLinkProvider.maxAge).toBe(
      EMAIL_MAGIC_LINK_MAX_AGE_SECONDS,
    );
    expect(emailMagicLinkProvider.authorize).toBeTypeOf("function");
  });

  test("normalizes identifiers with NFKC, trimming, and lowercase", () => {
    expect(normalizeMagicLinkEmail("  ＵＳＥＲ@ＥＸＡＭＰＬＥ.ＴＥＳＴ  ")).toBe(
      "user@example.test",
    );
    expect(
      emailMagicLinkProvider.options?.normalizeIdentifier?.(
        " USER@Example.TEST ",
      ),
    ).toBe("user@example.test");
  });

  test("builds a confirmation link without a code parameter", () => {
    const { link, payload } = createResendMagicLinkEmail({
      identifier: " O'HARA@EXAMPLE.TEST ",
      token: "opaque-test-token",
      verificationUrl:
        "https://app.example.test/dashboard/project?tab=build&code=opaque-test-token",
      siteUrl,
      from: sender,
    });
    const confirmation = new URL(link);

    expect(confirmation.origin).toBe(siteUrl);
    expect(confirmation.pathname).toBe("/email-signin");
    expect(confirmation.searchParams.get("token")).toBe("opaque-test-token");
    expect(confirmation.searchParams.get("email")).toBe(
      "o'hara@example.test",
    );
    expect(confirmation.searchParams.get("returnTo")).toBe(
      "/dashboard/project?tab=build",
    );
    expect(confirmation.searchParams.has("code")).toBe(false);
    expect(payload).toMatchObject({
      from: sender,
      to: "o'hara@example.test",
      subject: "Confirm your Weekend MVP sign in",
    });
    expect(payload.text).toContain(link);
    expect(payload.html).toContain("o&#39;hara@example.test");
    expect(payload.html).not.toContain("O'HARA@EXAMPLE.TEST");
  });

  test("collapses unapproved and cross-origin return targets", () => {
    expect(
      new URL(
        createResendMagicLinkEmail({
          identifier: "user@example.test",
          token: "opaque-test-token",
          verificationUrl:
            "https://app.example.test/signin?code=opaque-test-token",
          siteUrl,
          from: sender,
        }).link,
      ).searchParams.get("returnTo"),
    ).toBe("/dashboard");

    expect(() =>
      createResendMagicLinkEmail({
        identifier: "user@example.test",
        token: "opaque-test-token",
        verificationUrl:
          "https://evil.example/dashboard?code=opaque-test-token",
        siteUrl,
        from: sender,
      }),
    ).toThrow(MAGIC_LINK_DELIVERY_ERROR);
  });

  test("requires HTTPS except for intentional loopback development", () => {
    expect(
      createResendMagicLinkEmail({
        identifier: "user@example.test",
        token: "opaque-test-token",
        verificationUrl:
          "http://localhost:3000/dashboard?code=opaque-test-token",
        siteUrl: "http://localhost:3000",
        from: sender,
      }).link,
    ).toMatch(/^http:\/\/localhost:3000\/email-signin\?/u);

    expect(() =>
      createResendMagicLinkEmail({
        identifier: "user@example.test",
        token: "opaque-test-token",
        verificationUrl:
          "http://app.example.test/dashboard?code=opaque-test-token",
        siteUrl: "http://app.example.test",
        from: sender,
      }),
    ).toThrow(MAGIC_LINK_DELIVERY_ERROR);
  });

  test("posts escaped HTML and text to Resend without reading error bodies", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 202 }));
    await deliverResendMagicLink(
      {
        identifier: "user@example.test",
        token: "opaque-test-token",
        verificationUrl:
          "https://app.example.test/dashboard?code=opaque-test-token",
      },
      {
        env: {
          AUTH_RESEND_KEY: "unit-test-key",
          AUTH_RESEND_FROM: sender,
          SITE_URL: siteUrl,
        },
        fetch: fetchMock,
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer unit-test-key",
        "Content-Type": "application/json",
      },
    });
    const payload = JSON.parse(String(init?.body)) as ResendEmailPayload;
    expect(payload.html).toContain("Review and sign in");
    expect(payload.text).toContain("can be used once");
  });

  test("returns one generic failure for missing config and provider errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("provider details must stay private", { status: 400 }),
      );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const args = {
      identifier: "user@example.test",
      token: "opaque-test-token",
      verificationUrl:
        "https://app.example.test/dashboard?code=opaque-test-token",
    };

    await expect(
      deliverResendMagicLink(args, {
        env: { AUTH_RESEND_FROM: sender, SITE_URL: siteUrl },
        fetch: fetchMock,
      }),
    ).rejects.toThrow(MAGIC_LINK_DELIVERY_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      deliverResendMagicLink(args, {
        env: {
          AUTH_RESEND_KEY: "unit-test-key",
          AUTH_RESEND_FROM: sender,
          SITE_URL: siteUrl,
        },
        fetch: fetchMock,
      }),
    ).rejects.toThrow(MAGIC_LINK_DELIVERY_ERROR);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test("rejects the shared Resend demo sender", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 202 }));
    await expect(
      deliverResendMagicLink(
        {
          identifier: "user@example.test",
          token: "opaque-test-token",
          verificationUrl:
            "https://app.example.test/dashboard?code=opaque-test-token",
        },
        {
          env: {
            AUTH_RESEND_KEY: "unit-test-key",
            AUTH_RESEND_FROM: "Demo <onboarding@resend.dev>",
            SITE_URL: siteUrl,
          },
          fetch: fetchMock,
        },
      ),
    ).rejects.toThrow(MAGIC_LINK_DELIVERY_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("installed Convex Auth email token lifecycle", () => {
  test("canonicalizes the public action before creating an auth account", async () => {
    const deliveredLinks: string[] = [];
    configureIsolatedDelivery(deliveredLinks);
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.auth.signIn, {
        provider: "email",
        params: {
          email: "  ＶＡＲＩＡＮＴ@ＥＸＡＭＰＬＥ.ＴＥＳＴ  ",
          redirectTo: "/dashboard",
        },
      }),
    ).resolves.toEqual({ started: true });
    await expect(
      t.action(api.auth.signIn, {
        provider: "email",
        params: {
          email: "variant@example.test",
          redirectTo: "/dashboard",
        },
      }),
    ).resolves.toEqual({ started: true });

    await t.run(async (ctx) => {
      const accounts = await ctx.db.query("authAccounts").collect();
      const users = await ctx.db.query("users").collect();
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        provider: "email",
        providerAccountId: "variant@example.test",
      });
      expect(users).toHaveLength(1);
      expect(users[0]?.email).toBeUndefined();
    });
  });

  test("returns started for an email already owned by Google", async () => {
    const deliveredLinks: string[] = [];
    configureIsolatedDelivery(deliveredLinks);
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const googleUserId = await ctx.db.insert("users", {
        email: "shared@example.test",
        emailVerificationTime: Date.now(),
      });
      await ctx.db.insert("authAccounts", {
        userId: googleUserId,
        provider: "google",
        providerAccountId: "google-subject-reference",
      });
    });

    await expect(
      t.action(api.auth.signIn, {
        provider: "email",
        params: {
          email: " SHARED@EXAMPLE.TEST ",
          redirectTo: "/dashboard",
        },
      }),
    ).resolves.toEqual({ started: true });

    await t.run(async (ctx) => {
      const emailAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (query) =>
          query
            .eq("provider", "email")
            .eq("providerAccountId", "shared@example.test"),
        )
        .unique();
      expect(emailAccount).not.toBeNull();
      expect((await ctx.db.get("users", emailAccount!.userId))?.email).toBe(
        undefined,
      );
    });
  });

  test("retries a failed delivery without collision or a second identity", async () => {
    vi.stubEnv("SITE_URL", siteUrl);
    vi.stubEnv("AUTH_RESEND_KEY", "unit-test-key");
    vi.stubEnv("AUTH_RESEND_FROM", sender);
    vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("provider details stay private", { status: 400 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    const args = {
      provider: "email",
      params: {
        email: " Retry@Example.TEST ",
        redirectTo: "/dashboard",
      },
    };

    await expect(t.action(api.auth.signIn, args)).rejects.toThrow(
      MAGIC_LINK_DELIVERY_ERROR,
    );
    await expect(t.action(api.auth.signIn, args)).resolves.toEqual({
      started: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await t.run(async (ctx) => {
      const accounts = await ctx.db.query("authAccounts").collect();
      const users = await ctx.db.query("users").collect();
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.providerAccountId).toBe("retry@example.test");
      expect(users).toHaveLength(1);
      expect(users[0]?.email).toBeUndefined();
    });
  });

  test("issues, verifies once, and rejects replay without a real send", async () => {
    const deliveredLinks: string[] = [];
    configureIsolatedDelivery(deliveredLinks);
    const t = convexTest(schema, modules);
    const requestedEmail = "  ＦＬＯＷ@ＥＸＡＭＰＬＥ.ＴＥＳＴ  ";
    const email = "flow@example.test";

    const issue = await t.action(api.auth.signIn, {
      provider: "email",
      params: {
        email: requestedEmail,
        redirectTo: "/dashboard/project?tab=build",
      },
    });
    expect(issue).toEqual({ started: true });
    const confirmation = new URL(deliveredLinks[0]);
    const token = confirmation.searchParams.get("token");
    expect(token).not.toBeNull();
    expect(confirmation.searchParams.get("email")).toBe(email);
    expect(confirmation.searchParams.has("code")).toBe(false);

    const verifyArgs = {
      args: {
        type: "verifyCodeAndSignIn" as const,
        params: { code: token, email },
        provider: "email",
        generateTokens: false,
        allowExtraProviders: false,
      },
    };
    await expect(
      t.mutation(internal.auth.store, {
        args: {
          ...verifyArgs.args,
          params: { code: token, email: "different@example.test" },
        },
      }),
    ).rejects.toThrow("Unable to verify sign-in.");
    const verified = await t.mutation(internal.auth.store, verifyArgs);
    expect(verified).toMatchObject({ tokens: null });
    await t.run(async (ctx) => {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (query) =>
          query.eq("provider", "email").eq("providerAccountId", email),
        )
        .unique();
      expect(account).not.toBeNull();
      expect(await ctx.db.get("users", account!.userId)).toMatchObject({
        email,
        emailVerificationTime: expect.any(Number),
      });
    });
    await expect(t.mutation(internal.auth.store, verifyArgs)).resolves.toBeNull();
  });

  test("deletes and rejects an expired issued token", async () => {
    const deliveredLinks: string[] = [];
    configureIsolatedDelivery(deliveredLinks);
    const t = convexTest(schema, modules);
    const email = "expired@example.test";
    const issuedAt = Date.now();

    await t.action(api.auth.signIn, {
      provider: "email",
      params: { email, redirectTo: "/dashboard" },
    });
    const confirmation = new URL(deliveredLinks[0]);
    const token = confirmation.searchParams.get("token");
    expect(token).not.toBeNull();

    await t.run(async (ctx) => {
      const issued = await ctx.db.query("authVerificationCodes").unique();
      expect(issued).not.toBeNull();
      expect(issued!.expirationTime).toBeGreaterThanOrEqual(
        issuedAt + EMAIL_MAGIC_LINK_MAX_AGE_SECONDS * 1000,
      );
      expect(issued!.expirationTime).toBeLessThanOrEqual(
        Date.now() + EMAIL_MAGIC_LINK_MAX_AGE_SECONDS * 1000,
      );
      await ctx.db.patch("authVerificationCodes", issued!._id, {
        expirationTime: 0,
      });
    });

    await expect(
      t.mutation(internal.auth.store, {
        args: {
          type: "verifyCodeAndSignIn",
          params: { code: token, email },
          provider: "email",
          generateTokens: false,
          allowExtraProviders: false,
        },
      }),
    ).resolves.toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("authVerificationCodes").unique()).toBeNull();
    });
  });
});

function configureIsolatedDelivery(deliveredLinks: string[]) {
  vi.stubEnv("SITE_URL", siteUrl);
  vi.stubEnv("AUTH_RESEND_KEY", "unit-test-key");
  vi.stubEnv("AUTH_RESEND_FROM", sender);
  vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.resend.com/emails");
      const payload = JSON.parse(String(init?.body)) as ResendEmailPayload;
      const link = payload.text
        .split("\n")
        .find((line) => line.startsWith(`${siteUrl}/email-signin?`));
      expect(link).toBeTypeOf("string");
      deliveredLinks.push(link!);
      return new Response(null, { status: 202 });
    }),
  );
}
