// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import { MembershipBridgeError, verifyMembershipBridge } from "@/lib/membership-bridge";
import { MEMBERSHIP_STRIPE_API_VERSION, priceSpec } from "@/lib/membership/stripe-catalog";
import type { PriceKey } from "@/convex/platform/plans";

// WP64-S5. The Billing Portal route, with Convex and Stripe replaced by fakes.
// Plan changes: `{ switchTo }` opens Stripe's confirmation for one switch.

const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  setAuth: vi.fn(),
  action: vi.fn(),
  stripeArgs: [] as unknown[][],
  create: vi.fn(),
  price: vi.fn(),
  subscription: vi.fn(),
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
    prices = { retrieve: mocks.price };
    subscriptions = { retrieve: mocks.subscription };
    constructor(...args: unknown[]) {
      mocks.stripeArgs.push(args);
    }
  },
}));

import { POST } from "@/app/api/platform/membership/portal/route";
import { clearPriceCache } from "@/app/api/platform/membership/_server";

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
const PRICE_IDS = { monthly: "price_monthly1", annual: "price_annual1" } as const;
const RETURN_URL = "https://www.weekendmvp.app/dashboard/billing";

function stripePrice(priceKey: PriceKey) {
  const spec = priceSpec(priceKey);
  return {
    id: PRICE_IDS[priceKey as keyof typeof PRICE_IDS],
    active: true,
    livemode: false,
    currency: "usd",
    unit_amount: spec.unitAmount,
    billing_scheme: "per_unit",
    type: "recurring",
    recurring: spec.recurring ? { interval: spec.recurring.interval, interval_count: 1, usage_type: "licensed" } : null,
    lookup_key: spec.lookupKey,
    metadata: { purpose: "weekendmvp_membership_v1", price_key: priceKey },
    tax_behavior: "exclusive",
  };
}

/** The member's own active monthly subscription, as Stripe returns it. */
function subscription(overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    id: "sub_own",
    customer: "cus_own",
    status: "active",
    livemode: false,
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    metadata: { purpose: "weekendmvp_membership_v1", order_id: "order_1" },
    items: { data: [{ id: "si_own", quantity: 1, price: { id: PRICE_IDS.monthly }, ...item }] },
    ...overrides,
  };
}

// Requests arrive on another host (a preview, a proxy): the return address still comes from config.
const post = (body = "{}") =>
  POST(new Request("https://preview-host.example.test/api/platform/membership/portal", { method: "POST", body }));
const bridgeCalls = () =>
  mocks.action.mock.calls.map(([, signed]) => verifyMembershipBridge(signed.payload, signed.signature, SECRET));

