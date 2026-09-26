import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";

const state = vi.hoisted(() => ({ token: vi.fn(), query: vi.fn(), mutation: vi.fn(), setAuth: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({ convexAuthNextjsToken: state.token }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    constructor(_url: string, options: { auth: string }) { state.setAuth(options.auth); }
    query = state.query;
    mutation = state.mutation;
  },
}));
import { GET, POST } from "../../app/api/platform/saved/route";

const request = () => new Request("http://localhost:3188/api/platform/saved?slug=adspark");
const post = (body: unknown) => new Request(request(), { method: "POST", headers: { origin: "http://localhost:3188", "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3310");
  state.token.mockResolvedValue("member-token");
  state.query.mockResolvedValue({ saved: true, version: 3 });
  state.mutation.mockReset().mockResolvedValue(null);
});

describe("Save state HTTP responses", () => {
  test("an absent session is signed out without a database request", async () => {
    state.token.mockResolvedValue(undefined);
    expect(await (await GET(request())).json()).toEqual({ signedIn: false, saved: false });
    expect(state.query).not.toHaveBeenCalled();
  });

  test("a verified member sees the real save state", async () => {
    const response = await GET(request());
    expect(await response.json()).toEqual({ signedIn: true, saved: true, version: 3 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(state.setAuth).toHaveBeenCalledWith("member-token");
    expect(state.mutation).toHaveBeenCalledWith(expect.anything(), {});
    expect(state.mutation.mock.invocationCallOrder[0]).toBeLessThan(state.query.mock.invocationCallOrder[0]);
  });

  test("only an authentication rejection becomes signed out", async () => {
    state.query.mockRejectedValue(new ConvexError({ code: "UNAUTHENTICATED" }));
    expect(await (await GET(request())).json()).toEqual({ signedIn: false, saved: false });
  });

  test.each([new Error("network offline"), new ConvexError({ code: "INTERNAL_FAILURE" })])("backend failure gives 503, preserving the member's chance to retry", async (error) => {
    state.query.mockRejectedValue(error);
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "UNAVAILABLE" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test.each(["expired", "revoked"])("a %s session fails fresh membership before the saved query", async () => {
    state.mutation.mockRejectedValue(new ConvexError({ code: "UNAUTHENTICATED" }));
    expect(await (await GET(request())).json()).toEqual({ signedIn: false, saved: false });
    expect(state.query).not.toHaveBeenCalled();
  });

  test("membership transport failure is unavailable rather than signed out", async () => {
    state.mutation.mockRejectedValue(new Error("offline"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "UNAVAILABLE" });
    expect(state.query).not.toHaveBeenCalled();
  });

  test("cross-origin writes fail before session lookup or mutation", async () => {
    const response = await POST(new Request(request(), { method: "POST", headers: { origin: "https://attacker.example" }, body: JSON.stringify({ slug: "adspark", saved: false }) }));
    expect(response.status).toBe(403);
    expect(state.token).not.toHaveBeenCalled();
    expect(state.mutation).not.toHaveBeenCalled();
  });

  test.each([null, -1, 0.5, "3", Number.MAX_SAFE_INTEGER + 1])("invalid expectedVersion %s fails before reading the session", async (expectedVersion) => {
    expect((await POST(post({ slug: "adspark", saved: true, expectedVersion }))).status).toBe(400);
    expect(state.token).not.toHaveBeenCalled();
    expect(state.mutation).not.toHaveBeenCalled();
  });

  test("a versioned write forwards the fence and returns the committed version", async () => {
    state.mutation.mockResolvedValue({ saved: false, version: 4 });
    const response = await POST(post({ slug: "adspark", saved: false, expectedVersion: 3 }));
    expect(response.status).toBe(200);
    expect(state.mutation).toHaveBeenCalledWith(expect.anything(), { slug: "adspark", saved: false, expectedVersion: 3 });
    expect(await response.json()).toEqual({ saved: false, version: 4 });
  });

  test("a stale write returns a retryable conflict with authoritative state", async () => {
    state.mutation.mockRejectedValue(new ConvexError({ code: "SAVE_CONFLICT", saved: false, version: 4 }));
    const response = await POST(post({ slug: "adspark", saved: true, expectedVersion: 3 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "SAVE_CONFLICT", saved: false, version: 4 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
