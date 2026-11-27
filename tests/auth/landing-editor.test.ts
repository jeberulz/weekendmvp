import { beforeEach, expect, test, vi } from "vitest";
import { isLandingEditorRequestPath, isOperatorPath, isOperatorRequestPath } from "@/lib/private-paths";
import { scopeEditorCookies } from "@/lib/landing/editor-cookies";
import { editorMode } from "@/lib/landing/editor-policy";
import type { StorageMode } from "@/keystatic.config";

const server = vi.hoisted(() => ({
  configuredEditorMode: vi.fn<() => StorageMode | null>(),
  editorAccessAllowed: vi.fn<() => Promise<boolean>>(),
}));
const adapter = vi.hoisted(() => vi.fn(async () => new Response("adapter")));
vi.mock("@/lib/landing/editor-server", () => server);
vi.mock("@keystatic/next/route-handler", () => ({
  makeRouteHandler: () => ({ GET: adapter, POST: adapter }),
}));
import { GET, POST } from "@/app/api/keystatic/[...params]/route";

const empty = [undefined, undefined, undefined, undefined] as const;
const full = ["id", "client secret", "e".repeat(32), "app slug"] as const;

test("local storage requires development and four empty credentials", () => {
  expect(editorMode(false, empty)).toBe("local");
  expect(editorMode(true, empty)).toBeNull();
  for (const production of [true, false]) {
    expect(editorMode(production, full)).toBe("github");
    expect(editorMode(production, ["id", "secret", "short", "slug"])).toBeNull();
    for (let i = 0; i < full.length; i++) {
      const partial: [string, string, string, string] = [...full];
      partial[i] = " ";
      expect(editorMode(production, partial)).toBeNull();
    }
  }
});

test("editor entry and native router get operator protection, including segment requests", () => {
  for (const path of ["/admin/pages", "/keystatic", "/keystatic/singleton/guide.js"]) {
    expect(isOperatorPath(path)).toBe(true);
    expect(isOperatorRequestPath(path)).toBe(true);
    expect(isLandingEditorRequestPath(path)).toBe(true);
  }
  for (const path of ["/%6beystatic", "/keystatic.segments/_tree.segment", "/admin/pages.segments/_tree.segment"]) {
    expect(isOperatorRequestPath(path)).toBe(true);
    expect(isLandingEditorRequestPath(path)).toBe(true);
  }
  expect(isOperatorPath("/keystatic-guide")).toBe(false);
  expect(isLandingEditorRequestPath("/admin/editorial")).toBe(false);
});

beforeEach(() => {
  vi.clearAllMocks();
  server.configuredEditorMode.mockReturnValue("github");
  server.editorAccessAllowed.mockResolvedValue(false);
});

function request(path: string, method = "GET") {
  return new Request("https://example.test/api/keystatic/" + path, { method });
}

test("only the two exact OAuth GET routes reach the adapter without an operator", async () => {
  for (const path of ["github/login", "github/oauth/callback"]) {
    expect((await GET(request(path))).status).toBe(200);
    expect((await POST(request(path, "POST"))).status).toBe(404);
  }
  for (const path of ["tree", "github/logout", "github/refresh-token", "github/created-app", "github/login/other"]) {
    expect((await GET(request(path))).status).toBe(404);
  }
  expect(adapter).toHaveBeenCalledTimes(2);
});

test("filesystem reads and writes require a live operator", async () => {
  server.configuredEditorMode.mockReturnValue("local");
  expect((await GET(request("github/login"))).status).toBe(404);
  expect((await GET(request("tree"))).status).toBe(404);
  expect((await POST(request("update", "POST"))).status).toBe(404);
  expect(adapter).not.toHaveBeenCalled();
  server.editorAccessAllowed.mockResolvedValue(true);
  const result = await POST(request("update", "POST"));
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toContain("no-store");
});

test("a disabled installation refuses OAuth and writes, even for an operator", async () => {
  server.configuredEditorMode.mockReturnValue(null);
  server.editorAccessAllowed.mockResolvedValue(true);
  expect((await GET(request("github/login"))).status).toBe(404);
  expect((await POST(request("update", "POST"))).status).toBe(404);
  expect(adapter).not.toHaveBeenCalled();
});


test("exchanging an OAuth code requires the live operator", async () => {
  const callback = request("github/oauth/callback?code=test-code");
  expect((await GET(callback)).status).toBe(404);
  expect(adapter).not.toHaveBeenCalled();
  server.editorAccessAllowed.mockResolvedValue(true);
  expect((await GET(callback)).status).toBe(200);
});

test.each([3600, 0])("token cookies are scoped when issued, refreshed or expired (%i)", (maxAge) => {
  const headers = new Headers();
  const attrs = `Max-Age=${maxAge}; Secure; SameSite=Lax`;
  headers.append("set-cookie", `keystatic-gh-access-token=test; Path=/; ${attrs}`);
  headers.append("set-cookie", `keystatic-gh-refresh-token=test; HttpOnly; Path=/; ${attrs}`);
  headers.append("set-cookie", "ks-state=test; Path=/; HttpOnly");
  scopeEditorCookies(headers);
  expect(headers.getSetCookie()).toEqual([
    `keystatic-gh-access-token=test; ${attrs}; Path=/keystatic`,
    `keystatic-gh-access-token=test; ${attrs}; Path=/api/keystatic; HttpOnly`,
    `keystatic-gh-refresh-token=test; ${attrs}; Path=/api/keystatic; HttpOnly`,
    "ks-state=test; Path=/; HttpOnly",
  ]);
});