beforeEach(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  mocks.token.mockResolvedValue("member-token");
  mocks.action.mockResolvedValue({ customerId: "cus_own", subscriptionId: "sub_own" });
  mocks.create.mockResolvedValue({ id: "bps_1", url: PORTAL_URL, livemode: false });
  mocks.price.mockImplementation(async (id: string) => stripePrice(id === PRICE_IDS.annual ? "annual" : "monthly"));
  mocks.subscription.mockResolvedValue(subscription());
  clearPriceCache();
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

describe("plan switch: Stripe's confirmation for the member's own subscription", () => {
  const confirm = (to: "monthly" | "annual", item = "si_own") => ({
    customer: "cus_own",
    return_url: RETURN_URL,
    flow_data: {
      type: "subscription_update_confirm",
      subscription_update_confirm: { subscription: "sub_own", items: [{ id: item, price: PRICE_IDS[to], quantity: 1 }] },
      after_completion: { type: "redirect", redirect: { return_url: RETURN_URL } },
    },
  });

  test("monthly to annual names the configured annual Price and returns to Plan and billing", async () => {
    const response = await post('{"switchTo":"annual"}');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, url: PORTAL_URL });
    expect(bridgeCalls()).toEqual([{ kind: "open_portal", livemode: false }]);
    expect(mocks.price).toHaveBeenCalledWith(PRICE_IDS.annual);
    expect(mocks.subscription).toHaveBeenCalledWith("sub_own");
    expect(mocks.create).toHaveBeenCalledWith(confirm("annual"));
  });

  test("annual to monthly the same way; the portal configuration times it for the renewal", async () => {
    mocks.subscription.mockResolvedValueOnce(subscription({}, { id: "si_year", price: { id: PRICE_IDS.annual } }));
    expect((await post('{"switchTo":"monthly"}')).status).toBe(200);
    expect(mocks.price).toHaveBeenCalledWith(PRICE_IDS.monthly);
    expect(mocks.create).toHaveBeenCalledWith(confirm("monthly", "si_year"));
  });

  test("a customer object instead of an id is read the same way", async () => {
    mocks.subscription.mockResolvedValueOnce(subscription({ customer: { id: "cus_own" } }));
    expect((await post('{"switchTo":"annual"}')).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(confirm("annual"));
  });

  test.each([
    ['{"switchTo":"lifetime"}'],
    ['{"switchTo":"ANNUAL"}'],
    ['{"switchTo":null}'],
    ['{"switchTo":["annual"]}'],
    ['{"switchTo":"annual","price":"price_other"}'],
    ['{"switchTo":"annual","subscription":"sub_other"}'],
    ['{"term":"annual"}'],
  ])("the body %s is refused before Convex or Stripe", async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "INVALID_REQUEST" });
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.subscription).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test.each([
    ["another customer's subscription", subscription({ customer: "cus_other" })],
    ["a subscription with no customer", subscription({ customer: null })],
    ["a subscription that is not ours", subscription({ metadata: { purpose: "something_else" } })],
    ["a subscription with no metadata", subscription({ metadata: null })],
    ["a live subscription from a test deployment", subscription({ livemode: true })],
    ["two items", subscription({ items: { data: [subscription().items.data[0], { id: "si_two", quantity: 1, price: { id: PRICE_IDS.monthly } }] } })],
    ["no items", subscription({ items: { data: [] } })],
    ["two seats", subscription({}, { quantity: 2 })],
  ])("%s is refused and opens nothing", async (_name, found) => {
    mocks.subscription.mockResolvedValueOnce(found);
    const response = await post('{"switchTo":"annual"}');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "INVALID_REQUEST" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test.each([
    ["past due", subscription({ status: "past_due" })],
    ["trialing", subscription({ status: "trialing" })],
    ["set to cancel", subscription({ cancel_at_period_end: true })],
    ["given a cancel date", subscription({ cancel_at: 1_900_000_000 })],
    ["with a switch already scheduled", subscription({ schedule: "sub_sched_1" })],
    ["already annual", subscription({}, { price: { id: PRICE_IDS.annual } })],
    ["on a Price we no longer list", subscription({}, { price: { id: "price_retired" } })],
  ])("a subscription %s opens the portal home, which shows what is set", async (_name, found) => {
    mocks.subscription.mockResolvedValueOnce(found);
    expect((await post('{"switchTo":"annual"}')).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({ customer: "cus_own", return_url: RETURN_URL });
  });

  test("a Convex answer without a subscription id never reaches Stripe's subscriptions", async () => {
    for (const answer of [{ customerId: "cus_own" }, { customerId: "cus_own", subscriptionId: "" }, { customerId: "cus_own", subscriptionId: "cus_own" }]) {
      mocks.action.mockResolvedValueOnce(answer);
      const response = await post('{"switchTo":"annual"}');
      expect(response.status).toBe(400);
    }
    expect(mocks.price).not.toHaveBeenCalled();
    expect(mocks.subscription).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("a Price that no longer matches the catalog is unavailable, not a switch", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.price.mockResolvedValueOnce({ ...stripePrice("annual"), unit_amount: 1_900 });
    const response = await post('{"switchTo":"annual"}');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "BILLING_UNAVAILABLE" });
    expect(mocks.subscription).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test("Convex's refusals still pass through before any Stripe read", async () => {
    mocks.action.mockResolvedValueOnce({ ok: false, code: "INVALID_REQUEST" });
    expect((await post('{"switchTo":"annual"}')).status).toBe(400);
    mocks.action.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED" });
    expect((await post('{"switchTo":"annual"}')).status).toBe(429);
    expect(mocks.price).not.toHaveBeenCalled();
    expect(mocks.subscription).not.toHaveBeenCalled();
  });

  test("a failed subscription read is 503 and logs no detail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.subscription.mockRejectedValueOnce(Object.assign(new Error("No such subscription: sub_own"), { type: "StripeInvalidRequestError", code: "resource_missing" }));
    expect((await post('{"switchTo":"annual"}')).status).toBe(503);
    for (const call of log.mock.calls) expect(JSON.stringify(call)).not.toMatch(/sub_own|No such/);
    log.mockRestore();
  });
});

describe("cancel: Stripe's cancel confirmation for the member's own subscription", () => {
  const cancelSession = (subscriptionId = "sub_own") => ({
    customer: "cus_own",
    return_url: RETURN_URL,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: { subscription: subscriptionId },
      after_completion: { type: "redirect", redirect: { return_url: `${RETURN_URL}?plan=cancelled` } },
    },
  });

  test("an active plan opens Stripe's cancel page, returning with ?plan=cancelled", async () => {
    const response = await post('{"cancel":true}');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, url: PORTAL_URL });
    expect(bridgeCalls()).toEqual([{ kind: "open_portal", livemode: false }]);
    expect(mocks.subscription).toHaveBeenCalledWith("sub_own");
    expect(mocks.price).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(cancelSession());
  });

  test("a past-due plan can be cancelled too, and so can an annual one or one with two seats", async () => {
    for (const found of [
      subscription({ status: "past_due" }),
      subscription({}, { price: { id: PRICE_IDS.annual } }),
      subscription({}, { quantity: 2 }),
    ]) {
      mocks.subscription.mockResolvedValueOnce(found);
      expect((await post('{"cancel":true}')).status).toBe(200);
    }
    expect(mocks.create.mock.calls.map(([params]) => params)).toEqual([cancelSession(), cancelSession(), cancelSession()]);
  });

  test.each([['{"cancel":false}'], ['{"cancel":"true"}'], ['{"cancel":1}'], ['{"cancel":true,"switchTo":"annual"}'], ['{"cancel":true,"subscription":"sub_other"}']])(
    "the body %s is refused before Convex or Stripe",
    async (body) => {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(mocks.action).not.toHaveBeenCalled();
      expect(mocks.subscription).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["another customer's subscription", subscription({ customer: "cus_other" })],
    ["a subscription that is not ours", subscription({ metadata: { purpose: "something_else" } })],
    ["a live subscription from a test deployment", subscription({ livemode: true })],
  ])("%s is refused and opens nothing", async (_name, found) => {
    mocks.subscription.mockResolvedValueOnce(found);
    const response = await post('{"cancel":true}');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "INVALID_REQUEST" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test.each([
    ["already set to cancel", subscription({ cancel_at_period_end: true })],
    ["given a cancel date", subscription({ cancel_at: 1_900_000_000 })],
    ["with a switch scheduled", subscription({ schedule: "sub_sched_1" })],
    ["unpaid", subscription({ status: "unpaid" })],
    ["already canceled", subscription({ status: "canceled" })],
  ])("a subscription %s opens the portal home, which can renew it or shows what is set", async (_name, found) => {
    mocks.subscription.mockResolvedValueOnce(found);
    expect((await post('{"cancel":true}')).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({ customer: "cus_own", return_url: RETURN_URL });
  });

  test("a Convex answer without a subscription id never reaches Stripe's subscriptions", async () => {
    mocks.action.mockResolvedValueOnce({ customerId: "cus_own" });
    expect((await post('{"cancel":true}')).status).toBe(400);
    expect(mocks.subscription).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("a refused deep link falls back to the portal home", () => {
  const refusal = () =>
    Object.assign(new Error("This subscription cannot be canceled: sub_own (member@example.test)"), {
      type: "StripeInvalidRequestError",
      code: "parameter_invalid",
    });

  test.each([['{"cancel":true}'], ['{"switchTo":"annual"}']])(
    "%s: Stripe refuses the page, so the member lands on the portal home and can act there",
    async (body) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.create.mockRejectedValueOnce(refusal());
      const response = await post(body);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, url: PORTAL_URL });
      expect(mocks.create).toHaveBeenCalledTimes(2);
      expect(mocks.create.mock.calls[0][0]).toHaveProperty("flow_data");
      expect(mocks.create.mock.calls[1][0]).toEqual({ customer: "cus_own", return_url: RETURN_URL });
      expect(warn).toHaveBeenCalledWith("membership portal flow refused", { name: "StripeInvalidRequestError", code: "parameter_invalid" });
      for (const call of warn.mock.calls) expect(JSON.stringify(call)).not.toMatch(/@|sub_own|cannot be/);
      warn.mockRestore();
    },
  );

  test("any other failure is unavailable, not a fallback", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("rate limited"), { type: "StripeRateLimitError" }));
    expect((await post('{"cancel":true}')).status).toBe(503);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  test("the plain portal is never retried: a refusal there is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValueOnce(refusal());
    expect((await post("{}")).status).toBe(503);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  test("a fallback that also fails is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValueOnce(refusal()).mockRejectedValueOnce(refusal());
    expect((await post('{"cancel":true}')).status).toBe(503);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    log.mockRestore();
  });
});
