import { describe, expect, test } from "vitest";
import type Stripe from "stripe";
import { PLATFORM_BILLING_PURPOSE } from "../../../../convex/platform/billing/catalog";
import {
  normalizeStripeEvent,
  parseCheckoutRequest,
  readPlatformBillingConfig,
  signBridgePayload,
} from "./_server";

const validEnvironment = {
  PLATFORM_BILLING_MODE: "test",
  PLATFORM_BILLING_APP_ORIGIN: "http://localhost:3000",
  PLATFORM_BILLING_BRIDGE_SECRET: "a-secure-test-only-bridge-secret-123456",
  STRIPE_PLATFORM_TEST_RESTRICTED_KEY: "rk_test_",
  STRIPE_PLATFORM_TEST_WEBHOOK_SECRET: "whsec_",
  STRIPE_PLATFORM_TEST_PRICE_STARTER: "price_test_starter",
  STRIPE_PLATFORM_TEST_PRICE_BUILDER: "price_test_builder",
  STRIPE_PLATFORM_TEST_PRICE_STUDIO: "price_test_studio",
};

function stripeEvent(
  type: string,
  object: Record<string, unknown>,
  livemode = false,
) {
  return {
    id: "evt_test_route",
    type,
    livemode,
    data: { object },
  } as unknown as Stripe.Event;
}

describe("platform billing route boundary", () => {
  test("requires explicit test mode and a test key before any provider call", () => {
    expect(() =>
      readPlatformBillingConfig({
        ...validEnvironment,
        PLATFORM_BILLING_MODE: "live",
      }),
    ).toThrow("PLATFORM_BILLING_TEST_MODE_REQUIRED");
    expect(() =>
      readPlatformBillingConfig({
        ...validEnvironment,
        STRIPE_PLATFORM_TEST_RESTRICTED_KEY: "sk_live_",
      }),
    ).toThrow("PLATFORM_BILLING_TEST_KEY_REQUIRED");
    expect(readPlatformBillingConfig(validEnvironment).priceIds).toEqual({
      starter: "price_test_starter",
      builder: "price_test_builder",
      studio: "price_test_studio",
    });
  });

  test("accepts only the three non-authoritative browser fields", () => {
    expect(
      parseCheckoutRequest({
        packId: "starter",
        projectId: "project_reference",
        idempotencyKey: "checkout:1234567890abcdef",
      }),
    ).toEqual({
      packId: "starter",
      projectId: "project_reference",
      idempotencyKey: "checkout:1234567890abcdef",
    });
    expect(() =>
      parseCheckoutRequest({
        packId: "starter",
        projectId: "project_reference",
        idempotencyKey: "checkout:1234567890abcdef",
        amountMinor: 1,
      }),
    ).toThrow("INVALID_CHECKOUT_REQUEST");
  });

  test("normalizes only purpose-specific test events", () => {
    expect(
      normalizeStripeEvent(
        stripeEvent("checkout.session.completed", {
          id: "cs_test_route",
          payment_status: "paid",
          amount_total: 2_900,
          currency: "usd",
          payment_intent: "pi_route",
          metadata: {
            purpose: PLATFORM_BILLING_PURPOSE,
            purchase_id: "purchase_reference",
          },
        }),
      ),
    ).toEqual({
      kind: "checkout_paid",
      purpose: PLATFORM_BILLING_PURPOSE,
      eventId: "evt_test_route",
      purchaseId: "purchase_reference",
      checkoutSessionId: "cs_test_route",
      paymentIntentId: "pi_route",
      amountMinor: 2_900,
      currency: "usd",
    });
    expect(
      normalizeStripeEvent(
        stripeEvent("checkout.session.completed", {
          id: "cs_test_foreign",
          payment_status: "paid",
          metadata: { purpose: "shipable" },
        }),
      ),
    ).toBeNull();
    expect(() =>
      normalizeStripeEvent(
        stripeEvent(
          "checkout.session.completed",
          { id: "cs_live_forbidden", metadata: {} },
          true,
        ),
      ),
    ).toThrow("LIVE_STRIPE_EVENT_REJECTED");
  });

  test("fails unsupported partial/dispute-resolution policy explicitly", () => {
    expect(() =>
      normalizeStripeEvent(
        stripeEvent("charge.refunded", {
          id: "ch_route",
          payment_intent: "pi_route",
          amount: 2_900,
          amount_refunded: 1_000,
          currency: "usd",
          refunded: false,
        }),
      ),
    ).toThrow("PARTIAL_REFUND_POLICY_UNSUPPORTED");
    expect(() =>
      normalizeStripeEvent(
        stripeEvent("charge.dispute.closed", {
          id: "dp_route",
          payment_intent: "pi_route",
          status: "won",
        }),
      ),
    ).toThrow("DISPUTE_RESOLUTION_POLICY_UNSUPPORTED");
  });

  test("signs bridge payloads without exposing the secret", () => {
    const signed = signBridgePayload(
      { kind: "attach_session", purchaseId: "purchase", checkoutSessionId: "cs_test_route" },
      validEnvironment.PLATFORM_BILLING_BRIDGE_SECRET,
    );
    expect(signed.payload).not.toContain(validEnvironment.PLATFORM_BILLING_BRIDGE_SECRET);
    expect(signed.signature).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
