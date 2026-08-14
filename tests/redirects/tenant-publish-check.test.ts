import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WP28-S4. The middleware publish check.
 *
 * The property that matters most is what happens when the backend does *not*
 * answer cleanly. This lookup exists only to upgrade a soft 404 into a real
 * one; it is not an authorization boundary, because `app/site/[slug]/page.tsx`
 * independently refuses to render an unpublished site. So every ambiguous
 * outcome must return `null` ("unknown"), and only an explicit `false` may
 * ever produce a 404. Anything else would let one Convex blip take every
 * customer site offline at once.
 *
 * The module reads `NEXT_PUBLIC_CONVEX_URL` at import time, so each case
 * resets the module registry and re-imports.
 */

const CONVEX_URL = "https://example-convex.test";

async function loadModule(url: string | undefined) {
  vi.resetModules();
  if (url === undefined) {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  } else {
    process.env.NEXT_PUBLIC_CONVEX_URL = url;
  }
  return await import("../../lib/tenant-publish-check");
}

const jsonResponse = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "content-type": "application/json" },
  });

let originalUrl: string | undefined;

beforeEach(() => {
  originalUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalUrl === undefined) {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  } else {
    process.env.NEXT_PUBLIC_CONVEX_URL = originalUrl;
  }
});

describe("checkTenantSitePublished", () => {
  it("reports a published host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "success", value: true })),
    );
    const { checkTenantSitePublished } = await loadModule(CONVEX_URL);
    expect(await checkTenantSitePublished("acme.weekendmvp.app")).toBe(true);
  });

  it("reports an unpublished host, the only answer that can 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "success", value: false })),
    );
    const { checkTenantSitePublished } = await loadModule(CONVEX_URL);
    expect(await checkTenantSitePublished("draftco.weekendmvp.app")).toBe(false);
  });

  it("queries the boolean endpoint, not the full render spec", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ status: "success", value: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { checkTenantSitePublished } = await loadModule(CONVEX_URL);
    await checkTenantSitePublished("acme.weekendmvp.app");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${CONVEX_URL}/api/query`);
    const body = JSON.parse(String(init.body)) as { path: string; args: unknown };
    // Transferring the whole spec on every request would double the payload
    // for a yes/no question.
    expect(body.path).toBe("platform/sites/read:isPublished");
    expect(body.args).toEqual({ hostname: "acme.weekendmvp.app" });
  });

  it.each([
    ["no configured Convex URL", undefined, undefined],
    ["a non-OK response", CONVEX_URL, () => jsonResponse({}, false)],
    [
      "a Convex error payload",
      CONVEX_URL,
      () => jsonResponse({ status: "error", errorMessage: "boom" }),
    ],
    [
      "a non-boolean value",
      CONVEX_URL,
      () => jsonResponse({ status: "success", value: "yes" }),
    ],
    ["a malformed body", CONVEX_URL, () => new Response("not json")],
    [
      "a network failure",
      CONVEX_URL,
      () => {
        throw new Error("ECONNREFUSED");
      },
    ],
  ])("returns null (unknown) for %s", async (_label, url, impl) => {
    if (impl) vi.stubGlobal("fetch", vi.fn(async () => impl()));
    const { checkTenantSitePublished } = await loadModule(url);
    // Never `false`: only a definitive negative may take a site down.
    expect(await checkTenantSitePublished("acme.weekendmvp.app")).toBeNull();
  });

  it("does not call fetch at all without a configured URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { checkTenantSitePublished } = await loadModule(undefined);
    await checkTenantSitePublished("acme.weekendmvp.app");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds the tail with an abort signal", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeDefined();
      return jsonResponse({ status: "success", value: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { checkTenantSitePublished } = await loadModule(CONVEX_URL);
    await checkTenantSitePublished("acme.weekendmvp.app");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("treats an aborted request as unknown, not unpublished", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      }),
    );
    const { checkTenantSitePublished } = await loadModule(CONVEX_URL);
    // A slow backend must not read as "this site does not exist".
    expect(await checkTenantSitePublished("acme.weekendmvp.app")).toBeNull();
  });
});
