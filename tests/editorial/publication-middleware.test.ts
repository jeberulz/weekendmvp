import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

const { publication } = vi.hoisted(() => ({ publication: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: publication }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsMiddleware: (handler: (...args: unknown[]) => unknown) =>
    (request: unknown) => handler(request, { convexAuth: {} }),
}));

import { config, middleware } from "../../middleware";

const event = { waitUntil() {}, passThroughOnException() {} } as unknown as NextFetchEvent;

describe("request-time editorial takedown", () => {
  beforeEach(() => publication.mockReset());

  test("an absent idea returns a real 404 before the PPR shell streams", async () => {
    publication.mockResolvedValueOnce("legacy").mockResolvedValueOnce(null);
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/wp46-e7-nonexistent-probe", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(404);
    expect(publication).toHaveBeenCalledTimes(2);
  });

  test("an invalid idea slug returns a real 404 without querying publication", async () => {
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/Unknown-Idea", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(404);
    expect(publication).not.toHaveBeenCalled();
  });

  test("extension-like idea and build slugs are included in the middleware matcher", async () => {
    expect(config.matcher).toContain("/ideas/:path*");
    expect(config.matcher).toContain("/build/:path*");
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/missing.js", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(404);
    expect(publication).not.toHaveBeenCalled();
  });

  test("a retired engine draft cannot stream a page even with a stored body", async () => {
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/engine-draft-private-probe", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(404);
    expect(publication).not.toHaveBeenCalled();
  });

  test("a Convex-only legacy idea stays reachable with no-store", async () => {
    publication.mockResolvedValueOnce("legacy").mockResolvedValueOnce({ slug: "legacy-convex-only-probe", bodyMode: "convex", body: "# Legacy" });
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/legacy-convex-only-probe", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  test("a stale Convex metadata row without a body is a real 404", async () => {
    publication.mockResolvedValueOnce("legacy").mockResolvedValueOnce({ slug: "ai-built-app-code-audit", bodyMode: "mdx" });
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/ai-built-app-code-audit", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(404);
  });

  test("a collection route stays reachable without a legacy idea row", async () => {
    publication.mockResolvedValueOnce("legacy");
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/ai-tools", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(200);
    expect(publication).toHaveBeenCalledTimes(1);
  });

  test("the /ideas/today redirect is not treated as an idea slug", async () => {
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/today", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(200);
    expect(publication).not.toHaveBeenCalled();
  });

  test.each([
    "/build/phone-neck-score-app",
    "/image/og/idea/phone-neck-score-app.png",
    "/_next/image?url=%2Fimage%2Fog%2Fidea%2Fphone-neck-score-app.png&w=640&q=75",
  ])("%s is not cacheable before an emergency takedown", async (path) => {
    publication.mockResolvedValueOnce("legacy");
    const response = await middleware(new NextRequest(`https://www.weekendmvp.app${path}`, {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  test.each([
    "/ideas/abandoned-cart-recovery",
    "/build/abandoned-cart-recovery",
    "/image/og/idea/abandoned-cart-recovery.png",
    "/_next/image?url=%2Fimage%2Fog%2Fidea%2Fabandoned-cart-recovery.png&w=640&q=75",
  ])("%s returns a real 404 before public content can stream", async (path) => {
    publication.mockResolvedValueOnce("removed");
    const response = await middleware(new NextRequest(`https://www.weekendmvp.app${path}`, {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(404);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  test("a managed update cannot serve the old optimized OG image", async () => {
    publication.mockResolvedValueOnce("released");
    const response = await middleware(new NextRequest(
      "https://www.weekendmvp.app/_next/image?url=%2Fimage%2Fog%2Fidea%2Fabandoned-cart-recovery.png&w=640&q=75",
      { headers: { host: "www.weekendmvp.app" } },
    ), event);
    expect(response?.status).toBe(404);
  });

  test("a missing visibility answer cannot serve legacy MDX", async () => {
    publication.mockRejectedValueOnce(new Error("backend unavailable"));
    const response = await middleware(new NextRequest("https://www.weekendmvp.app/ideas/abandoned-cart-recovery", {
      headers: { host: "www.weekendmvp.app" },
    }), event);
    expect(response?.status).toBe(503);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });
});
