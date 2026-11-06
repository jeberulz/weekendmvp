import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { TENANT_TAKEDOWN_READY_KEY } from "../../../lib/tenant-takedown";

const configRead = vi.hoisted(() => vi.fn());
const publishCheck = vi.hoisted(() => vi.fn());
vi.mock("@vercel/global-config", () => ({
  createClient: () => ({ get: configRead }),
}));
vi.mock("../../../lib/tenant-publish-check", () => ({
  checkTenantSitePublished: publishCheck,
}));

import { middleware } from "../../../middleware";

const event = { waitUntil() {}, passThroughOnException() {} } as unknown as NextFetchEvent;

describe("WP78 tenant denylist before Convex", () => {
  test("clear slug keeps the Convex fail-open rewrite when Convex is down", async () => {
    vi.stubEnv("TENANT_GLOBAL_CONFIG", "https://global-config.vercel.com/ecfg_test?token=test");
    configRead.mockImplementation(async (key: string) =>
      key === TENANT_TAKEDOWN_READY_KEY ? true : undefined);
    publishCheck.mockRejectedValue(new Error("Convex offline"));
    try {
      const request = new NextRequest("https://hydrotrail.weekendmvp.app/", {
        headers: { host: "hydrotrail.weekendmvp.app" },
      });
      const response = await middleware(request, event);
      expect(response?.status).toBe(200);
      expect(response?.headers.get("x-middleware-rewrite")).toContain("/site/hydrotrail");
      expect(publishCheck).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllEnvs();
      configRead.mockReset();
      publishCheck.mockReset();
    }
  });

  test.each(["/", "/__lead"])("taken-down slug %s remains a hard 404 when Convex is down", async (path) => {
    vi.stubEnv("TENANT_GLOBAL_CONFIG", "https://global-config.vercel.com/ecfg_test?token=test");
    configRead.mockResolvedValue(true);
    publishCheck.mockRejectedValue(new Error("Convex offline"));
    try {
      const request = new NextRequest(`https://hydrotrail.weekendmvp.app${path}`, {
        headers: { host: "hydrotrail.weekendmvp.app" },
      });
      const response = await middleware(request, event);
      expect(response?.status).toBe(404);
      expect(publishCheck).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      configRead.mockReset();
      publishCheck.mockReset();
    }
  });

  test("unreadable Global Config refuses tenant traffic before Convex", async () => {
    vi.stubEnv("TENANT_GLOBAL_CONFIG", "https://global-config.vercel.com/ecfg_test?token=test");
    configRead.mockRejectedValue(new Error("Global Config offline"));
    try {
      const request = new NextRequest("https://hydrotrail.weekendmvp.app/", {
        headers: { host: "hydrotrail.weekendmvp.app" },
      });
      const response = await middleware(request, event);
      expect(response?.status).toBe(404);
      expect(publishCheck).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      configRead.mockReset();
      publishCheck.mockReset();
    }
  });
});
