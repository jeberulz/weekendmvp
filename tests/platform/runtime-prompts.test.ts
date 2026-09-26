import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  token: undefined as string | undefined,
  transport: vi.fn(),
  content: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3188" }),
  cookies: async () => ({ get: (name: string) => name === "__convexAuthJWT" && state.token ? { value: state.token } : undefined }),
}));
vi.mock("@/lib/dashboard/idea-prompts", () => ({ getIdeaPrompts: state.content }));

// Keep the cookie adapter and Convex HTTP client real. Only the HTTP transport
// is controlled here; the separate disposable integration checks real tokens.
import { GET } from "../../app/api/ideas/prompts/route";

const request = () => new Request("http://localhost:3188/api/ideas/prompts?slug=adspark");

beforeEach(() => {
  vi.clearAllMocks();
  state.token = undefined;
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3310");
  vi.stubGlobal("fetch", state.transport);
  state.transport.mockImplementation(async () => new Response("Invalid credentials", { status: 401 }));
  state.content.mockResolvedValue([{ title: "Build", lines: ["Build the idea"] }]);
});

describe("member prompt route with the installed authentication adapter", () => {
  test("missing cookies reject before content access", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(state.transport).not.toHaveBeenCalled();
    expect(state.content).not.toHaveBeenCalled();
  });

  test.each(["malformed-cookie", "forged-cookie", "expired-cookie"])("a backend rejection of %s is never treated as a member", async (token) => {
    state.token = token;
    const response = await GET(request());
    expect(state.transport).toHaveBeenCalledWith("http://127.0.0.1:3310/api/mutation", expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${token}` }) }));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.content).not.toHaveBeenCalled();
  });

  test("a revoked session receives a typed rejection from the membership function", async () => {
    state.token = "signed-but-revoked";
    state.transport.mockImplementation(async () => Response.json({ status: "error", errorMessage: "Unauthenticated", errorData: { code: "UNAUTHENTICATED" } }, { status: 560 }));
    expect((await GET(request())).status).toBe(401);
    expect(state.content).not.toHaveBeenCalled();
  });

  test("backend outages return 503 without reading protected content", async () => {
    state.token = "member-token";
    state.transport.mockRejectedValueOnce(new Error("offline"));
    expect((await GET(request())).status).toBe(503);
    expect(state.content).not.toHaveBeenCalled();
  });

  test("a backend-verified member gets the prompt content with private caching", async () => {
    state.token = "backend-verified-token";
    state.transport.mockImplementation(async () => Response.json({ status: "success", value: null }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await response.json()).toEqual({ prompts: [{ title: "Build", lines: ["Build the idea"] }] });
  });

  test("missing content is a 404 and unavailable content is a retryable 503", async () => {
    state.token = "backend-verified-token";
    state.transport.mockImplementation(async () => Response.json({ status: "success", value: null }));
    state.content.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("offline"));
    expect((await GET(request())).status).toBe(404);
    expect((await GET(request())).status).toBe(503);
  });
});
