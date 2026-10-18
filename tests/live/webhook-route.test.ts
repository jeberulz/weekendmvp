// @vitest-environment node
import type StripeType from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LIVE_WORKSHOP_PURPOSE } from "@/lib/live/stripe-catalog";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  sessionRetrieve: vi.fn(),
  sessionList: vi.fn(),
  intentRetrieve: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
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
      checkout = {
        sessions: {
          retrieve: mocks.sessionRetrieve,
          list: mocks.sessionList,
        },
      };
      paymentIntents = { retrieve: mocks.intentRetrieve };
      constructor() {}
    },
  };
});

import { POST, resolveWorkshopRefund } from "@/app/api/live/webhook/route";

const actualStripe = await vi.importActual<{ default: typeof StripeType }>("stripe");
const signer = new actualStripe.default("sk_test_fake").webhooks;

const BRIDGE = "live-workshop-bridge-secret-0123456789ab";
const WHSEC = ["whsec", "liveworkshoptest012345"].join("_");
const ENV = {
  LIVE_WORKSHOP_BILLING_MODE: "test",
  LIVE_WORKSHOP_BILLING_APP_ORIGIN: "http://localhost:3000",
  LIVE_WORKSHOP_BILLING_BRIDGE_SECRET: BRIDGE,
  STRIPE_LIVE_WORKSHOP_RESTRICTED_KEY: "rk_test_abc123",
  STRIPE_LIVE_WORKSHOP_WEBHOOK_SECRET: WHSEC,
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  VERCEL_ENV: "",
};

const NOW = 1_800_000_000_000;

function stripeEvent(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({
    id: `evt_${type.replace(/\W/g, "_")}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2026-05-27.dahlia",
    created: Math.floor(NOW / 1000),
    type,
    livemode: false,
    data: { object },
  });
  const header = signer.generateTestHeaderString({ payload, secret: WHSEC });
  return new Request("http://localhost/api/live/webhook", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

async function deliver(type: string, object: Record<string, unknown>) {
  return POST(stripeEvent(type, object));
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  mocks.action.mockReset().mockResolvedValue({ ok: true });
  mocks.sessionRetrieve.mockReset();
  mocks.sessionList.mockReset();
  mocks.intentRetrieve.mockReset();
  mocks.revalidateTag.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("live workshop webhook payment_status", () => {
  test("checkout.session.completed only marks paid when payment_status is paid", async () => {
    const unpaid = await deliver("checkout.session.completed", {
      id: "cs_test_unpaid",
      payment_status: "unpaid",
      status: "complete",
      metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
    });
    expect(unpaid.status).toBe(200);
    expect(await unpaid.text()).toBe("Ignored");
    expect(mocks.action).not.toHaveBeenCalled();

    mocks.sessionRetrieve.mockResolvedValueOnce({
      id: "cs_test_paid",
      line_items: { data: [{ price: { id: "price_early" } }] },
    });
    const paid = await deliver("checkout.session.completed", {
      id: "cs_test_paid",
      payment_status: "paid",
      status: "complete",
      metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
    });
    expect(paid.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledOnce();
    const signed = mocks.action.mock.calls[0][1] as { payload: string };
    expect(JSON.parse(signed.payload)).toMatchObject({
      kind: "mark_paid",
      checkoutSessionId: "cs_test_paid",
    });
  });

  test("async_payment_succeeded marks paid; async_payment_failed frees the seat", async () => {
    mocks.sessionRetrieve.mockResolvedValueOnce({
      id: "cs_test_async",
      line_items: { data: [{ price: { id: "price_early" } }] },
    });
    const ok = await deliver("checkout.session.async_payment_succeeded", {
      id: "cs_test_async",
      payment_status: "paid",
      metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
    });
    expect(ok.status).toBe(200);
    expect(JSON.parse((mocks.action.mock.calls[0][1] as { payload: string }).payload)).toMatchObject({
      kind: "mark_paid",
    });

    mocks.action.mockClear();
    const fail = await deliver("checkout.session.async_payment_failed", {
      id: "cs_test_async_fail",
      payment_status: "unpaid",
      metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
    });
    expect(fail.status).toBe(200);
    expect(JSON.parse((mocks.action.mock.calls[0][1] as { payload: string }).payload)).toMatchObject({
      kind: "mark_expired",
      checkoutSessionId: "cs_test_async_fail",
    });
  });
});

describe("live workshop charge.refunded", () => {
  test("ignores partial refunds even for workshop charges", async () => {
    const res = await deliver("charge.refunded", {
      id: "ch_partial",
      refunded: false,
      amount_refunded: 500,
      metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
      payment_intent: "pi_1",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Ignored");
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("full refund with purpose on the payment intent frees the seat", async () => {
    mocks.intentRetrieve.mockResolvedValueOnce({
      id: "pi_ws",
      metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
    });
    mocks.sessionList.mockResolvedValueOnce({ data: [{ id: "cs_test_refund" }] });
    const res = await deliver("charge.refunded", {
      id: "ch_full",
      refunded: true,
      metadata: {},
      payment_intent: "pi_ws",
    });
    expect(res.status).toBe(200);
    expect(JSON.parse((mocks.action.mock.calls[0][1] as { payload: string }).payload)).toMatchObject({
      kind: "mark_refunded",
      checkoutSessionId: "cs_test_refund",
    });
  });

  test("full refund of a foreign charge is ignored", async () => {
    mocks.intentRetrieve.mockResolvedValueOnce({ id: "pi_other", metadata: {} });
    mocks.sessionList.mockResolvedValueOnce({ data: [{ id: "cs_other" }] });
    mocks.sessionRetrieve.mockResolvedValueOnce({
      id: "cs_other",
      metadata: { purpose: "weekendmvp_membership_v1" },
    });
    const res = await deliver("charge.refunded", {
      id: "ch_foreign",
      refunded: true,
      metadata: {},
      payment_intent: "pi_other",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Ignored");
    expect(mocks.action).not.toHaveBeenCalled();
  });

  test("Stripe lookup failure returns 500 so Stripe retries", async () => {
    mocks.intentRetrieve.mockRejectedValueOnce(new Error("network"));
    const res = await deliver("charge.refunded", {
      id: "ch_retry",
      refunded: true,
      metadata: {},
      payment_intent: "pi_ws",
    });
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Retry");
    expect(mocks.action).not.toHaveBeenCalled();
  });
});

describe("resolveWorkshopRefund", () => {
  test("uses charge metadata purpose when present", async () => {
    const stripe = {
      paymentIntents: { retrieve: mocks.intentRetrieve },
      checkout: {
        sessions: { list: mocks.sessionList, retrieve: mocks.sessionRetrieve },
      },
    } as unknown as StripeType;
    mocks.sessionList.mockResolvedValueOnce({ data: [{ id: "cs_meta" }] });
    const result = await resolveWorkshopRefund(stripe, {
      id: "ch_1",
      refunded: true,
      metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
      payment_intent: "pi_1",
    } as unknown as StripeType.Charge);
    expect(result).toEqual({ kind: "ours", checkoutSessionId: "cs_meta" });
  });
});
