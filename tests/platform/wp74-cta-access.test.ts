import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  token: null as string | null,
  query: vi.fn(),
  tokenError: null as unknown,
}));

vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: async () => {
    if (state.tokenError) throw state.tokenError;
    return state.token;
  },
}));
vi.mock("convex/nextjs", () => ({ fetchQuery: state.query }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
  },
}));
vi.mock("next/cache", () => ({ cacheLife: () => undefined }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

import { buildCtaVisible } from "../../lib/workspace/build-cta-access";

beforeEach(() => {
  state.token = null;
  state.tokenError = null;
  state.query.mockReset();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-123.convex.cloud");
});

describe("buildCtaVisible (server flag read)", () => {
  test("true only when the backend says so, with the session when there is one", async () => {
    state.query.mockResolvedValue(true);
    state.token = "jwt";
    await expect(buildCtaVisible()).resolves.toBe(true);
    expect(state.query.mock.calls[0][2]).toEqual({ token: "jwt" });
  });

  test("a signed-out request calls with no token, through the shared cached read", async () => {
    state.query.mockResolvedValue(true);
    await expect(buildCtaVisible()).resolves.toBe(true);
    expect(state.query.mock.calls[0][2]).toBeUndefined();
  });

  test("the backend saying false is false", async () => {
    state.query.mockResolvedValue(false);
    await expect(buildCtaVisible()).resolves.toBe(false);
  });

  test("a non-boolean answer is false", async () => {
    state.query.mockResolvedValue("true");
    await expect(buildCtaVisible()).resolves.toBe(false);
  });

  test("no backend url is false and makes no call", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    await expect(buildCtaVisible()).resolves.toBe(false);
    expect(state.query).not.toHaveBeenCalled();
  });

  test("a backend error or a token failure is false", async () => {
    state.query.mockRejectedValue(new Error("boom"));
    await expect(buildCtaVisible()).resolves.toBe(false);
    state.tokenError = new Error("cookie");
    await expect(buildCtaVisible()).resolves.toBe(false);
  });

  test("a backend slower than 300 ms is false, not a slow page", async () => {
    vi.useFakeTimers();
    try {
      state.query.mockReturnValue(new Promise(() => undefined));
      const pending = buildCtaVisible();
      await vi.advanceTimersByTimeAsync(400);
      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("Next.js control flow is not swallowed", async () => {
    state.tokenError = new Error("NEXT_REDIRECT");
    await expect(buildCtaVisible()).rejects.toThrow("NEXT_REDIRECT");
  });
});
