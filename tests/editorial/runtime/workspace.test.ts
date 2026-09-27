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
  test("deny by default: without the explicit opt-in the workspace is unavailable", async () => {
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", "");
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "fixture_not_enabled" });
  });

  test("any value other than the exact opt-in is refused", async () => {
    for (const value of ["1", "true", "LOCAL-DEMO", "local-demo "]) {
      vi.stubEnv("EDITORIAL_FIXTURE_MODE", value);
      expect((await getEditorialWorkspace()).status).toBe("unavailable");
    }
  });

  test("production never serves the fixture workspace, even with the opt-in set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);
    expect(await getEditorialWorkspace()).toEqual({ status: "unavailable", reason: "live_adapter_not_built" });
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
