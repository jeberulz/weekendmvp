// @vitest-environment node
import type StripeType from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  MEMBERSHIP_BRIDGE_MAX_AGE_MS,
  MembershipBridgeError,
  membershipBridgeFresh,
  signMembershipBridge,
  verifyMembershipBridge,
  type MembershipBridgePayload,
} from "@/lib/membership-bridge";
import { createHmac } from "node:crypto";
import type { FollowUp } from "@/convex/platform/membership/events";

// WP64-S4. The webhook and reconcile routes, with Convex and the Stripe API
// replaced by fakes. Signatures use Stripe's real webhook code.

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  stripeArgs: [] as unknown[][],
  sessionRetrieve: vi.fn(),
  subscriptionRetrieve: vi.fn(),
  subscriptionList: vi.fn(),
  subscriptionCancel: vi.fn(),
  subscriptionUpdate: vi.fn(),
  chargeRetrieve: vi.fn(),
  disputeRetrieve: vi.fn(),
  intentRetrieve: vi.fn(),
  invoicePaymentList: vi.fn(),
  invoiceRetrieve: vi.fn(),
  refundCreate: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = mocks.action;
  },
}));
vi.mock("stripe", async () => {
  const actual = await vi.importActual<{ default: typeof StripeType }>("stripe");
  const webhooks = new actual.default("sk_test_fake").webhooks;
  return {
    default: class {
      webhooks = webhooks;
      checkout = { sessions: { retrieve: mocks.sessionRetrieve } };
      subscriptions = {
        retrieve: mocks.subscriptionRetrieve,
        list: mocks.subscriptionList,
        cancel: mocks.subscriptionCancel,
        update: mocks.subscriptionUpdate,
      };
      charges = { retrieve: mocks.chargeRetrieve };
      disputes = { retrieve: mocks.disputeRetrieve };
      paymentIntents = { retrieve: mocks.intentRetrieve };
      invoicePayments = { list: mocks.invoicePaymentList };
      invoices = { retrieve: mocks.invoiceRetrieve };
      refunds = { create: mocks.refundCreate };
      constructor(...args: unknown[]) {
        mocks.stripeArgs.push(args);
      }
    },
  };
});

import { POST } from "@/app/api/platform/membership/webhook/route";
import { GET, RECONCILE_LIMIT } from "@/app/api/platform/membership/reconcile/route";
import { MembershipConfigError, readMembershipWebhookConfig } from "@/app/api/platform/membership/_server";
import { MEMBERSHIP_STRIPE_API_VERSION, MEMBERSHIP_WEBHOOK_EVENTS } from "@/lib/membership/stripe-catalog";

const actualStripe = await vi.importActual<{ default: typeof StripeType }>("stripe");
const signer = new actualStripe.default("sk_test_fake").webhooks;

const BRIDGE = "membership-bridge-test-secret-0123456789abcdef";
const WHSEC = ["whsec", "routetest0123456789"].join("_");
const CRON = "cron-secret-for-tests-0123456789";
const PURPOSE = "weekendmvp_membership_v1";
const ENV = {
  MEMBERSHIP_BILLING_MODE: "test",
  MEMBERSHIP_BILLING_BRIDGE_SECRET: BRIDGE,
  STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_test_abc123",
  STRIPE_MEMBERSHIP_WEBHOOK_SECRET: WHSEC,
  STRIPE_MEMBERSHIP_PRICE_MONTHLY: "price_monthly1",
  STRIPE_MEMBERSHIP_PRICE_ANNUAL: "price_annual1",
  STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1: "price_lifetimeA",
  STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2: "price_lifetimeB",
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  VERCEL_ENV: "",
  CRON_SECRET: CRON,
};
const NOW = 1_800_000_000_000;

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_one",
    customer: "cus_one",
    metadata: { purpose: PURPOSE, order_id: "order1", term: "monthly" },
    status: "active",
    items: { data: [{ price: { id: "price_monthly1" }, quantity: 1, current_period_end: 1_900_000_000 }] },
    cancel_at_period_end: false,
    cancel_at: null,
    ended_at: null,
    latest_invoice: "in_latest",
    ...overrides,
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_one",
    mode: "subscription",
    metadata: { purpose: PURPOSE, order_id: "order1", term: "monthly" },
    client_reference_id: "order1",
    status: "complete",
    payment_status: "paid",
    customer: "cus_one",
    payment_intent: null,
    subscription: "sub_one",
    amount_total: 3480,
    currency: "usd",
    line_items: { data: [{ price: { id: "price_monthly1" }, quantity: 1 }] },
    ...overrides,
  };
}

