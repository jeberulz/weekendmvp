import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const token = vi.hoisted(() => ({ value: "session-token" as string | null }));
const fetchQuery = vi.hoisted(() => vi.fn());

vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: async () => token.value,
}));
vi.mock("convex/nextjs", () => ({ fetchQuery }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

import { requireWorkspaceAccess } from "../../lib/workspace/access";

/** `notFound()` throws an error whose digest names the 404 fallback. */
async function outcome(projectId: string): Promise<"not-found" | { name: string }> {
  try {
    return await requireWorkspaceAccess(projectId);
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.endsWith(";404")) return "not-found";
    throw error;
  }
}

describe("WP72-S1 requireWorkspaceAccess", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-test-123.convex.cloud");
    token.value = "session-token";
    fetchQuery.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  test("returns the project when Convex says allowed, passing the session token", async () => {
    fetchQuery.mockResolvedValue({ allowed: true, project: { _id: "p1", name: "HydroTrail" } });
    await expect(outcome("p1")).resolves.toEqual({ _id: "p1", name: "HydroTrail" });
    expect(fetchQuery).toHaveBeenCalledWith(expect.anything(), { projectId: "p1" }, { token: "session-token" });
  });

  test("a denial is a 404", async () => {
    fetchQuery.mockResolvedValue({ allowed: false });
    await expect(outcome("p1")).resolves.toBe("not-found");
  });

  test("signed out is a 404 without asking Convex", async () => {
    token.value = null;
    await expect(outcome("p1")).resolves.toBe("not-found");
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  test("a malformed id or backend error is the same 404", async () => {
    fetchQuery.mockRejectedValue(new Error("ArgumentValidationError: Value does not match validator."));
    await expect(outcome("not-an-id")).resolves.toBe("not-found");
  });

  test("no valid Convex URL is a 404 without asking Convex", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    await expect(outcome("p1")).resolves.toBe("not-found");
    expect(fetchQuery).not.toHaveBeenCalled();
  });
});
