import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

// Convex Auth reads cookies through `next/headers`, which only works inside a
// Next request scope. Point it at the request under test instead.
let currentRequest: NextRequest;
vi.mock("next/headers", () => ({
  headers: async () => currentRequest.headers,
  cookies: async () => currentRequest.cookies,
}));

const fetchAction = vi.fn();
vi.mock("convex/nextjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/nextjs")>()),
  fetchAction: (...args: unknown[]) => fetchAction(...args),
}));

const { middleware } = await import("../../middleware");

const event = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as NextFetchEvent;

const HOST = "www.weekendmvp.app";
const VERIFIER = "__Host-__convexAuthOAuthVerifier=pkce-verifier";

async function navigate(url: string, cookie = "") {
  currentRequest = new NextRequest(url, {
    headers: {
      host: HOST,
      accept: "text/html,application/xhtml+xml",
      ...(cookie ? { cookie } : {}),
    },
  });
  const response = await middleware(currentRequest, event);
  if (!response) throw new Error("Middleware returned no response");
  return response;
}

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .find((line) => line.startsWith("__Host-__convexAuthJWT="));
}

describe("Google OAuth code handoff", () => {
  beforeEach(() => {
    fetchAction.mockReset();
    fetchAction.mockResolvedValue({
      tokens: { token: "session-jwt", refreshToken: "session-refresh" },
    });
  });

  // The production bug: Convex sent Google's code to `/dashboard`, the code
  // was never exchanged, and the visitor bounced to `/login`.
  it("signs the visitor in when Google's code lands on /dashboard", async () => {
    const response = await navigate(
      `https://${HOST}/dashboard?code=67938938`,
      VERIFIER,
    );

    expect(fetchAction).toHaveBeenCalledWith(
      "auth:signIn",
      { params: { code: "67938938" }, verifier: "pkce-verifier" },
      expect.anything(),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://${HOST}/dashboard`);
    expect(sessionCookie(response)).toMatch(/^__Host-__convexAuthJWT=session-jwt;/);
  });

  it("still exchanges the code on the dedicated callback seam", async () => {
    const response = await navigate(
      `https://${HOST}/auth/callback?returnTo=%2Fdashboard&code=67938938`,
      VERIFIER,
    );

    expect(fetchAction).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(
      `https://${HOST}/auth/callback?returnTo=%2Fdashboard`,
    );
    expect(sessionCookie(response)).toMatch(/^__Host-__convexAuthJWT=session-jwt;/);
  });

  it("leaves a dashboard code alone when no Google sign-in is in flight", async () => {
    const response = await navigate(`https://${HOST}/dashboard?code=unrelated`);

    expect(fetchAction).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      `https://${HOST}/login?returnTo=%2Fdashboard%3Fcode%3Dunrelated`,
    );
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("never exchanges a code on a public page", async () => {
    const response = await navigate(
      `https://${HOST}/ideas/example?code=67938938`,
      VERIFIER,
    );

    expect(fetchAction).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });
});
