import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";

const state = vi.hoisted(() => ({ request: null as NextRequest | null, action: vi.fn(), query: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => state.request!.headers,
  cookies: async () => state.request!.cookies,
}));
vi.mock("convex/nextjs", () => ({ fetchAction: state.action, fetchQuery: state.query }));
import { middleware } from "../../middleware";
const event = { waitUntil() {}, passThroughOnException() {} } as unknown as NextFetchEvent;
const token = (iat: number, exp: number) => `eyJhbGciOiJSUzI1NiJ9.${btoa(JSON.stringify({ iat, exp, sub: "fixture" }))}.signature`;

beforeEach(() => { vi.clearAllMocks(); state.query.mockResolvedValue(true); });

test.each(["/api/ideas/prompts?slug=adspark", "/dashboard/saved"])("forwards refreshed request cookies upstream on %s", async path => {
  const now = Math.floor(Date.now() / 1000);
  const expired = token(now - 3600, now - 1);
  const refreshed = token(now, now + 3600);
  state.action.mockResolvedValue({ tokens: { token: refreshed, refreshToken: "new-refresh" } });
  state.request = new NextRequest(`http://localhost:3188${path}`, {
    headers: { host: "localhost:3188", cookie: `__convexAuthJWT=${expired}; __convexAuthRefreshToken=old-refresh` },
  });
  const response = await middleware(state.request, event);
  expect(state.action).toHaveBeenCalledWith("auth:signIn", { refreshToken: "old-refresh" }, expect.any(Object));
  const forwarded = response!.headers.get("x-middleware-request-cookie");
  expect(forwarded).toContain(`__convexAuthJWT=${refreshed}`);
  expect(forwarded).not.toContain(expired);
  expect(forwarded).toContain("__convexAuthRefreshToken=new-refresh");
  expect(response!.headers.get("set-cookie")).toContain(`__convexAuthJWT=${refreshed}`);
  expect(response!.headers.get("cookie")).toBeNull();
});

test("fresh fabricated JWT bypasses refresh and reaches upstream unchanged", async () => {
  const now = Math.floor(Date.now() / 1000);
  const forged = token(now, now + 3600);
  state.request = new NextRequest("http://localhost:3188/api/ideas/prompts?slug=adspark", {
    headers: { host: "localhost:3188", cookie: `__convexAuthJWT=${forged}; __convexAuthRefreshToken=valid-refresh` },
  });
  const response = await middleware(state.request, event);
  expect(state.action).not.toHaveBeenCalled();
  expect(response!.headers.get("x-middleware-request-cookie")).toContain(`__convexAuthJWT=${forged}`);
});
