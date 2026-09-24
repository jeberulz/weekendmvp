/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import clientProviderSource from "../../app/AuthConvexClientProvider.tsx?raw";
import providerSource from "../../app/AuthPlatformProvider.tsx?raw";
import loginPageSource from "../../app/login/page.tsx?raw";
import signupPageSource from "../../app/signup/page.tsx?raw";
import signInPageSource from "../../app/signin/page.tsx?raw";
import authCardSource from "../../components/auth/AuthCard.tsx?raw";
import megaNavSource from "../../components/layout/MegaNav.tsx?raw";
import mobileNavSource from "../../components/layout/MobileNav.tsx?raw";
import navAuthSource from "../../components/layout/NavAuthLinks.tsx?raw";

describe("auth platform request-time boundary", () => {
  test("awaits a request before rendering the third-party auth provider", () => {
    const connectionBoundary = providerSource.indexOf("await connection()");
    const thirdPartyProvider = providerSource.indexOf(
      "<ConvexAuthNextjsServerProvider>",
    );

    expect(connectionBoundary).toBeGreaterThan(-1);
    expect(thirdPartyProvider).toBeGreaterThan(connectionBoundary);
    expect(providerSource).toContain(
      "<Suspense fallback={<AuthPlatformFallback />}>",
    );
  });

  test("keeps login and signup searchParams routes explicitly non-instant", () => {
    expect(loginPageSource).toContain("export const instant = false");
    expect(signupPageSource).toContain("export const instant = false");
  });

  test("aliases /signin to /login while forwarding claimPreview", () => {
    expect(signInPageSource).toContain('redirect(query ? `/login?${query}` : "/login")');
    expect(signInPageSource).toContain('qs.set("claimPreview", claimPreview)');
  });

  test("keeps one browser auth client alive across React effect replays", () => {
    expect(clientProviderSource).toContain(
      "__weekendMvpAuthConvexClient?: ConvexReactClient",
    );
    expect(clientProviderSource).toContain(
      "browserClientCache.__weekendMvpAuthConvexClient = client",
    );
    expect(clientProviderSource).not.toContain("client.close(");
  });

  test("does not construct the browser client from a malformed endpoint", () => {
    const validation = clientProviderSource.indexOf(
      "if (!isValidPlatformConvexUrl(url)) return null",
    );
    const construction = clientProviderSource.indexOf(
      "new ConvexReactClient(url)",
    );
    expect(validation).toBeGreaterThan(-1);
    expect(construction).toBeGreaterThan(validation);
  });
});

describe("free auth UI contract", () => {
  test("auth card exposes Google + one-time email path without passwords", () => {
    expect(authCardSource).toContain("Continue with Google");
    expect(authCardSource).toContain("Send One-Time Code");
    expect(authCardSource).toContain("Welcome back!");
    expect(authCardSource).toContain('signIn("google"');
    expect(authCardSource).toContain('signIn("email"');
    expect(authCardSource).toContain("Enter your email");
    expect(authCardSource).not.toMatch(/type=["']password["']/);
    expect(authCardSource).not.toMatch(/signIn\(["']credentials["']/);
    expect(authCardSource).not.toMatch(/Sign in with Password/i);
  });

  test("login and signup pages use the shared auth shell with MegaNav", () => {
    expect(loginPageSource).toContain("<AuthPageShell>");
    expect(signupPageSource).toContain("<AuthPageShell>");
    expect(authCardSource).toContain("Welcome back!");
    expect(authCardSource).toContain("<Logo");
    expect(authCardSource).not.toMatch(/Sign in with Password/i);
  });

  test("login and signup pages stash claimPreview with the server normalizer", () => {
    for (const source of [loginPageSource, signupPageSource]) {
      expect(source).toContain("normalizeCapabilityToken(");
      expect(source).toContain(
        "claimPreview !== null && <PreviewClaimStash token={claimPreview} continueTo={continueTo} />",
      );
      expect(source).not.toMatch(
        /returnTo[^\n]*claimPreview|claimPreview[^\n]*returnTo/,
      );
    }
  });

  test("mega and mobile nav expose Login + Sign Up for anonymous visitors", () => {
    expect(megaNavSource).toContain("<NavAuthLinks");
    expect(mobileNavSource).toContain("<NavAuthLinks");
    expect(navAuthSource).toContain('href="/login"');
    expect(navAuthSource).toContain('href="/signup"');
    expect(navAuthSource).toContain("Sign up");
    expect(navAuthSource).toMatch(/\bLogin\b/);
    expect(navAuthSource).toContain('href="/dashboard"');
  });
});
