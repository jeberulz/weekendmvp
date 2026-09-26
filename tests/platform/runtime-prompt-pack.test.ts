import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
const state = vi.hoisted(() => ({ token: vi.fn(), query: vi.fn(), content: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({ convexAuthNextjsToken: state.token }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { setAuth() {} query = state.query; } }));
vi.mock("@/lib/dashboard/idea-prompts", () => ({ getIdeaPackContent: state.content }));
import { GET } from "../../app/api/ideas/prompt-pack/route";
const request = () => new Request("http://localhost:3188/api/ideas/prompt-pack?slug=adspark&format=claude");
const content = { problem: "A real problem", how: [], stack: [], prompts: [{ title: "Build", lines: ["Build the canonical feature"] }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3310");
  state.token.mockResolvedValue("member-token");
  state.query.mockResolvedValue({ title: "Fixture", description: "Canonical description" });
  state.content.mockResolvedValue(content);
});
describe("prompt pack route", () => {
  test("free members cannot trigger a content read or download", async () => {
    state.query.mockRejectedValue(new ConvexError({ code: "UPGRADE_REQUIRED", feature: "prompt_pack" }));
    expect((await GET(request())).status).toBe(403);
    expect(state.content).not.toHaveBeenCalled();
  });
  test("an authorized member gets a real pack from canonical content", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toContain("Build the canonical feature");
  });
  test("missing and empty content cannot silently produce a download", async () => {
    state.content.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...content, prompts: [] });
    expect((await GET(request())).status).toBe(404);
    const empty = await GET(request());
    expect(empty.status).toBe(422);
    expect(await empty.json()).toEqual({ code: "PROMPTS_UNAVAILABLE" });
  });
  test("unavailable canonical content is retryable", async () => {
    state.content.mockRejectedValue(new Error("offline"));
    expect((await GET(request())).status).toBe(503);
  });
});
