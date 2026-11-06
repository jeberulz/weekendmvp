import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";

const state = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class { mutation = state.mutation; },
}));

import { POST } from "../../app/api/tenant/lead/route";

const SECRET = "tenant-lead-bridge-test-secret-32-bytes";
const HOSTNAME = "acme.weekendmvp.app";

function request(body: unknown = {}) {
  return new Request(`https://${HOSTNAME}/__lead`, {
    method: "POST",
    headers: {
      host: HOSTNAME,
      origin: `https://${HOSTNAME}`,
      "content-type": "application/json",
      "x-vercel-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3410");
  vi.stubEnv("TENANT_LEAD_BRIDGE_SECRET", SECRET);
  state.mutation.mockResolvedValue({ recorded: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("tenant lead signed handoff", () => {
  test("signs a pseudonymous client key and the resolved tenant host", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(state.mutation).toHaveBeenCalledTimes(1);
    const signed = state.mutation.mock.calls[0][1] as { payload: string; signature: string };
    const payload = JSON.parse(signed.payload) as {
      hostname: string; rateLimitKey: string; issuedAt: number;
    };
    expect(payload.hostname).toBe(HOSTNAME);
    expect(payload.rateLimitKey).toMatch(/^client:[A-Za-z0-9_-]{43}$/);
    expect(payload.rateLimitKey).toBe(`client:${createHmac("sha256", SECRET)
      .update("tenant-lead-bucket\0").update("ip:203.0.113.7").digest("base64url")}`);
    expect(signed.payload).not.toContain("203.0.113.7");
    expect(payload.issuedAt).toBeGreaterThan(Date.now() - 10_000);
    expect(signed.signature).toBe(createHmac("sha256", SECRET)
      .update(signed.payload).digest("base64url"));
  });

  test("refuses missing or short secret before reaching Convex", async () => {
    for (const secret of ["", "too-short"]) {
      vi.stubEnv("TENANT_LEAD_BRIDGE_SECRET", secret);
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false, code: "TENANT_LEAD_UNAVAILABLE" });
    }
    expect(state.mutation).not.toHaveBeenCalled();
  });

  test("still refuses a real email before signing or writing", async () => {
    const response = await POST(request({ email: "visitor@example.test" }));
    expect(response.status).toBe(422);
    expect(state.mutation).not.toHaveBeenCalled();
  });

  test.each([
    "TENANT_LEAD_BRIDGE_NOT_CONFIGURED",
    "INVALID_TENANT_LEAD_BRIDGE_SIGNATURE",
    "INVALID_TENANT_LEAD_BRIDGE_PAYLOAD",
    "TENANT_LEAD_BRIDGE_EXPIRED",
  ])("reports backend bridge failure as unavailable: %s", async (code) => {
    state.mutation.mockRejectedValueOnce(new ConvexError({ code }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "TENANT_LEAD_UNAVAILABLE" });
  });
});
