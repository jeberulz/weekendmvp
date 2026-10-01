import { getFunctionName, type FunctionReference } from "convex/server";
import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/*
 * WP46-E4e. Middleware is the first gate for the editorial workspace: it
 * answers a real 404 to anyone Convex does not confirm as the super-admin, and
 * marks every operator response private. Convex is stubbed here; the tokens
 * are fabricated, unsigned JWTs (Convex, not middleware, verifies them).
 */

const state = vi.hoisted(() => ({
  request: null as NextRequest | null,
  query: vi.fn(),
  action: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => state.request?.headers,
  cookies: async () => state.request?.cookies,
}));
vi.mock("convex/nextjs", () => ({ fetchQuery: state.query, fetchAction: state.action }));

import { EDITORIAL_NOT_FOUND_PATH, middleware } from "@/middleware";

const event = { waitUntil() {}, passThroughOnException() {} } as unknown as NextFetchEvent;

function jwt(): string {
  const now = Math.floor(Date.now() / 1000);
  return `eyJhbGciOiJSUzI1NiJ9.${btoa(JSON.stringify({ iat: now, exp: now + 3600, sub: "user|session" }))}.signature`;
}

async function visit(path: string, options: { signedIn?: boolean; method?: string; headers?: Record<string, string> } = {}) {
  state.request = new NextRequest(`http://localhost:3246${path}`, {
    method: options.method ?? "GET",
    headers: {
      host: "localhost:3246",
      ...(options.signedIn ? { cookie: `__convexAuthJWT=${jwt()}; __convexAuthRefreshToken=refresh` } : {}),
      ...options.headers,
    },
  });
  const response = await middleware(state.request, event);
  if (!response) throw new Error("no response");
  return response;
}

function rewrittenTo(response: Response): string | null {
  const target = response.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname : null;
}

function sessionAnswers(editor: boolean) {
  state.query.mockImplementation(async (ref: FunctionReference<"query">) => {
    expect(getFunctionName(ref)).toBe("editorial/reads:session");
    return editor
      ? {
          signedIn: true,
          editor: { displayName: "Owner", strongAuthAt: null, strongAuthFresh: false, signInMethod: "email", email: "o@example.test" },
        }
      : { signedIn: true, editor: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EDITORIAL_FIXTURE_MODE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("editorial gate", () => {
  test("a signed-out visitor gets the site's 404 without a backend call", async () => {
    const response = await visit("/admin/editorial/ideas/idea_x?tab=review");
    expect(rewrittenTo(response)).toBe(EDITORIAL_NOT_FOUND_PATH);
    expect(state.query).not.toHaveBeenCalled();
  });

  test("a signed-in account without the capability gets the same 404", async () => {
    sessionAnswers(false);
    expect(rewrittenTo(await visit("/admin/editorial", { signedIn: true }))).toBe(EDITORIAL_NOT_FOUND_PATH);
    expect(state.query).toHaveBeenCalledOnce();
  });

  test("the gate fails closed when the backend cannot answer", async () => {
    state.query.mockRejectedValue(new Error("network down"));
    expect(rewrittenTo(await visit("/admin/editorial/settings", { signedIn: true }))).toBe(EDITORIAL_NOT_FOUND_PATH);
  });

  test("server actions and RSC requests meet the same gate", async () => {
    sessionAnswers(false);
    const action = await visit("/admin/editorial/ideas/idea_x", {
      signedIn: true,
      method: "POST",
      headers: { "next-action": "0123456789abcdef", "content-type": "text/plain" },
    });
    expect(rewrittenTo(action)).toBe(EDITORIAL_NOT_FOUND_PATH);
    const rsc = await visit("/admin/editorial/library?_rsc=1", { headers: { rsc: "1" } });
    expect(rewrittenTo(rsc)).toBe(EDITORIAL_NOT_FOUND_PATH);
  });

  test("the bound super-admin passes through", async () => {
    sessionAnswers(true);
    const response = await visit("/admin/editorial/releases", { signedIn: true });
    expect(rewrittenTo(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  test("the local demo skips the gate in development only", async () => {
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", "local-demo");
    expect(rewrittenTo(await visit("/admin/editorial"))).toBeNull();
    expect(state.query).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    expect(rewrittenTo(await visit("/admin/editorial"))).toBe(EDITORIAL_NOT_FOUND_PATH);
  });
});

describe("operator responses", () => {
  test.each(["/admin/editorial", "/admin"])("%s is private, uncached, unindexed and sends no referrer", async (path) => {
    const response = await visit(path);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  test("public and member pages are untouched", async () => {
    const response = await visit("/startup-ideas");
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(rewrittenTo(response)).toBeNull();
  });
});
