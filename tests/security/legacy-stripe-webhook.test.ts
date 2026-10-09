// @vitest-environment node
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { verifyLegacyPaymentEvent } from "@/lib/legacy-payments-bridge";

const mocks = vi.hoisted(() => ({
  mutation: vi.fn(),
  action: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = mocks.mutation;
    action = mocks.action;
  },
}));
vi.mock("@/lib/beehiiv", () => ({ beehiivSubscribe: mocks.subscribe }));

import { POST } from "@/app/api/stripe-webhook/route";

const WEBHOOK_SECRET = "legacy-webhook-test-signing-secret";
const BRIDGE_SECRET = "legacy-bridge-test-secret-0123456789abcdef";
const EMAIL = "buyer@example.test";
const stripe = new Stripe("placeholder-not-a-key");

function event(
  session: Record<string, unknown> = {},
  overrides: { id?: string; type?: string } = {},
) {
  return {
    id: overrides.id ?? "evt_legacy_1",
    object: "event",
    api_version: "2025-03-31.basil",
    created: 1_760_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: overrides.type ?? "checkout.session.completed",
    data: {
      object: {
        id: "cs_shipable_1",
        object: "checkout.session",
        payment_link: "plink_shipable_1",
        metadata: {},
        customer: "cus_A1",
        customer_details: { email: EMAIL },
        customer_email: null,
        client_reference_id: null,
        amount_total: 900,
        currency: "usd",
        payment_status: "paid",
        ...session,
      },
    },
  };
}

function signedRequest(body: object, signatureHeader?: string | null) {
  const payload = JSON.stringify(body);
  const header =
    signatureHeader === undefined
      ? stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
      : signatureHeader;
  const headers: Record<string, string> = {};
  if (header !== null) headers["stripe-signature"] = header;
  return new Request("http://localhost/api/stripe-webhook", {
    method: "POST",
    headers,
    body: payload,
  });
}

const LOGGED_EVENT = {
  stripeEventId: "evt_legacy_1",
  type: "checkout.session.completed",
  email: EMAIL,
  customerId: "cus_A1",
  amount: 900,
  currency: "usd",
  paymentLinkId: "plink_shipable_1",
};

function expectNothingHappened() {
  expect(mocks.mutation).not.toHaveBeenCalled();
  expect(mocks.action).not.toHaveBeenCalled();
  expect(mocks.subscribe).not.toHaveBeenCalled();
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://convex.example.test");
  vi.stubEnv("BEEHIIV_API_KEY", "beehiiv-test-key");
  vi.stubEnv("BEEHIIV_PAID_AUTOMATION_ID", "aut_test");
  vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", "");
  mocks.mutation.mockReset().mockResolvedValue({ duplicate: false });
  mocks.action.mockReset().mockResolvedValue({ duplicate: false });
  mocks.subscribe.mockReset().mockResolvedValue({ ok: true, status: 200, data: {} });
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("legacy ship·able webhook: which checkouts it acts on", () => {
  test("a Payment Link purchase is logged and enrolled exactly once", async () => {
    const response = await POST(signedRequest(event()));
    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledTimes(1);
    expect(mocks.mutation.mock.calls[0][1]).toEqual(LOGGED_EVENT);
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        email: EMAIL,
        automationIds: ["aut_test"],
        utmMedium: "paid",
        utmCampaign: "shipable-workshop",
      }),
    );
  });

  test("a Builder's Hub (membership) checkout is ignored", async () => {
    const response = await POST(
      signedRequest(
        event({
          id: "cs_membership_1",
          payment_link: null,
          metadata: { purpose: "weekendmvp_membership_v1", order_id: "order_1", term: "annual" },
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Ignored");
    expectNothingHappened();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Ignored a checkout session"),
      expect.objectContaining({ sessionId: "cs_membership_1", reason: "foreign_purpose" }),
    );
  });

  test("a credit-pack (WP24) checkout is ignored", async () => {
    const response = await POST(
      signedRequest(
        event({
          id: "cs_test_credits_1",
          payment_link: null,
          metadata: { purpose: "weekendmvp_platform_credits_v1", purchase_id: "p1", pack_id: "starter" },
        }),
      ),
    );
    expect(response.status).toBe(200);
    expectNothingHappened();
  });

  test("an API-created session with no purpose marker is ignored", async () => {
    const response = await POST(
      signedRequest(event({ id: "cs_api_1", payment_link: null, metadata: {} })),
    );
    expect(response.status).toBe(200);
    expectNothingHappened();
    expect(warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sessionId: "cs_api_1", reason: "not_payment_link" }),
    );
  });

  test("a Payment Link session that carries a purpose marker is still ignored", async () => {
    const response = await POST(
      signedRequest(event({ metadata: { purpose: "weekendmvp_membership_v1" } })),
    );
    expect(response.status).toBe(200);
    expectNothingHappened();
  });

  test("the ignore log carries ids and a reason, never the buyer's email", async () => {
    await POST(signedRequest(event({ payment_link: null })));
    expect(JSON.stringify(warn.mock.calls)).not.toContain(EMAIL);
  });

  test("other event types are acknowledged and ignored", async () => {
    const response = await POST(
      signedRequest(event({}, { type: "customer.subscription.updated" })),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Ignored");
    expectNothingHappened();
  });
});

describe("legacy ship·able webhook: unchanged behavior", () => {
  test("a missing or invalid signature is rejected before any work", async () => {
    expect((await POST(signedRequest(event(), null))).status).toBe(400);
    expect((await POST(signedRequest(event(), "t=1,v1=deadbeef"))).status).toBe(400);
    expectNothingHappened();
  });

  test("a duplicate event is acknowledged without a second enrollment", async () => {
    mocks.mutation.mockResolvedValue({ duplicate: true });
    const response = await POST(signedRequest(event()));
    expect(response.status).toBe(200);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  test("a Convex failure never fails the webhook and the buyer is still enrolled", async () => {
    mocks.mutation.mockRejectedValue(new Error("convex down"));
    const response = await POST(signedRequest(event()));
    expect(response.status).toBe(200);
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });
});

describe("legacy ship·able webhook: signed hand-off to the payment log", () => {
  test("with the bridge secret set, the event is signed and the public mutation is not used", async () => {
    vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", BRIDGE_SECRET);
    const response = await POST(signedRequest(event()));
    expect(response.status).toBe(200);
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.action).toHaveBeenCalledTimes(1);
    const bridge = mocks.action.mock.calls[0][1] as { payload: string; signature: string };
    expect(verifyLegacyPaymentEvent(bridge.payload, bridge.signature, BRIDGE_SECRET)).toEqual(
      LOGGED_EVENT,
    );
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });

  test("a duplicate reported by the bridge skips the enrollment", async () => {
    vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", BRIDGE_SECRET);
    mocks.action.mockResolvedValue({ duplicate: true });
    await POST(signedRequest(event()));
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  test("a too-short bridge secret records nothing and still never fails the webhook", async () => {
    vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", "too-short");
    const response = await POST(signedRequest(event()));
    expect(response.status).toBe(200);
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });

  test("a membership checkout never reaches the bridge", async () => {
    vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", BRIDGE_SECRET);
    await POST(
      signedRequest(
        event({ payment_link: null, metadata: { purpose: "weekendmvp_membership_v1" } }),
      ),
    );
    expectNothingHappened();
  });
});
