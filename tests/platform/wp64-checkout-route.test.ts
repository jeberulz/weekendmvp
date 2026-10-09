// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { verifyMembershipBridge, type MembershipBridgePayload } from "@/lib/membership-bridge";
import { MEMBERSHIP_STRIPE_API_VERSION, priceSpec } from "@/lib/membership/stripe-catalog";
import type { PriceKey } from "@/convex/platform/plans";

// WP64-S3. The checkout route, with Convex and Stripe replaced by fakes.

const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  setAuth: vi.fn(),
  action: vi.fn(),
  stripeArgs: [] as unknown[][],
  retrieve: vi.fn(),
  create: vi.fn(),
  expire: vi.fn(),
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
    prices = { retrieve: mocks.retrieve };
    checkout = { sessions: { create: mocks.create, expire: mocks.expire } };
    constructor(...args: unknown[]) {
      mocks.stripeArgs.push(args);
    }
  },
}));

import { POST } from "@/app/api/platform/membership/checkout/route";
import { MembershipConfigError, clearPriceCache, readMembershipBillingConfig } from "@/app/api/platform/membership/_server";

const SECRET = "membership-bridge-test-secret-0123456789abcdef";
const PRICE_IDS: Record<PriceKey, string> = {
  monthly: "price_monthly1",
  annual: "price_annual1",
  lifetime_t1: "price_lifetimeA",
  lifetime_t2: "price_lifetimeB",
};
const ENV = {
  MEMBERSHIP_BILLING_MODE: "test",
  MEMBERSHIP_TAX_MODE: "managed_payments",
  MEMBERSHIP_BILLING_APP_ORIGIN: "https://www.weekendmvp.app",
  MEMBERSHIP_BILLING_BRIDGE_SECRET: SECRET,
  STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_test_abc123",
  STRIPE_MEMBERSHIP_PRICE_MONTHLY: PRICE_IDS.monthly,
  STRIPE_MEMBERSHIP_PRICE_ANNUAL: PRICE_IDS.annual,
  STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1: PRICE_IDS.lifetime_t1,
  STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2: PRICE_IDS.lifetime_t2,
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  VERCEL_ENV: "",
};
const KEY = "membership:route-test-key-0001";

type Opened = {
  ok: true;
  orderId: string;
  term: "monthly" | "annual" | "lifetime";
  priceKey: PriceKey;
  seatNumber: number | null;
  sessionExpiresAt: number | null;
  checkoutSessionId: string | null;
  stripeCustomerId: string | null;
  email: string;
  supersede: string[];
};

const opened = (overrides: Partial<Opened> = {}): Opened => ({
  ok: true,
  orderId: "order1",
  term: "monthly",
  priceKey: "monthly",
  seatNumber: null,
  sessionExpiresAt: null,
  checkoutSessionId: null,
  stripeCustomerId: null,
  email: "member@example.test",
  supersede: [],
  ...overrides,
});

function stripePrice(priceKey: PriceKey, overrides: Record<string, unknown> = {}) {
  const spec = priceSpec(priceKey);
  return {
    id: PRICE_IDS[priceKey],
    active: true,
    livemode: false,
    currency: "usd",
    unit_amount: spec.unitAmount,
    billing_scheme: "per_unit",
    type: spec.recurring ? "recurring" : "one_time",
    recurring: spec.recurring ? { interval: spec.recurring.interval, interval_count: 1, usage_type: "licensed" } : null,
    lookup_key: spec.lookupKey,
    metadata: { purpose: "weekendmvp_membership_v1", price_key: priceKey },
    tax_behavior: "exclusive",
    ...overrides,
  };
}

const bridgeCalls = () =>
  mocks.action.mock.calls.map(([, signed]) => verifyMembershipBridge(signed.payload, signed.signature, SECRET));

function answer(beginResult: unknown, attachResult: unknown = { attached: true }) {
  mocks.action.mockImplementation(async (_ref: unknown, signed: { payload: string; signature: string }) => {
    const payload: MembershipBridgePayload = verifyMembershipBridge(signed.payload, signed.signature, SECRET);
    return payload.kind === "begin_checkout" ? beginResult : attachResult;
  });
}

