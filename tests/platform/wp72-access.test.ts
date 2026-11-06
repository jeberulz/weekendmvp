import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({
  readToken: async (): Promise<string | null> => "session-token",
}));
const fetchQuery = vi.hoisted(() => vi.fn());

vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: () => auth.readToken(),
}));
vi.mock("convex/nextjs", () => ({ fetchQuery }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

import { api } from "../../convex/_generated/api";
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
    auth.readToken = async () => "session-token";
    fetchQuery.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  test("returns the project when Convex says allowed, passing the session token", async () => {
    fetchQuery.mockResolvedValue({ allowed: true, project: { _id: "p1", name: "HydroTrail" } });
    await expect(outcome("p1")).resolves.toEqual({ _id: "p1", name: "HydroTrail" });
    expect(fetchQuery).toHaveBeenCalledTimes(1);
    const [ref, args, options] = fetchQuery.mock.calls[0] ?? [];
    // `api` refs are proxies, so compare by the function name they resolve to.
    expect(getFunctionName(ref)).toBe(getFunctionName(api.workspace.access.getWorkspaceAccess));
    expect(getFunctionName(ref)).toBe("workspace/access:getWorkspaceAccess");
    expect(args).toEqual({ projectId: "p1" });
    expect(options).toEqual({ token: "session-token" });
  });

  test("a denial is a 404", async () => {
    fetchQuery.mockResolvedValue({ allowed: false });
    await expect(outcome("p1")).resolves.toBe("not-found");
  });

  test("signed out is a 404 without asking Convex", async () => {
    auth.readToken = async () => null;
    await expect(outcome("p1")).resolves.toBe("not-found");
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  test("a token read that fails is a 404, not a 500", async () => {
    auth.readToken = async () => {
      throw new Error("cookie decode failed");
    };
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
