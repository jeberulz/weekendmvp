// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import { MembershipBridgeError, verifyMembershipBridge } from "@/lib/membership-bridge";
import { MEMBERSHIP_STRIPE_API_VERSION } from "@/lib/membership/stripe-catalog";

// WP64-S5. The Billing Portal route, with Convex and Stripe replaced by fakes.

const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  setAuth: vi.fn(),
  action: vi.fn(),
  stripeArgs: [] as unknown[][],
  create: vi.fn(),
}));

vi.mock("@convex-dev/auth/nextjs/server", () => ({ convexAuthNextjsToken: mocks.token }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = mocks.setAuth;
    action = mocks.action;
  },
}));
vi.mock("stripe", () => ({
  default: class {
    billingPortal = { sessions: { create: mocks.create } };
    constructor(...args: unknown[]) {
      mocks.stripeArgs.push(args);
    }
  },
}));

import { POST } from "@/app/api/platform/membership/portal/route";

const SECRET = "membership-bridge-test-secret-0123456789abcdef";
const ENV = {
  MEMBERSHIP_BILLING_MODE: "test",
  MEMBERSHIP_TAX_MODE: "managed_payments",
  MEMBERSHIP_BILLING_APP_ORIGIN: "https://www.weekendmvp.app",
  MEMBERSHIP_BILLING_BRIDGE_SECRET: SECRET,
  STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_test_abc123",
  STRIPE_MEMBERSHIP_PRICE_MONTHLY: "price_monthly1",
  STRIPE_MEMBERSHIP_PRICE_ANNUAL: "price_annual1",
  STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1: "price_lifetimeA",
  STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2: "price_lifetimeB",
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  VERCEL_ENV: "",
};
const PORTAL_URL = "https://billing.stripe.com/p/session/test_abc";

// Requests arrive on another host (a preview, a proxy): the return address still comes from config.
const post = (body = "{}") =>
  POST(new Request("https://preview-host.example.test/api/platform/membership/portal", { method: "POST", body }));
const bridgeCalls = () =>
  mocks.action.mock.calls.map(([, signed]) => verifyMembershipBridge(signed.payload, signed.signature, SECRET));

beforeEach(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  mocks.token.mockResolvedValue("member-token");
  mocks.action.mockResolvedValue({ customerId: "cus_own" });
  mocks.create.mockResolvedValue({ id: "bps_1", url: PORTAL_URL, livemode: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  mocks.stripeArgs.length = 0;
});

describe("WP64-S5 portal route: refusals before Stripe", () => {
  test("no session is 401", async () => {
    mocks.token.mockResolvedValue(undefined);
    const response = await post();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: "AUTHENTICATION_REQUIRED" });
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test.each([["not json"], ['{"customer":"cus_other"}'], ["[]"], ["null"], ['{"returnUrl":"https://evil.test"}']])(
    "the body %s is refused: the browser never names a customer or a return address",
    async (body) => {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ ok: false, code: "INVALID_REQUEST" });
      expect(mocks.action).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  test("billing off, or any missing setting, is 503 (frozen contract 11)", async () => {
    for (const change of [{ MEMBERSHIP_BILLING_MODE: "off" }, { MEMBERSHIP_BILLING_MODE: "" }, { STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_live_x" }, { NEXT_PUBLIC_CONVEX_URL: "" }]) {
      for (const [name, value] of Object.entries(change)) vi.stubEnv(name, value);
      const response = await post();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false, code: "BILLING_UNAVAILABLE" });
      for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    }
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("Convex's refusals pass through; anything unknown is unavailable", async () => {
    mocks.action.mockResolvedValueOnce({ ok: false, code: "INVALID_REQUEST" });
    expect((await post()).status).toBe(400);
    mocks.action.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED" });
    expect(await (await post()).json()).toEqual({ ok: false, code: "RATE_LIMITED" });
    mocks.action.mockResolvedValueOnce({ ok: false, code: "AUTHENTICATION_REQUIRED" });
    expect((await post()).status).toBe(401);
    mocks.action.mockResolvedValueOnce({ ok: false, code: "SOMETHING_NEW" });
    expect((await post()).status).toBe(503);
    mocks.action.mockResolvedValueOnce({ attached: true });
    expect((await post()).status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("WP64-S5 portal route: the member's own customer", () => {
  test("sends the member's auth and the mode, names no customer, and returns Stripe's URL", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, url: PORTAL_URL });
    expect(mocks.setAuth).toHaveBeenCalledWith("member-token");
    expect(bridgeCalls()).toEqual([{ kind: "open_portal", livemode: false }]);
    expect(mocks.create).toHaveBeenCalledWith({
      customer: "cus_own",
      return_url: "https://www.weekendmvp.app/dashboard/billing",
    });
    expect(mocks.stripeArgs[0]).toEqual([
      "rk_test_abc123",
      expect.objectContaining({ apiVersion: MEMBERSHIP_STRIPE_API_VERSION }),
    ]);
  });

  test("a live deployment asks for the live customer and accepts only a live session", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_MODE", "live");
    vi.stubEnv("STRIPE_MEMBERSHIP_RESTRICTED_KEY", "rk_live_abc123");
    vi.stubEnv("VERCEL_ENV", "production");
    mocks.create.mockResolvedValueOnce({ id: "bps_live", url: PORTAL_URL, livemode: true });
    expect((await post()).status).toBe(200);
    expect(bridgeCalls()).toEqual([{ kind: "open_portal", livemode: true }]);
    mocks.create.mockResolvedValueOnce({ id: "bps_test", url: PORTAL_URL, livemode: false });
    expect((await post()).status).toBe(503);
  });

  test("the bridge refuses an open_portal payload that names anything more", () => {
    for (const payload of [
      JSON.stringify({ kind: "open_portal", livemode: false, customerId: "cus_other" }),
      JSON.stringify({ kind: "open_portal", livemode: "false" }),
      JSON.stringify({ kind: "open_portal" }),
    ]) {
      const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
      expect(() => verifyMembershipBridge(payload, signature, SECRET)).toThrow(MembershipBridgeError);
    }
  });

  test("a missing body is refused; `{}` is what the dashboard sends", async () => {
    const bare = await POST(new Request("https://www.weekendmvp.app/api/platform/membership/portal", { method: "POST" }));
    expect(bare.status).toBe(400);
    expect((await post("{}")).status).toBe(200);
  });

  test.each([
    ["a non-Stripe host", { url: "https://evil.test/p/session", livemode: false }],
    ["Checkout instead of the portal", { url: "https://checkout.stripe.com/c/pay/cs_test", livemode: false }],
    ["plain http", { url: "http://billing.stripe.com/p/session", livemode: false }],
    ["a live session from a test key", { url: PORTAL_URL, livemode: true }],
    ["no URL", { url: null, livemode: false }],
  ])("%s is never returned", async (_name, session) => {
    mocks.create.mockResolvedValueOnce({ id: "bps_2", ...session });
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "BILLING_UNAVAILABLE" });
  });

  test("a Stripe or Convex failure is 503 and logs no detail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("No such customer: cus_own (member@example.test)"), { code: "resource_missing" }));
    expect((await post()).status).toBe(503);
    mocks.action.mockRejectedValueOnce(new Error("convex down"));
    expect((await post()).status).toBe(503);
    expect(log).toHaveBeenCalledWith("membership portal failed", { name: "Error", code: "resource_missing" });
    for (const call of log.mock.calls) expect(JSON.stringify(call)).not.toMatch(/@|cus_own|convex down|No such/);
    log.mockRestore();
  });
});