const post = (body: unknown) =>
  POST(new Request("https://www.weekendmvp.app/api/platform/membership/checkout", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  mocks.token.mockResolvedValue("member-token");
  mocks.retrieve.mockImplementation(async (id: string) =>
    stripePrice((Object.keys(PRICE_IDS) as PriceKey[]).find((key) => PRICE_IDS[key] === id)!),
  );
  mocks.create.mockResolvedValue({ id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/cs_test_new" });
  mocks.expire.mockResolvedValue({});
  answer(opened());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  mocks.stripeArgs.length = 0;
  clearPriceCache();
});

describe("WP64-S3 checkout route: refusals before Stripe", () => {
  test("no session is 401", async () => {
    mocks.token.mockResolvedValue(undefined);
    const response = await post({ term: "monthly", idempotencyKey: KEY });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: "AUTHENTICATION_REQUIRED" });
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("the body is exactly { term, idempotencyKey }", async () => {
    for (const body of [
      { term: "monthly", idempotencyKey: KEY, amount: 1 },
      { term: "monthly", idempotencyKey: KEY, priceId: "price_x" },
      { term: "weekly", idempotencyKey: KEY },
      { term: "monthly", idempotencyKey: "short" },
      { term: "monthly" },
      ["monthly", KEY],
      null,
    ]) {
      const response = await post(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ ok: false, code: "INVALID_REQUEST" });
    }
    const raw = await POST(new Request("https://x.test", { method: "POST", body: "{not json" }));
    expect(raw.status).toBe(400);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("off, unset or misconfigured billing is 503 and touches nothing", async () => {
    const cases: Array<Record<string, string>> = [
      { MEMBERSHIP_BILLING_MODE: "" },
      { MEMBERSHIP_BILLING_MODE: "off" },
      { MEMBERSHIP_BILLING_MODE: "on" },
      { VERCEL_ENV: "production" },
      { STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_live_abc123" },
      { MEMBERSHIP_BILLING_MODE: "live" },
      { MEMBERSHIP_BILLING_BRIDGE_SECRET: "too-short" },
      { MEMBERSHIP_BILLING_APP_ORIGIN: "http://www.weekendmvp.app" },
      { MEMBERSHIP_BILLING_APP_ORIGIN: "https://www.weekendmvp.app/" },
      { MEMBERSHIP_TAX_MODE: "" },
      { STRIPE_MEMBERSHIP_PRICE_ANNUAL: "" },
      { NEXT_PUBLIC_CONVEX_URL: "" },
    ];
    for (const change of cases) {
      for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
      for (const [name, value] of Object.entries(change)) vi.stubEnv(name, value);
      const response = await post({ term: "monthly", idempotencyKey: KEY });
      expect(response.status, JSON.stringify(change)).toBe(503);
      expect(await response.json()).toEqual({ ok: false, code: "BILLING_UNAVAILABLE" });
    }
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("each misconfiguration names its own reason, and a full test config reads cleanly", () => {
    const code = (change: Record<string, string>) => {
      try {
        readMembershipBillingConfig({ ...ENV, ...change });
        return "ok";
      } catch (error) {
        return error instanceof MembershipConfigError ? error.code : String(error);
      }
    };
    expect(code({ MEMBERSHIP_BILLING_MODE: "" })).toBe("BILLING_OFF");
    expect(code({ MEMBERSHIP_BILLING_MODE: "off" })).toBe("BILLING_OFF");
    expect(code({ MEMBERSHIP_BILLING_MODE: "on" })).toBe("BILLING_MODE_INVALID");
    expect(code({ VERCEL_ENV: "production" })).toBe("TEST_MODE_IN_PRODUCTION");
    expect(code({ STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_live_abc123" })).toBe("KEY_MODE_MISMATCH");
    expect(code({ MEMBERSHIP_BILLING_BRIDGE_SECRET: "x".repeat(31) })).toBe("BRIDGE_NOT_CONFIGURED");
    expect(code({ MEMBERSHIP_BILLING_APP_ORIGIN: "http://www.weekendmvp.app" })).toBe("ORIGIN_INVALID");
    expect(code({ MEMBERSHIP_TAX_MODE: "both" })).toBe("TAX_MODE_INVALID");
    expect(code({ STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2: "prod_x" })).toBe("PRICE_ID_MISSING");
    expect(code({ MEMBERSHIP_BILLING_APP_ORIGIN: "http://localhost:3000" })).toBe("ok");
    expect(code({ MEMBERSHIP_BILLING_MODE: "live", STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_live_abc123" })).toBe("ok");
    expect(code({ MEMBERSHIP_BILLING_MODE: "live", STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_live_abc123", MEMBERSHIP_BILLING_APP_ORIGIN: "http://localhost:3000" })).toBe(
      "ORIGIN_INVALID",
    );
    expect(readMembershipBillingConfig(ENV)).toEqual({
      mode: "test",
      livemode: false,
      stripeKey: "rk_test_abc123",
      bridgeSecret: SECRET,
      appOrigin: "https://www.weekendmvp.app",
      taxMode: "managed_payments",
      priceIds: PRICE_IDS,
    });
  });

  test("Convex refusals pass through with the contract's status, and nothing reaches Stripe", async () => {
    const cases: Array<[unknown, number, unknown]> = [
      [{ ok: false, code: "SOLD_OUT" }, 409, { ok: false, code: "SOLD_OUT" }],
      [{ ok: false, code: "ALREADY_SUBSCRIBED" }, 409, { ok: false, code: "ALREADY_SUBSCRIBED" }],
      [{ ok: false, code: "NOT_YET_ELIGIBLE", opensAt: 1_800_000_000_000 }, 409, { ok: false, code: "NOT_YET_ELIGIBLE", opensAt: 1_800_000_000_000 }],
      [{ ok: false, code: "NOT_YET_ELIGIBLE" }, 409, { ok: false, code: "NOT_YET_ELIGIBLE" }],
      [{ ok: false, code: "RATE_LIMITED" }, 429, { ok: false, code: "RATE_LIMITED" }],
      [{ ok: false, code: "EMAIL_NOT_VERIFIED" }, 403, { ok: false, code: "EMAIL_NOT_VERIFIED" }],
      [{ ok: false, code: "ACCOUNT_REVIEW" }, 403, { ok: false, code: "ACCOUNT_REVIEW" }],
      [{ ok: false, code: "AUTHENTICATION_REQUIRED" }, 401, { ok: false, code: "AUTHENTICATION_REQUIRED" }],
      [{ ok: false, code: "SOMETHING_ELSE" }, 503, { ok: false, code: "BILLING_UNAVAILABLE" }],
      [{ attached: true }, 503, { ok: false, code: "BILLING_UNAVAILABLE" }],
    ];
    for (const [result, status, body] of cases) {
      answer(result);
      const response = await post({ term: "lifetime", idempotencyKey: KEY });
      expect(response.status, JSON.stringify(result)).toBe(status);
      expect(await response.json()).toEqual(body);
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("WP64-S3 checkout route: the Stripe session", () => {
  test("monthly: a Managed Payments subscription session, signed hand-offs, and the URL", async () => {
    const response = await post({ term: "monthly", idempotencyKey: KEY });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_new" });
    expect(mocks.setAuth).toHaveBeenCalledWith("member-token");
    expect(mocks.stripeArgs).toEqual([
      ["rk_test_abc123", { apiVersion: MEMBERSHIP_STRIPE_API_VERSION, maxNetworkRetries: 1, appInfo: { name: "weekendmvp-membership" } }],
    ]);
    expect(mocks.retrieve).toHaveBeenCalledWith(PRICE_IDS.monthly);
    const [params, options] = mocks.create.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: "membership-checkout:order1" });
    const metadata = { purpose: "weekendmvp_membership_v1", order_id: "order1", term: "monthly" };
    expect(params).toEqual({
      mode: "subscription",
      line_items: [{ price: PRICE_IDS.monthly, quantity: 1 }],
      success_url: "https://www.weekendmvp.app/dashboard/billing?checkout=return",
      cancel_url: "https://www.weekendmvp.app/dashboard/billing?checkout=cancelled",
      client_reference_id: "order1",
      metadata,
      allow_promotion_codes: true,
      subscription_data: { metadata },
      customer_email: "member@example.test",
      consent_collection: { terms_of_service: "required" },
      managed_payments: { enabled: true },
    });
    // The hand-offs carry the term, key and mode, then the session. Never an owner or an email.
    expect(bridgeCalls()).toEqual([
      { kind: "begin_checkout", term: "monthly", idempotencyKey: KEY, livemode: false },
      { kind: "attach_session", orderId: "order1", checkoutSessionId: "cs_test_new" },
    ]);
    for (const [, signed] of mocks.action.mock.calls) expect(signed.payload).not.toContain("@");
  });

  test("lifetime: a one-time payment that closes with the seat hold, priced by the seat's tranche", async () => {
    answer(opened({ term: "lifetime", priceKey: "lifetime_t2", seatNumber: 16, sessionExpiresAt: 1_800_000_123_456, stripeCustomerId: "cus_1" }));
    const response = await post({ term: "lifetime", idempotencyKey: KEY });
    expect(response.status).toBe(200);
    const [params] = mocks.create.mock.calls[0];
    expect(params).toMatchObject({
      mode: "payment",
      line_items: [{ price: PRICE_IDS.lifetime_t2, quantity: 1 }],
      payment_intent_data: { metadata: { purpose: "weekendmvp_membership_v1", order_id: "order1", term: "lifetime" } },
      customer: "cus_1",
      expires_at: 1_800_000_123,
      managed_payments: { enabled: true },
    });
    expect(params).not.toHaveProperty("subscription_data");
    expect(params).not.toHaveProperty("customer_email");
    expect(mocks.retrieve).toHaveBeenCalledWith(PRICE_IDS.lifetime_t2);
  });

  test("a new lifetime buyer without a customer gets one created", async () => {
    answer(opened({ term: "lifetime", priceKey: "lifetime_t1", seatNumber: 1, sessionExpiresAt: 1_800_000_000_000 }));
    await post({ term: "lifetime", idempotencyKey: KEY });
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ customer_email: "member@example.test", customer_creation: "always" });
  });

  test("Managed Payments never sends what Stripe rejects for it", async () => {
    await post({ term: "annual", idempotencyKey: KEY });
    const [params] = mocks.create.mock.calls[0];
    for (const field of [
      "custom_text",
      "automatic_tax",
      "tax_id_collection",
      "billing_address_collection",
      "payment_method_types",
      "payment_method_configuration",
      "customer_update",
      "invoice_creation",
      "adaptive_pricing",
      "ui_mode",
    ]) {
      expect(params, field).not.toHaveProperty(field);
    }
  });

  test("every session lets the member enter a promotion code on Stripe's page, under either tax mode", async () => {
    // Ruling "WP64 / promotion codes". The sandbox accepted it with Managed Payments on (2026-10-09).
    await post({ term: "annual", idempotencyKey: KEY });
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ allow_promotion_codes: true, managed_payments: { enabled: true } });
    answer(opened({ term: "lifetime", priceKey: "lifetime_t1", seatNumber: 1, sessionExpiresAt: 1_800_000_000_000 }));
    await post({ term: "lifetime", idempotencyKey: KEY });
    expect(mocks.create.mock.calls[1][0]).toMatchObject({ allow_promotion_codes: true, mode: "payment" });
    vi.stubEnv("MEMBERSHIP_TAX_MODE", "automatic_tax");
    answer(opened({ stripeCustomerId: "cus_2" }));
    await post({ term: "monthly", idempotencyKey: KEY });
    expect(mocks.create.mock.calls[2][0]).toMatchObject({ allow_promotion_codes: true });
    // A code is chosen on Stripe's page. The session never carries one of ours.
    for (const [params] of mocks.create.mock.calls) expect(params).not.toHaveProperty("discounts");
  });

  test("the Stripe Tax fallback adds tax, the address and the consent sentence instead", async () => {
    vi.stubEnv("MEMBERSHIP_TAX_MODE", "automatic_tax");
    answer(opened({ stripeCustomerId: "cus_2" }));
    await post({ term: "monthly", idempotencyKey: KEY });
    const [params] = mocks.create.mock.calls[0];
    expect(params).not.toHaveProperty("managed_payments");
    expect(params).toMatchObject({
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      consent_collection: { terms_of_service: "required" },
    });
    expect(params.custom_text.terms_of_service_acceptance.message).toContain("$29 a month, renewing every month");
  });

  test("a price that differs from PRICING stops checkout before a session exists", async () => {
    for (const overrides of [{ unit_amount: 1_900 }, { currency: "gbp" }, { active: false }, { livemode: true }, { tax_behavior: "inclusive" }]) {
      clearPriceCache();
      mocks.retrieve.mockResolvedValueOnce(stripePrice("monthly", overrides));
      const response = await post({ term: "monthly", idempotencyKey: KEY });
      expect(response.status, JSON.stringify(overrides)).toBe(503);
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("the price is read once per five minutes", async () => {
    await post({ term: "monthly", idempotencyKey: KEY });
    await post({ term: "monthly", idempotencyKey: KEY });
    expect(mocks.retrieve).toHaveBeenCalledTimes(1);
  });

  test("a session from the wrong mode or host is never returned or attached", async () => {
    for (const session of [
      { id: "cs_live_x", url: "https://checkout.stripe.com/c/pay/cs_live_x" },
      { id: "cs_test_x", url: "https://evil.example/c/pay/cs_test_x" },
      { id: "cs_test_x", url: "https://billing.stripe.com/p/session" },
      { id: "cs_test_x", url: null },
    ]) {
      mocks.create.mockResolvedValueOnce(session);
      const response = await post({ term: "monthly", idempotencyKey: KEY });
      expect(response.status, JSON.stringify(session)).toBe(503);
    }
    expect(bridgeCalls().filter((call) => call.kind === "attach_session")).toEqual([]);
  });

  test("a replay with the session already attached skips the hand-off", async () => {
    answer(opened({ checkoutSessionId: "cs_test_new" }));
    const response = await post({ term: "monthly", idempotencyKey: KEY });
    expect(response.status).toBe(200);
    expect(bridgeCalls().map((call) => call.kind)).toEqual(["begin_checkout"]);
  });

  test("older open sessions are expired; one that refuses does not fail the request", async () => {
    answer(opened({ supersede: ["cs_test_old1", "cs_test_old2", "cs_test_new"] }));
    mocks.expire.mockRejectedValueOnce(new Error("already complete"));
    const response = await post({ term: "monthly", idempotencyKey: KEY });
    expect(response.status).toBe(200);
    expect(mocks.expire.mock.calls.map(([id]) => id)).toEqual(["cs_test_old1", "cs_test_old2"]);
  });

  test("a Stripe or Convex failure is a plain 503, with no detail", async () => {
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("Card declined for member@example.test"), { code: "boom" }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post({ term: "monthly", idempotencyKey: KEY });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "BILLING_UNAVAILABLE" });
    expect(JSON.stringify(errors.mock.calls)).not.toContain("@");
    answer(opened(), { ok: false, code: "INVALID_REQUEST" });
    const refusedAttach = await post({ term: "monthly", idempotencyKey: KEY });
    expect(refusedAttach.status).toBe(400);
    mocks.action.mockRejectedValueOnce(new Error("network"));
    expect((await post({ term: "monthly", idempotencyKey: KEY })).status).toBe(503);
    errors.mockRestore();
  });
});