let ids = 0;
function stripeEvent(type: string, object: Record<string, unknown>, livemode = false) {
  ids += 1;
  return { id: `evt_${ids}`, object: "event", type, livemode, created: 1, data: { object } };
}

function deliver(event: unknown, secret = WHSEC) {
  const payload = JSON.stringify(event);
  const header = signer.generateTestHeaderString({ payload, secret });
  return POST(
    new Request("https://www.weekendmvp.app/api/platform/membership/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": header },
    }),
  );
}

const bridgeCalls = (): MembershipBridgePayload[] =>
  mocks.action.mock.calls.map(([, signed]) => verifyMembershipBridge(signed.payload, signed.signature, BRIDGE));
const settledEvents = () =>
  bridgeCalls().flatMap((payload) => (payload.kind === "event" ? [payload.event as Record<string, unknown>] : []));

function settleWith(actions: FollowUp[] = []) {
  mocks.action.mockImplementation(async (_ref: unknown, signed: { payload: string; signature: string }) => {
    const payload = verifyMembershipBridge(signed.payload, signed.signature, BRIDGE);
    if (payload.kind === "event") return { outcome: "applied", duplicate: false, actions };
    if (payload.kind === "subscription_snapshot") return { outcome: "applied", actions };
    if (payload.kind === "release_expired_holds") return { released: 2 };
    if (payload.kind === "running_subscriptions") return { ids: ["sub_one", "sub_gone", "sub_alien"], capped: false };
    throw new Error("unexpected bridge call");
  });
}

