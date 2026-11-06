/**
 * Proxy-aware source transport: fake-IP DNS (198.18.0.0/15) stays blocked on
 * the direct path; a validated HTTPS_PROXY enables via_proxy destination mode
 * without blanket private/benchmark allow.
 */

import { describe, expect, it } from "vitest";

import {
  assertDestinationUrl,
  assertPublicUrl,
  assertSafeProxyUrl,
  configuredProxyUrl,
  createDefaultSourceFetch,
  createProxiedFetch,
  createSourceTextProvider,
  isBenchmarkFakeIp,
  SourceFetchError,
} from "./sourceText.ts";

describe("fake-IP / benchmark DNS", () => {
  it("flags 198.18.0.0/15", () => {
    expect(isBenchmarkFakeIp("198.18.0.1")).toBe(true);
    expect(isBenchmarkFakeIp("198.19.255.255")).toBe(true);
    expect(isBenchmarkFakeIp("198.17.0.1")).toBe(false);
    expect(isBenchmarkFakeIp("93.184.215.14")).toBe(false);
  });

  it("refuses destinations that resolve to fake-IP on the direct path with a proxy hint", async () => {
    await expect(
      assertPublicUrl("https://clockify.me/", async () => ["198.18.0.1"]),
    ).rejects.toMatchObject({
      code: "blocked_address",
      message: expect.stringMatching(/198\.18\.0\.0\/15.*(HTTPS_PROXY|ENGINE_HTTPS_PROXY)/),
    });
  });

  it("via_proxy skips destination DNS public checks for hostnames", async () => {
    let resolved = 0;
    await expect(
      assertDestinationUrl(
        "https://clockify.me/pricing",
        async () => {
          resolved += 1;
          return ["198.18.0.1"];
        },
        undefined,
        "via_proxy",
      ),
    ).resolves.toBeUndefined();
    expect(resolved).toBe(0);
  });

  it("via_proxy still refuses localhost and metadata IP literals", async () => {
    await expect(
      assertDestinationUrl("http://localhost/x", async () => ["93.184.215.14"], undefined, "via_proxy"),
    ).rejects.toMatchObject({ code: "blocked_address" });
    await expect(
      assertDestinationUrl(
        "http://169.254.169.254/latest/meta-data/",
        async () => ["93.184.215.14"],
        undefined,
        "via_proxy",
      ),
    ).rejects.toMatchObject({ code: "blocked_address" });
    await expect(
      assertDestinationUrl("http://198.18.0.1/", async () => ["93.184.215.14"], undefined, "via_proxy"),
    ).rejects.toMatchObject({ code: "blocked_address" });
  });
});

describe("configured proxy URL", () => {
  it("reads ENGINE_HTTPS_PROXY before HTTPS_PROXY", () => {
    expect(
      configuredProxyUrl({
        ENGINE_HTTPS_PROXY: "http://127.0.0.1:7890",
        HTTPS_PROXY: "http://127.0.0.1:9999",
      }),
    ).toBe("http://127.0.0.1:7890");
    expect(configuredProxyUrl({ HTTPS_PROXY: "http://10.0.0.2:8080" })).toBe("http://10.0.0.2:8080");
    expect(configuredProxyUrl({})).toBeNull();
  });

  it("allows private/loopback proxy hosts and refuses metadata", () => {
    expect(assertSafeProxyUrl("http://127.0.0.1:7890").href).toBe("http://127.0.0.1:7890/");
    expect(assertSafeProxyUrl("http://10.8.0.1:8888").hostname).toBe("10.8.0.1");
    expect(() => assertSafeProxyUrl("http://169.254.169.254:80")).toThrow(SourceFetchError);
    expect(() => assertSafeProxyUrl("socks5://127.0.0.1:1080")).toThrow(/non-http proxy/);
    expect(() => assertSafeProxyUrl("http://metadata.google.internal/")).toThrow(/metadata/);
  });

  it("createDefaultSourceFetch selects via_proxy only when a proxy is configured", () => {
    const direct = createDefaultSourceFetch({ proxyUrl: null });
    expect(direct.destinationMode).toBe("direct");
    expect(direct.proxyUrl).toBeNull();

    const proxied = createDefaultSourceFetch({ proxyUrl: "http://127.0.0.1:7890" });
    expect(proxied.destinationMode).toBe("via_proxy");
    expect(proxied.proxyUrl).toBe("http://127.0.0.1:7890/");
  });
});

describe("provider destinationMode with injected fetch", () => {
  it("keeps direct SSRF when fetchImpl is injected even if proxyUrl is set", async () => {
    let fetched = 0;
    const provider = createSourceTextProvider({
      proxyUrl: "http://127.0.0.1:7890",
      fetchImpl: async () => {
        fetched += 1;
        return new Response("secret", { status: 200 });
      },
      resolveHost: async () => ["198.18.0.1"],
    });
    await expect(provider.fetchText("https://printavo.com/")).rejects.toThrow(/198\.18\.0\.0\/15/);
    expect(fetched).toBe(0);
  });

  it("via_proxy + injected fetch skips fake-IP DNS and still blocks metadata redirects", async () => {
    const calls: string[] = [];
    const provider = createSourceTextProvider({
      destinationMode: "via_proxy",
      resolveHost: async () => ["198.18.0.1"],
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.includes("clockify")) {
          return new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254/latest/meta-data/" },
          });
        }
        return new Response("ok", { status: 200 });
      },
    });
    await expect(provider.fetchText("https://clockify.me/pricing")).rejects.toThrow(/non-public/);
    expect(calls).toEqual(["https://clockify.me/pricing"]);
  });

  it("via_proxy fetches through an injected hop when DNS is fake-IP", async () => {
    const provider = createSourceTextProvider({
      destinationMode: "via_proxy",
      resolveHost: async () => ["198.18.0.1"],
      fetchImpl: async () => new Response("<p>pricing page</p>", { status: 200 }),
    });
    expect((await provider.fetchText("https://clockify.me/pricing")).trim()).toBe("pricing page");
  });
});

describe("createProxiedFetch SSRF", () => {
  it("refuses metadata and loopback IP literals before contacting the proxy", async () => {
    // Port 9 is discard; we must fail in transportTarget, not on ECONNREFUSED.
    const fetchImpl = createProxiedFetch("http://127.0.0.1:9");
    await expect(fetchImpl("http://169.254.169.254/latest/meta-data/")).rejects.toMatchObject({
      code: "blocked_address",
    });
    await expect(fetchImpl("http://127.0.0.1/")).rejects.toMatchObject({
      code: "blocked_address",
    });
    await expect(fetchImpl("http://198.18.0.1/")).rejects.toMatchObject({
      code: "blocked_address",
    });
  });
});
