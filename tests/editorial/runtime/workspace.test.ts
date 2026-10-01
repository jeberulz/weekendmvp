import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

import { FIXTURE_MODE_VALUE, getEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * `getEditorialWorkspace` is wrapped in React `cache`, which only dedupes
 * inside a server request; outside one each call resolves afresh.
 */
describe("editorial workspace gate", () => {
  test("deny by default: without the explicit opt-in there is no fixture workspace", async () => {
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    // The live workspace needs a backend and the super-admin; see live-workspace.test.ts.
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "not_configured" });
  });

  test("any value other than the exact opt-in is refused", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    for (const value of ["1", "true", "LOCAL-DEMO", "local-demo "]) {
      vi.stubEnv("EDITORIAL_FIXTURE_MODE", value);
      expect((await getEditorialWorkspace()).status).toBe("unavailable");
    }
  });

  test("production never serves the fixture workspace, even with the opt-in set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "not_configured" });
  });

  test("development with the opt-in gets the labelled fixture workspace", async () => {
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);
    const workspace = await getEditorialWorkspace();
    expect(workspace.status).toBe("fixture");
    if (workspace.status === "fixture") {
      expect(workspace.repository.mode).toBe("fixture");
      const settings = await workspace.repository.getSettings();
      expect(settings.ok && settings.value.publishing.readiness).toBe("simulated");
    }
  }, 30_000);
});
