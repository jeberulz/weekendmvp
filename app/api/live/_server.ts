import Stripe from "stripe";
import {
  BUILD_ALONG,
  EARLY_BIRD_ENDS_AT,
  LIVE_EVENT_KEY,
  LIVE_WORKSHOP_SELLER_LINE,
  POLICY_ANCHOR,
  POLICY_SECTION_LIVE,
} from "@/lib/live/config";
import { SUPPORT_EMAIL } from "@/lib/legal/support";
import {
  LIVE_WORKSHOP_ENV,
  LIVE_WORKSHOP_LOOKUP_KEYS,
  LIVE_WORKSHOP_PRICES,
  LIVE_WORKSHOP_PURPOSE,
  LIVE_WORKSHOP_SELLER,
  LIVE_WORKSHOP_STRIPE_API_VERSION,
  type LiveWorkshopPriceKey,
} from "@/lib/live/stripe-catalog";

type Environment = Readonly<Record<string, string | undefined>>;

export type LiveWorkshopBillingConfig = {
  mode: "test" | "live";
  livemode: boolean;
  stripeKey: string;
  bridgeSecret: string;
  appOrigin: string;
  priceIds: Partial<Record<LiveWorkshopPriceKey, string>>;
};

export class LiveWorkshopConfigError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "LiveWorkshopConfigError";
    this.code = code;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Fails closed unless billing mode is test/live and required keys exist.
 * Price IDs may be placeholders — checkout resolves lookup keys at session
 * create time, falling back to optional env overrides.
 */
export function readLiveWorkshopBillingConfig(env: Environment): LiveWorkshopBillingConfig {
  const mode = env[LIVE_WORKSHOP_ENV.mode] ?? "";
  if (mode === "" || mode === "off") throw new LiveWorkshopConfigError("BILLING_OFF");
  if (mode !== "test" && mode !== "live") throw new LiveWorkshopConfigError("BILLING_MODE_INVALID");
  if (mode === "test" && env.VERCEL_ENV === "production") {
    throw new LiveWorkshopConfigError("TEST_MODE_IN_PRODUCTION");
  }

  const stripeKey = env[LIVE_WORKSHOP_ENV.restrictedKey] ?? "";
  if (!new RegExp(`^(rk|sk)_${mode}_[A-Za-z0-9]+$`).test(stripeKey)) {
    throw new LiveWorkshopConfigError("KEY_MODE_MISMATCH");
  }

  const bridgeSecret = env[LIVE_WORKSHOP_ENV.bridgeSecret] ?? "";
  if (bridgeSecret.length < 32) throw new LiveWorkshopConfigError("BRIDGE_NOT_CONFIGURED");

  const origin = env[LIVE_WORKSHOP_ENV.appOrigin] ?? "";
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new LiveWorkshopConfigError("ORIGIN_INVALID");
  }
  const secure =
    url.protocol === "https:" ||
    (mode === "test" && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.origin !== origin) throw new LiveWorkshopConfigError("ORIGIN_INVALID");

  const priceIds: Partial<Record<LiveWorkshopPriceKey, string>> = {};
  for (const spec of LIVE_WORKSHOP_PRICES) {
    const priceId = (env[spec.envName] ?? "").trim();
    if (priceId && /^price_[A-Za-z0-9]+$/.test(priceId)) {
      priceIds[spec.priceKey] = priceId;
    }
  }

  return {
    mode,
    livemode: mode === "live",
    stripeKey,
    bridgeSecret,
    appOrigin: url.origin,
    priceIds,
  };
}

export type LiveWorkshopWebhookConfig = {
  livemode: boolean;
  stripeKey: string;
  webhookSecret: string;
  bridgeSecret: string;
};

export function readLiveWorkshopWebhookConfig(env: Environment): LiveWorkshopWebhookConfig {
  const billing = readLiveWorkshopBillingConfig(env);
  const webhookSecret = env[LIVE_WORKSHOP_ENV.webhookSecret] ?? "";
  if (!webhookSecret.startsWith("whsec_")) throw new LiveWorkshopConfigError("WEBHOOK_SECRET_MISSING");
  return {
    livemode: billing.livemode,
    stripeKey: billing.stripeKey,
    webhookSecret,
    bridgeSecret: billing.bridgeSecret,
  };
}

