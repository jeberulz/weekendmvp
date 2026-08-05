/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import clientProviderSource from "../../app/AuthConvexClientProvider.tsx?raw";
import providerSource from "../../app/AuthPlatformProvider.tsx?raw";
import signInPageSource from "../../app/signin/page.tsx?raw";

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

  test("keeps the signin searchParams route explicitly non-instant", () => {
    expect(signInPageSource).toContain("export const instant = false");
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
});
