import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

const { publication } = vi.hoisted(() => ({ publication: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: publication }));

import { middleware } from "../../middleware";

const event = { waitUntil() {}, passThroughOnException() {} } as unknown as NextFetchEvent;

describe("request-time editorial takedown", () => {
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