export function createLiveWorkshopStripe(
  config: Pick<LiveWorkshopBillingConfig, "stripeKey"> | LiveWorkshopWebhookConfig,
): Stripe {
  return new Stripe(config.stripeKey, {
    apiVersion: LIVE_WORKSHOP_STRIPE_API_VERSION,
    maxNetworkRetries: 1,
    appInfo: { name: "weekendmvp-live-workshop" },
  });
}

/** Inclusive through EARLY_BIRD_ENDS_AT (23:59:59Z Sun 8 Nov 2026). */
export function activePriceKey(nowMs: number): "early" | "regular" {
  return nowMs <= EARLY_BIRD_ENDS_AT ? "early" : "regular";
}

export function activeLookupKey(nowMs: number): string {
  return LIVE_WORKSHOP_LOOKUP_KEYS[activePriceKey(nowMs)];
}

export function resolvePriceKey(
  nowMs: number,
  opts?: { forNextSession?: boolean },
): LiveWorkshopPriceKey {
  if (opts?.forNextSession) return "dec5";
  return activePriceKey(nowMs);
}

/**
 * Prefer optional env price id; otherwise resolve Stripe lookup key at call time.
 */
export async function resolveCheckoutPrice(
  stripe: Stripe,
  config: LiveWorkshopBillingConfig,
  nowMs: number,
  opts?: { forNextSession?: boolean },
): Promise<{ priceKey: LiveWorkshopPriceKey; lookupKey: string; priceId: string } | null> {
  const priceKey = resolvePriceKey(nowMs, opts);
  const lookupKey = LIVE_WORKSHOP_LOOKUP_KEYS[priceKey];
  const fromEnv = config.priceIds[priceKey];
  if (fromEnv) return { priceKey, lookupKey, priceId: fromEnv };

  try {
    const listed = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1, active: true });
    const price = listed.data[0];
    if (!price?.id) return null;
    return { priceKey, lookupKey, priceId: price.id };
  } catch {
    return null;
  }
}

export type OpenedWorkshopOrder = {
  orderId: string;
  seatNumber: number;
  sessionExpiresAt: number;
  email: string;
  checkoutSessionId?: string;
};

export function checkoutSessionParams(
  config: LiveWorkshopBillingConfig,
  order: OpenedWorkshopOrder,
  priceId: string,
  priceKey: LiveWorkshopPriceKey,
  lookupKey: string,
): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    purpose: LIVE_WORKSHOP_PURPOSE,
    event_key: LIVE_EVENT_KEY,
    price_key: priceKey,
    lookup_key: lookupKey,
    order_id: order.orderId,
    seat_number: String(order.seatNumber),
  };
  const success = `${config.appOrigin}/live/build-along?thanks=1`;
  const cancel = `${config.appOrigin}/live/build-along?checkout=cancelled#ticket`;

  const refundLine = POLICY_SECTION_LIVE
    ? `Full refund within 30 days of purchase, no reason needed. We'll email you if we cancel. Reply within 48 hours to move to the next date, otherwise you're refunded in full, automatically. Refund policy: ${config.appOrigin}${POLICY_ANCHOR}. Support: ${SUPPORT_EMAIL}.`
    : `Full refund within 30 days of purchase, no reason needed. Support: ${SUPPORT_EMAIL}.`;

  return {
    mode: "payment",
    // Cards only — avoids delayed methods; webhook still guards payment_status.
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: success,
    cancel_url: cancel,
    client_reference_id: order.orderId,
    customer_email: order.email,
    customer_creation: "always",
    metadata,
    payment_intent_data: { metadata },
    expires_at: Math.floor(order.sessionExpiresAt / 1000),
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    phone_number_collection: { enabled: false },
    custom_text: {
      submit: {
        message: `${LIVE_WORKSHOP_SELLER_LINE} Your Zoom link and prep list come by email. Price in USD.`,
      },
      after_submit: {
        message: `${refundLine} Seller: ${LIVE_WORKSHOP_SELLER}.`,
      },
    },
  };
}

export function liveCheckoutError(code: string, status = 503): Response {
  return Response.json({ ok: false, code }, { status });
}

export const LIVE_CHECKOUT_ERROR_STATUS: Record<string, number> = {
  AUTHENTICATION_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  SOLD_OUT: 409,
  ALREADY_PAID: 409,
  INVALID_REQUEST: 400,
  PRICE_NOT_CONFIGURED: 503,
  BILLING_UNAVAILABLE: 503,
};

void BUILD_ALONG;