function pages<T>(items: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  settleWith();
  mocks.sessionRetrieve.mockResolvedValue(session());
  mocks.subscriptionRetrieve.mockImplementation(async (id: string) => subscription({ id }));
  mocks.subscriptionList.mockReturnValue(pages([]));
  mocks.subscriptionCancel.mockResolvedValue({});
  mocks.subscriptionUpdate.mockResolvedValue({});
  mocks.refundCreate.mockResolvedValue({});
  mocks.intentRetrieve.mockResolvedValue({ id: "pi_one", metadata: {}, status: "succeeded", latest_charge: { refunded: false, disputed: false } });
  mocks.invoicePaymentList.mockResolvedValue({ data: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  mocks.stripeArgs.length = 0;
});

describe("WP64-S4 webhook configuration", () => {
  test("the key prefix sets the mode; a set mode must agree; off still settles", () => {
    expect(readMembershipWebhookConfig(ENV)).toMatchObject({ livemode: false, webhookSecret: WHSEC });
    expect(readMembershipWebhookConfig({ ...ENV, MEMBERSHIP_BILLING_MODE: "off" }).livemode).toBe(false);
    expect(readMembershipWebhookConfig({ ...ENV, MEMBERSHIP_BILLING_MODE: undefined }).livemode).toBe(false);
    expect(
      readMembershipWebhookConfig({ ...ENV, MEMBERSHIP_BILLING_MODE: "live", STRIPE_MEMBERSHIP_RESTRICTED_KEY: "rk_live_abc", VERCEL_ENV: "production" })
        .livemode,
    ).toBe(true);
    expect(readMembershipWebhookConfig(ENV).priceKeys).toEqual({
      price_monthly1: "monthly",
      price_annual1: "annual",
      price_lifetimeA: "lifetime_t1",
      price_lifetimeB: "lifetime_t2",
    });
  });

  test.each([
    [{ MEMBERSHIP_BILLING_MODE: "on" }, "BILLING_MODE_INVALID"],
    [{ MEMBERSHIP_BILLING_MODE: "live" }, "KEY_MODE_MISMATCH"],
    [{ STRIPE_MEMBERSHIP_RESTRICTED_KEY: "pk_test_abc" }, "KEY_MODE_MISMATCH"],
    [{ STRIPE_MEMBERSHIP_RESTRICTED_KEY: undefined }, "KEY_MODE_MISMATCH"],
    [{ MEMBERSHIP_BILLING_MODE: "off", VERCEL_ENV: "production" }, "TEST_MODE_IN_PRODUCTION"],
    [{ STRIPE_MEMBERSHIP_WEBHOOK_SECRET: "secret" }, "WEBHOOK_NOT_CONFIGURED"],
    [{ MEMBERSHIP_BILLING_BRIDGE_SECRET: "short" }, "BRIDGE_NOT_CONFIGURED"],
    [{ STRIPE_MEMBERSHIP_PRICE_ANNUAL: "" }, "PRICE_ID_MISSING"],
    [{ STRIPE_MEMBERSHIP_PRICE_ANNUAL: "price_monthly1" }, "PRICE_ID_MISSING"],
  ])("%o fails closed with %s", (change, code) => {
    let thrown: unknown;
    try {
      readMembershipWebhookConfig({ ...ENV, ...change });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MembershipConfigError);
    expect((thrown as MembershipConfigError).code).toBe(code);
  });
});

describe("WP64-S4 webhook route: requests that never reach settlement", () => {
  test("unconfigured is 503 and calls nothing", async () => {
    vi.stubEnv("STRIPE_MEMBERSHIP_WEBHOOK_SECRET", "");
    const response = await deliver(stripeEvent("checkout.session.completed", { id: "cs_test_one" }));
    expect(response.status).toBe(503);
    expect(mocks.sessionRetrieve).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("a missing or wrong signature is 400 with no fetch and no write", async () => {
    const missing = await POST(new Request("https://x.test/webhook", { method: "POST", body: "{}" }));
    expect(missing.status).toBe(400);
    const forged = await deliver(stripeEvent("checkout.session.completed", { id: "cs_test_one" }), ["whsec", "forged"].join("_"));
    expect(forged.status).toBe(400);
    expect(mocks.sessionRetrieve).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("a live event at a test endpoint is 400", async () => {
    const response = await deliver(stripeEvent("checkout.session.completed", { id: "cs_test_one" }, true));
    expect(response.status).toBe(400);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("an event type we do not handle is 200 with no fetch", async () => {
    const response = await deliver(stripeEvent("customer.created", { id: "cus_one" }));
    expect(response.status).toBe(200);
    expect(mocks.sessionRetrieve).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("another purpose, or no order id, is 200 with no write", async () => {
    mocks.sessionRetrieve.mockResolvedValueOnce(session({ metadata: { purpose: "weekendmvp_credits_v1" } }));
    expect((await deliver(stripeEvent("checkout.session.completed", { id: "cs_test_one" }))).status).toBe(200);
    mocks.sessionRetrieve.mockResolvedValueOnce(session({ metadata: { purpose: PURPOSE }, client_reference_id: null }));
    expect((await deliver(stripeEvent("checkout.session.completed", { id: "cs_test_one" }))).status).toBe(200);
    mocks.subscriptionRetrieve.mockResolvedValueOnce(subscription({ metadata: {} }));
    expect((await deliver(stripeEvent("customer.subscription.updated", { id: "sub_x" }))).status).toBe(200);
    mocks.invoiceRetrieve.mockResolvedValueOnce({ id: "in_1", parent: null });
    expect((await deliver(stripeEvent("invoice.paid", { id: "in_1" }))).status).toBe(200);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("an oversized body is 400 even when it is signed", async () => {
    const big = stripeEvent("customer.created", { id: "cus_one", pad: "x".repeat(512 * 1024) });
    expect((await deliver(big)).status).toBe(400);
    const small = stripeEvent("customer.created", { id: "cus_one", pad: "x".repeat(1024) });
    expect((await deliver(small)).status).toBe(200);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("the client pins the API version", async () => {
    await deliver(stripeEvent("customer.created", { id: "cus_one" }));
    expect(mocks.stripeArgs[0]).toEqual([
      "rk_test_abc123",
      expect.objectContaining({ apiVersion: MEMBERSHIP_STRIPE_API_VERSION, maxNetworkRetries: 1 }),
    ]);
  });

  test("the handled list is the catalog's twelve events", () => {
    expect(MEMBERSHIP_WEBHOOK_EVENTS).toHaveLength(12);
  });
});

describe("WP64-S4 webhook route: thin event, fat fetch", () => {
  test("a subscription checkout sends the current session and subscription, in milliseconds", async () => {
    const event = stripeEvent("checkout.session.completed", { id: "cs_test_one", payment_status: "unpaid" });
    const response = await deliver(event);
    expect(response.status).toBe(200);
    expect(mocks.sessionRetrieve).toHaveBeenCalledWith("cs_test_one", { expand: ["line_items"] });
    expect(settledEvents()).toEqual([
      {
        kind: "checkout",
        eventId: event.id,
        eventType: "checkout.session.completed",
        livemode: false,
        orderId: "order1",
        sessionId: "cs_test_one",
        status: "complete",
        paymentStatus: "paid",
        failed: false,
        customerId: "cus_one",
        paymentIntentId: null,
        priceKey: "monthly",
        quantity: 1,
        amountTotal: 3480,
        currency: "usd",
        subscription: {
          subscriptionId: "sub_one",
          customerId: "cus_one",
          orderId: "order1",
          status: "active",
          priceKey: "monthly",
          quantity: 1,
          currentPeriodEnd: 1_900_000_000_000,
          cancelAtPeriodEnd: false,
          endedAt: null,
          snapshotAt: NOW,
        },
      },
    ]);
    expect(bridgeCalls()[0]).toMatchObject({ kind: "event", issuedAt: NOW });
  });

  test("a lifetime checkout carries the payment id; async failure is marked; an unknown Price maps to null", async () => {
    mocks.sessionRetrieve.mockResolvedValueOnce(
      session({
        mode: "payment",
        subscription: null,
        payment_intent: "pi_life",
        line_items: { data: [{ price: { id: "price_other" }, quantity: 1 }] },
      }),
    );
    await deliver(stripeEvent("checkout.session.async_payment_failed", { id: "cs_test_one" }));
    expect(settledEvents()[0]).toMatchObject({ failed: true, paymentIntentId: "pi_life", priceKey: null, subscription: null });
    expect(mocks.subscriptionRetrieve).not.toHaveBeenCalled();
  });

  test("two line items are never one Price", async () => {
    mocks.sessionRetrieve.mockResolvedValueOnce(
      session({ line_items: { data: [{ price: { id: "price_monthly1" }, quantity: 1 }, { price: { id: "price_annual1" }, quantity: 1 }] } }),
    );
    await deliver(stripeEvent("checkout.session.completed", { id: "cs_test_one" }));
    expect(settledEvents()[0]).toMatchObject({ priceKey: null, quantity: 0 });
  });

  test("subscription events send a fresh snapshot; a cancel date counts as ending", async () => {
    mocks.subscriptionRetrieve.mockResolvedValueOnce(subscription({ status: "past_due", cancel_at: 1_950_000_000, ended_at: null }));
    await deliver(stripeEvent("customer.subscription.updated", { id: "sub_one", status: "active" }));
    expect(settledEvents()[0]).toMatchObject({
      kind: "subscription",
      subscription: { status: "past_due", cancelAtPeriodEnd: true, snapshotAt: NOW },
    });
    mocks.subscriptionRetrieve.mockResolvedValueOnce(subscription({ status: "canceled", ended_at: 1_960_000_000 }));
    await deliver(stripeEvent("customer.subscription.deleted", { id: "sub_one" }));
    expect(settledEvents()[1]).toMatchObject({ subscription: { status: "canceled", endedAt: 1_960_000_000_000 } });
  });

  test("a subscription with two items is never one Price", async () => {
    mocks.subscriptionRetrieve.mockResolvedValueOnce(
      subscription({
        items: {
          data: [
            { price: { id: "price_monthly1" }, quantity: 1, current_period_end: 1_900_000_000 },
            { price: { id: "price_annual1" }, quantity: 1, current_period_end: 1_900_000_000 },
          ],
        },
      }),
    );
    await deliver(stripeEvent("customer.subscription.created", { id: "sub_one" }));
    expect(settledEvents()[0]).toMatchObject({ subscription: { priceKey: null, quantity: 0, currentPeriodEnd: null } });
  });

  test("an invoice is re-read and reaches its subscription through parent.subscription_details", async () => {
    mocks.invoiceRetrieve.mockResolvedValueOnce({
      id: "in_1",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_one", metadata: {} } },
    });
    // An endpoint on an older API version sends `subscription` at the top level instead. It is never read.
    await deliver(stripeEvent("invoice.payment_failed", { id: "in_1", subscription: "sub_old_shape" }));
    expect(mocks.invoiceRetrieve).toHaveBeenCalledWith("in_1");
    expect(mocks.subscriptionRetrieve).toHaveBeenCalledWith("sub_one");
    expect(settledEvents()[0]).toMatchObject({ kind: "subscription", eventType: "invoice.payment_failed" });
  });

  test("a refunded lifetime payment is found by its payment metadata", async () => {
    mocks.chargeRetrieve.mockResolvedValueOnce({ id: "ch_1", payment_intent: "pi_life", refunded: true });
    mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_life", metadata: { purpose: PURPOSE, order_id: "order9" } });
    await deliver(stripeEvent("charge.refunded", { id: "ch_1", refunded: false }));
    expect(settledEvents()[0]).toMatchObject({
      kind: "refund",
      target: "lifetime",
      orderId: "order9",
      subscriptionId: null,
      paymentIntentId: "pi_life",
      full: true,
    });
  });

  test("a refunded subscription payment is found through its invoice", async () => {
    mocks.chargeRetrieve.mockResolvedValueOnce({ id: "ch_2", payment_intent: "pi_sub", refunded: false });
    mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_sub", metadata: {} });
    mocks.invoicePaymentList.mockResolvedValueOnce({ data: [{ invoice: "in_9" }] });
    mocks.invoiceRetrieve.mockResolvedValueOnce({
      id: "in_9",
      parent: { subscription_details: { subscription: "sub_one", metadata: { purpose: PURPOSE } } },
    });
    await deliver(stripeEvent("charge.refunded", { id: "ch_2" }));
    expect(mocks.invoicePaymentList).toHaveBeenCalledWith({ payment: { type: "payment_intent", payment_intent: "pi_sub" }, limit: 1 });
    expect(settledEvents()[0]).toMatchObject({ target: "subscription", subscriptionId: "sub_one", orderId: null, full: false });
  });

  test("a refund of someone else's payment is 200 with no write", async () => {
    mocks.chargeRetrieve.mockResolvedValueOnce({ id: "ch_3", payment_intent: "pi_other", refunded: true });
    mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_other", metadata: {} });
    const none = await deliver(stripeEvent("charge.refunded", { id: "ch_3" }));
    expect(none.status).toBe(200);
    mocks.chargeRetrieve.mockResolvedValueOnce({ id: "ch_4", payment_intent: "pi_other", refunded: true });
    mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_other", metadata: {} });
    mocks.invoicePaymentList.mockResolvedValueOnce({ data: [{ invoice: "in_x" }] });
    mocks.invoiceRetrieve.mockResolvedValueOnce({ id: "in_x", parent: { subscription_details: { subscription: "sub_x", metadata: {} } } });
    mocks.subscriptionRetrieve.mockResolvedValueOnce(subscription({ id: "sub_x", metadata: {} }));
    expect((await deliver(stripeEvent("charge.refunded", { id: "ch_4" }))).status).toBe(200);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test.each([
    ["needs_response", "open"],
    ["under_review", "open"],
    ["won", "won"],
    ["warning_closed", "won"],
    ["lost", "lost"],
  ])("a dispute with status %s settles as %s, whatever the event said", async (status, outcome) => {
    mocks.disputeRetrieve.mockResolvedValueOnce({ id: "dp_1", charge: "ch_1", payment_intent: "pi_life", status });
    mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_life", metadata: { purpose: PURPOSE, order_id: "order9" } });
    await deliver(stripeEvent("charge.dispute.created", { id: "dp_1", status: "needs_response" }));
    expect(settledEvents()[0]).toMatchObject({ kind: "dispute", outcome, target: "lifetime", paymentIntentId: "pi_life" });
  });

  test("a dispute without a payment id reads it from the charge", async () => {
    mocks.disputeRetrieve.mockResolvedValueOnce({ id: "dp_2", charge: "ch_7", payment_intent: null, status: "lost" });
    mocks.chargeRetrieve.mockResolvedValueOnce({ id: "ch_7", payment_intent: "pi_life" });
    mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_life", metadata: { purpose: PURPOSE, order_id: "order9" } });
    await deliver(stripeEvent("charge.dispute.closed", { id: "dp_2" }));
    expect(mocks.chargeRetrieve).toHaveBeenCalledWith("ch_7");
    expect(settledEvents()[0]).toMatchObject({ outcome: "lost" });
  });

  test("webhooks keep settling when checkout is switched off (frozen contract 11)", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_MODE", "off");
    expect((await deliver(stripeEvent("checkout.session.completed", { id: "cs_test_one" }))).status).toBe(200);
    expect(settledEvents()).toHaveLength(1);
  });
});

describe("WP64-S4 webhook route: follow-ups and failure", () => {
  const deliverWith = async (actions: FollowUp[]) => {
    settleWith(actions);
    return await deliver(stripeEvent("customer.subscription.updated", { id: "sub_one" }));
  };

  test("a refund is made once, in full, with an idempotency key; an already refunded or disputed payment is left", async () => {
    expect((await deliverWith([{ type: "refund_payment", paymentIntentId: "pi_one" }])).status).toBe(200);
    expect(mocks.intentRetrieve).toHaveBeenCalledWith("pi_one", { expand: ["latest_charge"] });
    expect(mocks.refundCreate).toHaveBeenCalledWith({ payment_intent: "pi_one" }, { idempotencyKey: "membership-refund:pi_one" });
    mocks.refundCreate.mockClear();
    for (const latest_charge of [{ refunded: true, disputed: false }, { refunded: false, disputed: true }, null]) {
      mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_one", metadata: {}, status: "succeeded", latest_charge });
      expect((await deliverWith([{ type: "refund_payment", paymentIntentId: "pi_one" }])).status).toBe(200);
    }
    expect(mocks.refundCreate).not.toHaveBeenCalled();
  });

  test("cancel now skips a subscription that already ended", async () => {
    await deliverWith([{ type: "cancel_subscription_now", subscriptionId: "sub_one" }]);
    expect(mocks.subscriptionCancel).toHaveBeenCalledWith("sub_one", {}, { idempotencyKey: "membership-cancel:sub_one" });
    mocks.subscriptionCancel.mockClear();
    mocks.subscriptionRetrieve.mockImplementation(async (id: string) => subscription({ id, status: "canceled" }));
    await deliverWith([{ type: "cancel_subscription_now", subscriptionId: "sub_one" }]);
    expect(mocks.subscriptionCancel).not.toHaveBeenCalled();
  });

  test("O5 sets cancel at period end once and never refunds", async () => {
    await deliverWith([{ type: "cancel_at_period_end", subscriptionId: "sub_one" }]);
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(
      "sub_one",
      { cancel_at_period_end: true },
      { idempotencyKey: "membership-cancel-at-period-end:sub_one" },
    );
    expect(mocks.refundCreate).not.toHaveBeenCalled();
    mocks.subscriptionUpdate.mockClear();
    mocks.subscriptionRetrieve.mockImplementation(async (id: string) => subscription({ id, cancel_at_period_end: true }));
    await deliverWith([{ type: "cancel_at_period_end", subscriptionId: "sub_one" }]);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  test("a duplicate subscription is refunded first, then canceled", async () => {
    mocks.invoicePaymentList.mockResolvedValue({ data: [{ invoice: "in_latest", payment: { type: "payment_intent", payment_intent: "pi_dup" } }] });
    await deliverWith([{ type: "cancel_duplicate", subscriptionId: "sub_two" }]);
    expect(mocks.invoicePaymentList).toHaveBeenCalledWith({ invoice: "in_latest", status: "paid", limit: 1 });
    expect(mocks.refundCreate).toHaveBeenCalledWith({ payment_intent: "pi_dup" }, { idempotencyKey: "membership-refund:pi_dup" });
    expect(mocks.subscriptionCancel).toHaveBeenCalledWith("sub_two", {}, { idempotencyKey: "membership-cancel:sub_two" });
    expect(mocks.refundCreate.mock.invocationCallOrder[0]).toBeLessThan(mocks.subscriptionCancel.mock.invocationCallOrder[0]);
  });

  test.each([
    ["the bridge fails", () => mocks.action.mockRejectedValue(new Error("convex down"))],
    ["Stripe fails on fetch", () => mocks.subscriptionRetrieve.mockRejectedValue(Object.assign(new Error("boom"), { code: "api_error" }))],
    ["the bridge answers something else", () => mocks.action.mockResolvedValue({ attached: true })],
  ])("%s: 500 so Stripe retries", async (_name, arrange) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    arrange();
    const response = await deliver(stripeEvent("customer.subscription.updated", { id: "sub_one" }));
    expect(response.status).toBe(500);
    for (const call of log.mock.calls) expect(JSON.stringify(call)).not.toMatch(/convex down|boom|cus_|sub_one|@/);
    log.mockRestore();
  });

  test("a failed follow-up is never acknowledged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.refundCreate.mockRejectedValueOnce(Object.assign(new Error("card_declined detail"), { code: "charge_disputed" }));
    const response = await deliverWith([{ type: "refund_payment", paymentIntentId: "pi_one" }]);
    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith("membership webhook failed", { type: "customer.subscription.updated", name: "Error", code: "charge_disputed" });
    log.mockRestore();
  });
});

describe("WP64-S4 reconcile route", () => {
  const run = (authorization: string | null = `Bearer ${CRON}`) =>
    GET(
      new Request("https://www.weekendmvp.app/api/platform/membership/reconcile", {
        headers: authorization ? { authorization } : {},
      }),
    );

  test("without CRON_SECRET or billing config it does nothing and answers 200", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(await (await run(null)).json()).toEqual({ ok: true, skipped: "not_configured" });
    vi.stubEnv("CRON_SECRET", CRON);
    vi.stubEnv("STRIPE_MEMBERSHIP_RESTRICTED_KEY", "");
    expect(await (await run()).json()).toEqual({ ok: true, skipped: "not_configured" });
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.subscriptionList).not.toHaveBeenCalled();
  });

  test("a wrong or missing bearer is 401", async () => {
    expect((await run(null)).status).toBe(401);
    expect((await run("Bearer wrong")).status).toBe(401);
    expect((await run(CRON)).status).toBe(401);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("frees holds, pushes every membership subscription Stripe runs, re-reads the ones it stopped listing", async () => {
    mocks.subscriptionList.mockImplementation(({ price, status }: { price: string; status: string }) =>
      pages(
        price === "price_monthly1" && status === "active"
          ? [subscription(), subscription({ id: "sub_foreign", metadata: { purpose: "other" } })]
          : price === "price_annual1" && status === "past_due"
            ? [subscription({ id: "sub_late", status: "past_due" })]
            : [],
      ),
    );
    mocks.subscriptionRetrieve.mockImplementation(async (id: string) =>
      id === "sub_gone"
        ? subscription({ id, status: "canceled", ended_at: 1_850_000_000 })
        : id === "sub_alien"
          ? subscription({ id, metadata: {} })
          : subscription({ id }),
    );
    settleWith([{ type: "cancel_at_period_end", subscriptionId: "sub_late" }]);
    const response = await run();
    expect(await response.json()).toEqual({ ok: true, released: 2, pushed: 2, refreshed: 1, capped: false });
    expect(mocks.subscriptionList.mock.calls.map(([params]) => params)).toEqual([
      { price: "price_monthly1", status: "active", limit: 100 },
      { price: "price_monthly1", status: "past_due", limit: 100 },
      { price: "price_annual1", status: "active", limit: 100 },
      { price: "price_annual1", status: "past_due", limit: 100 },
    ]);
    const kinds = bridgeCalls().map((payload) => payload.kind);
    expect(kinds).toEqual(["release_expired_holds", "subscription_snapshot", "subscription_snapshot", "running_subscriptions", "subscription_snapshot"]);
    const pushed = bridgeCalls().flatMap((payload) =>
      payload.kind === "subscription_snapshot" ? [(payload.subscription as { subscriptionId: string; status: string })] : [],
    );
    expect(pushed.map((row) => [row.subscriptionId, row.status])).toEqual([
      ["sub_one", "active"],
      ["sub_late", "past_due"],
      ["sub_gone", "canceled"],
    ]);
    expect(mocks.subscriptionRetrieve).toHaveBeenCalledWith("sub_gone");
    expect(mocks.subscriptionRetrieve).toHaveBeenCalledWith("sub_alien");
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith("sub_late", { cancel_at_period_end: true }, expect.anything());
  });

  test("a capped scan never treats an unscanned subscription as stopped", async () => {
    mocks.subscriptionList.mockImplementation(({ price, status }: { price: string; status: string }) =>
      pages(
        price === "price_monthly1" && status === "active"
          ? Array.from({ length: RECONCILE_LIMIT + 1 }, (_, i) => subscription({ id: `sub_${i}` }))
          : [],
      ),
    );
    const body = await (await run()).json();
    expect(body).toMatchObject({ ok: true, pushed: RECONCILE_LIMIT, refreshed: 0, capped: true });
    expect(mocks.subscriptionRetrieve).not.toHaveBeenCalled();
  });

  test("a failure is 500 with no detail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.action.mockRejectedValue(new Error("convex down"));
    const response = await run();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false });
    expect(log).toHaveBeenCalledWith("membership reconcile failed", { name: "Error", code: undefined });
    log.mockRestore();
  });
});

describe("WP64-S4 bridge payload rules for server kinds", () => {
  const sign = (payload: string) => ({ payload, signature: createHmac("sha256", BRIDGE).update(payload).digest("base64url") });
  const code = (payload: string) => {
    const signed = sign(payload);
    try {
      verifyMembershipBridge(signed.payload, signed.signature, BRIDGE);
    } catch (error) {
      return (error as MembershipBridgeError).code;
    }
    return "accepted";
  };

  test("exact keys, a positive whole issuedAt and an object body", () => {
    expect(code(JSON.stringify({ kind: "event", issuedAt: NOW, event: { kind: "subscription" } }))).toBe("accepted");
    expect(code(JSON.stringify({ kind: "event", issuedAt: NOW, event: {}, ownerId: "u1" }))).toBe("INVALID_BRIDGE_PAYLOAD");
    expect(code(JSON.stringify({ kind: "event", event: {} }))).toBe("INVALID_BRIDGE_PAYLOAD");
    expect(code(JSON.stringify({ kind: "event", issuedAt: "now", event: {} }))).toBe("INVALID_BRIDGE_PAYLOAD");
    expect(code(JSON.stringify({ kind: "event", issuedAt: 1.5, event: {} }))).toBe("INVALID_BRIDGE_PAYLOAD");
    expect(code(JSON.stringify({ kind: "event", issuedAt: NOW, event: [] }))).toBe("INVALID_BRIDGE_PAYLOAD");
    expect(code(JSON.stringify({ kind: "subscription_snapshot", issuedAt: NOW, livemode: "no", subscription: {} }))).toBe(
      "INVALID_BRIDGE_PAYLOAD",
    );
    expect(code(JSON.stringify({ kind: "release_expired_holds", issuedAt: NOW, extra: 1 }))).toBe("INVALID_BRIDGE_PAYLOAD");
    expect(code(JSON.stringify({ kind: "running_subscriptions", issuedAt: NOW }))).toBe("INVALID_BRIDGE_PAYLOAD");
    expect(code(JSON.stringify({ kind: "settle_everything", issuedAt: NOW }))).toBe("INVALID_BRIDGE_PAYLOAD");
  });

  test("signing round-trips each server kind and keeps under the size cap", () => {
    const kinds: MembershipBridgePayload[] = [
      { kind: "event", issuedAt: NOW, event: { kind: "subscription", eventId: "evt_1" } },
      { kind: "subscription_snapshot", issuedAt: NOW, livemode: true, subscription: { subscriptionId: "sub_1" } },
      { kind: "release_expired_holds", issuedAt: NOW },
      { kind: "running_subscriptions", issuedAt: NOW, livemode: false },
    ];
    for (const payload of kinds) {
      const signed = signMembershipBridge(payload, BRIDGE);
      expect(verifyMembershipBridge(signed.payload, signed.signature, BRIDGE)).toEqual(payload);
    }
    const big = { kind: "event", issuedAt: NOW, event: { pad: "x".repeat(4_096) } } as MembershipBridgePayload;
    expect(() => signMembershipBridge(big, BRIDGE)).toThrow(MembershipBridgeError);
  });

  test("fresh within five minutes either way, never beyond", () => {
    expect(MEMBERSHIP_BRIDGE_MAX_AGE_MS).toBe(5 * 60 * 1000);
    expect(membershipBridgeFresh(NOW - MEMBERSHIP_BRIDGE_MAX_AGE_MS, NOW)).toBe(true);
    expect(membershipBridgeFresh(NOW + MEMBERSHIP_BRIDGE_MAX_AGE_MS, NOW)).toBe(true);
    expect(membershipBridgeFresh(NOW - MEMBERSHIP_BRIDGE_MAX_AGE_MS - 1, NOW)).toBe(false);
    expect(membershipBridgeFresh(NOW + MEMBERSHIP_BRIDGE_MAX_AGE_MS + 1, NOW)).toBe(false);
  });
});
