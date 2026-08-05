import { createHmac } from "node:crypto";
import type Stripe from "stripe";
import {
  PLATFORM_BILLING_PURPOSE,
  PLATFORM_CREDIT_PACKS,
  getCreditPack,
} from "../../../../convex/platform/billing/catalog";

type BillingEnvironment = Readonly<Record<string, string | undefined>>;

export type PlatformBillingConfig = {
  appOrigin: string;
  bridgeSecret: string;
  stripeKey: string;
  webhookSecret?: string;
  priceIds: Record<string, string>;
};

export function readPlatformBillingConfig(
  environment: BillingEnvironment,
  options: { requireWebhook?: boolean } = {},
): PlatformBillingConfig {
  if (environment.PLATFORM_BILLING_MODE !== "test") {
    throw new Error("PLATFORM_BILLING_TEST_MODE_REQUIRED");
  }
  const stripeKey = environment.STRIPE_PLATFORM_TEST_RESTRICTED_KEY;
  if (!stripeKey || !/^(rk|sk)_test_/.test(stripeKey)) {
    throw new Error("PLATFORM_BILLING_TEST_KEY_REQUIRED");
  }
  const bridgeSecret = environment.PLATFORM_BILLING_BRIDGE_SECRET;
  if (!bridgeSecret || bridgeSecret.length < 32) {
    throw new Error("PLATFORM_BILLING_BRIDGE_NOT_CONFIGURED");
  }
  const appOrigin = environment.PLATFORM_BILLING_APP_ORIGIN;
  if (!appOrigin) throw new Error("PLATFORM_BILLING_ORIGIN_NOT_CONFIGURED");
  const parsedOrigin = new URL(appOrigin);
  if (
    parsedOrigin.origin !== parsedOrigin.href.replace(/\/$/, "") ||
    (parsedOrigin.protocol !== "https:" && parsedOrigin.hostname !== "localhost")
  ) {
    throw new Error("PLATFORM_BILLING_ORIGIN_INVALID");
  }

  const priceIds: Record<string, string> = {};
  for (const pack of PLATFORM_CREDIT_PACKS) {
    const priceId = environment[pack.priceEnv];
    if (!priceId || !/^price_[A-Za-z0-9_]+$/.test(priceId)) {
      throw new Error("PLATFORM_BILLING_TEST_PRICE_REQUIRED");
    }
    priceIds[pack.id] = priceId;
  }
  const webhookSecret = environment.STRIPE_PLATFORM_TEST_WEBHOOK_SECRET;
  if (options.requireWebhook && (!webhookSecret || !webhookSecret.startsWith("whsec_"))) {
    throw new Error("PLATFORM_BILLING_WEBHOOK_NOT_CONFIGURED");
  }

  return {
    appOrigin: parsedOrigin.origin,
    bridgeSecret,
    stripeKey,
    webhookSecret,
    priceIds,
  };
}

export function signBridgePayload(payload: object, bridgeSecret: string) {
  const serialized = JSON.stringify(payload);
  return {
    payload: serialized,
    signature: createHmac("sha256", bridgeSecret)
      .update(serialized)
      .digest("base64url"),
  };
}

export function parseCheckoutRequest(value: unknown): {
  packId: string;
  projectId: string;
  idempotencyKey: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_CHECKOUT_REQUEST");
  }
  const candidate = value as Record<string, unknown>;
  const allowed = new Set(["packId", "projectId", "idempotencyKey"]);
  if (Object.keys(candidate).some((key) => !allowed.has(key))) {
    throw new Error("INVALID_CHECKOUT_REQUEST");
  }
  if (
    typeof candidate.packId !== "string" ||
    typeof candidate.projectId !== "string" ||
    typeof candidate.idempotencyKey !== "string"
  ) {
    throw new Error("INVALID_CHECKOUT_REQUEST");
  }
  getCreditPack(candidate.packId);
  return {
    packId: candidate.packId,
    projectId: candidate.projectId,
    idempotencyKey: candidate.idempotencyKey,
  };
}

function idFromExpandable(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

export type NormalizedPlatformStripeEvent =
  | {
      kind: "checkout_paid" | "checkout_failed";
      purpose: typeof PLATFORM_BILLING_PURPOSE;
      eventId: string;
      purchaseId: string;
      checkoutSessionId: string;
      paymentIntentId?: string;
      amountMinor?: number;
      currency?: string;
    }
  | {
      kind: "refund" | "dispute";
      purpose: typeof PLATFORM_BILLING_PURPOSE;
      eventId: string;
      paymentIntentId: string;
      amountMinor?: number;
      currency?: string;
      fullRefund?: boolean;
    };

export class UnsupportedPlatformBillingPolicyError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "UnsupportedPlatformBillingPolicyError";
  }
}

export function normalizeStripeEvent(
  event: Stripe.Event,
): NormalizedPlatformStripeEvent | null {
  if (event.livemode) throw new Error("LIVE_STRIPE_EVENT_REJECTED");

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.purpose !== PLATFORM_BILLING_PURPOSE) return null;
    const purchaseId = session.metadata.purchase_id;
    if (!purchaseId || !session.id.startsWith("cs_test_")) {
      throw new Error("INVALID_PLATFORM_CHECKOUT_EVENT");
    }
    const failed =
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired";
    if (!failed && session.payment_status !== "paid") return null;
    return {
      kind: failed ? "checkout_failed" : "checkout_paid",
      purpose: PLATFORM_BILLING_PURPOSE,
      eventId: event.id,
      purchaseId,
      checkoutSessionId: session.id,
      paymentIntentId: idFromExpandable(session.payment_intent),
      amountMinor: session.amount_total ?? undefined,
      currency: session.currency ?? undefined,
    };
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    if (!charge.refunded) {
      throw new UnsupportedPlatformBillingPolicyError(
        "PARTIAL_REFUND_POLICY_UNSUPPORTED",
      );
    }
    const paymentIntentId = idFromExpandable(charge.payment_intent);
    if (!paymentIntentId) throw new Error("REFUND_PAYMENT_REFERENCE_MISSING");
    return {
      kind: "refund",
      purpose: PLATFORM_BILLING_PURPOSE,
      eventId: event.id,
      paymentIntentId,
      amountMinor: charge.amount,
      currency: charge.currency,
      fullRefund: charge.refunded,
    };
  }

  if (
    event.type === "charge.dispute.closed" ||
    event.type === "charge.dispute.funds_reinstated"
  ) {
    throw new UnsupportedPlatformBillingPolicyError(
      "DISPUTE_RESOLUTION_POLICY_UNSUPPORTED",
    );
  }

  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId = idFromExpandable(dispute.payment_intent);
    if (!paymentIntentId) throw new Error("DISPUTE_PAYMENT_REFERENCE_MISSING");
    return {
      kind: "dispute",
      purpose: PLATFORM_BILLING_PURPOSE,
      eventId: event.id,
      paymentIntentId,
      amountMinor: dispute.amount,
      currency: dispute.currency,
    };
  }

  return null;
}
