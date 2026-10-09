import Stripe from "stripe";
import { MEMBERSHIP_BILLING_PURPOSE } from "@/convex/platform/membership/validators";
import { amountForPriceKey, type PriceKey } from "@/convex/platform/plans";
import { MEMBERSHIP_PRICES, MEMBERSHIP_STRIPE_API_VERSION, reviewPrice } from "@/lib/membership/stripe-catalog";
import { checkoutConsentMessage } from "./_consent";
import {
  CHECKOUT_RETURN_PARAM,
  IDEMPOTENCY_KEY_PATTERN,
  MEMBERSHIP_ERROR_CODES,
  MEMBERSHIP_RETURN_PATH,
  MEMBERSHIP_TERMS,
  type MembershipCheckoutRequest,
  type MembershipErrorCode,
  type MembershipTerm,
} from "./_contract";

/**
 * WP64-S3. Server-only helpers for the membership routes: configuration that
 * fails closed, the pinned Stripe client, the per-session price check and the
 * Checkout Session parameters. Pure apart from the Stripe calls, so tests can
 * cover each rule. Never logs an email, a key or a payload.
 */

type Environment = Readonly<Record<string, string | undefined>>;

export type MembershipTaxMode = "managed_payments" | "automatic_tax";

export type MembershipBillingConfig = {
  mode: "test" | "live";
  livemode: boolean;
  stripeKey: string;
  bridgeSecret: string;
  appOrigin: string;
  taxMode: MembershipTaxMode;
  priceIds: Record<PriceKey, string>;
};

export class MembershipConfigError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "MembershipConfigError";
    this.code = code;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Throws `MembershipConfigError` unless every value is present and belongs to
 * the configured mode. Unset or `off` is the dormant default (frozen contract
 * 10): checkout answers 503.
 */
export function readMembershipBillingConfig(env: Environment): MembershipBillingConfig {
  const mode = env.MEMBERSHIP_BILLING_MODE ?? "";
  if (mode === "" || mode === "off") throw new MembershipConfigError("BILLING_OFF");
  if (mode !== "test" && mode !== "live") throw new MembershipConfigError("BILLING_MODE_INVALID");
  // A production deployment never takes test payments, so no test purchase
  // can land in production data (the resolver trusts stored rows, S2).
  if (mode === "test" && env.VERCEL_ENV === "production") throw new MembershipConfigError("TEST_MODE_IN_PRODUCTION");

  const stripeKey = env.STRIPE_MEMBERSHIP_RESTRICTED_KEY ?? "";
  if (!new RegExp(`^(rk|sk)_${mode}_[A-Za-z0-9]+$`).test(stripeKey)) throw new MembershipConfigError("KEY_MODE_MISMATCH");

  const bridgeSecret = env.MEMBERSHIP_BILLING_BRIDGE_SECRET ?? "";
  if (bridgeSecret.length < 32) throw new MembershipConfigError("BRIDGE_NOT_CONFIGURED");

  const origin = env.MEMBERSHIP_BILLING_APP_ORIGIN ?? "";
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new MembershipConfigError("ORIGIN_INVALID");
  }
  const secure = url.protocol === "https:" || (mode === "test" && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.origin !== origin) throw new MembershipConfigError("ORIGIN_INVALID");

  const taxMode = env.MEMBERSHIP_TAX_MODE;
  if (taxMode !== "managed_payments" && taxMode !== "automatic_tax") throw new MembershipConfigError("TAX_MODE_INVALID");

  const priceIds = {} as Record<PriceKey, string>;
  for (const spec of MEMBERSHIP_PRICES) {
    const priceId = env[spec.envName] ?? "";
    if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new MembershipConfigError("PRICE_ID_MISSING");
    priceIds[spec.priceKey] = priceId;
  }

  return { mode, livemode: mode === "live", stripeKey, bridgeSecret, appOrigin: url.origin, taxMode, priceIds };
}

export type MembershipWebhookConfig = {
  livemode: boolean;
  stripeKey: string;
  webhookSecret: string;
  bridgeSecret: string;
  /** Stripe Price id to our price key. */
  priceKeys: Record<string, PriceKey>;
};

/**
 * WP64-S4. The webhook and reconcile configuration. It does not read
 * `MEMBERSHIP_BILLING_MODE` to decide whether to run: `off` stops new
 * checkouts but webhooks keep settling, so a rollback never strands a paying
 * member (frozen contract 11). The key prefix sets the mode, and a set mode
 * must agree with it. A production deployment refuses a test key.
 */
export function readMembershipWebhookConfig(env: Environment): MembershipWebhookConfig {
  const mode = env.MEMBERSHIP_BILLING_MODE ?? "";
  if (mode !== "" && mode !== "off" && mode !== "test" && mode !== "live") throw new MembershipConfigError("BILLING_MODE_INVALID");
  const stripeKey = env.STRIPE_MEMBERSHIP_RESTRICTED_KEY ?? "";
  const keyMode = /^(?:rk|sk)_(test|live)_[A-Za-z0-9]+$/.exec(stripeKey)?.[1];
  if (!keyMode || ((mode === "test" || mode === "live") && mode !== keyMode)) throw new MembershipConfigError("KEY_MODE_MISMATCH");
  if (keyMode === "test" && env.VERCEL_ENV === "production") throw new MembershipConfigError("TEST_MODE_IN_PRODUCTION");

  const webhookSecret = env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET ?? "";
  if (!/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) throw new MembershipConfigError("WEBHOOK_NOT_CONFIGURED");
  const bridgeSecret = env.MEMBERSHIP_BILLING_BRIDGE_SECRET ?? "";
  if (bridgeSecret.length < 32) throw new MembershipConfigError("BRIDGE_NOT_CONFIGURED");

  const priceKeys: Record<string, PriceKey> = {};
  for (const spec of MEMBERSHIP_PRICES) {
    const priceId = env[spec.envName] ?? "";
    if (!/^price_[A-Za-z0-9]+$/.test(priceId) || priceId in priceKeys) throw new MembershipConfigError("PRICE_ID_MISSING");
    priceKeys[priceId] = spec.priceKey;
  }
  return { livemode: keyMode === "live", stripeKey, webhookSecret, bridgeSecret, priceKeys };
}

export function createMembershipStripe(config: Pick<MembershipBillingConfig, "stripeKey">): Stripe {
  return new Stripe(config.stripeKey, {
    apiVersion: MEMBERSHIP_STRIPE_API_VERSION,
    maxNetworkRetries: 1,
    appInfo: { name: "weekendmvp-membership" },
  });
}

/** A short cache: a changed price reaches checkout within five minutes. */
export const PRICE_CACHE_MS = 5 * 60 * 1000;
const priceCache = new Map<string, { price: Stripe.Price; at: number }>();

export function clearPriceCache() {
  priceCache.clear();
}

/** Reads the Price from Stripe and refuses on any difference from `PRICING` (S3). */
export async function assertPriceMatches(
  stripe: Pick<Stripe, "prices">,
  config: MembershipBillingConfig,
  priceKey: PriceKey,
  now: number = Date.now(),
): Promise<void> {
  const priceId = config.priceIds[priceKey];
  const cached = priceCache.get(priceId);
  let price = cached && now - cached.at < PRICE_CACHE_MS ? cached.price : undefined;
  if (!price) {
    price = await stripe.prices.retrieve(priceId);
    priceCache.set(priceId, { price, at: now });
  }
  if (price.id !== priceId || reviewPrice(price, priceKey, config.livemode).blocking.length > 0) {
    priceCache.delete(priceId);
    throw new MembershipConfigError("PRICE_MISMATCH");
  }
}

/** What `membership/checkout:begin` returns for an open order. */
export type OpenedOrder = {
  orderId: string;
  term: MembershipTerm;
  priceKey: PriceKey;
  sessionExpiresAt: number | null;
  stripeCustomerId: string | null;
  email: string;
};

/**
 * The Checkout Session for an order. Deterministic, so a retry with the same
 * Stripe idempotency key sends the same parameters and gets the same session.
 * Under Managed Payments Stripe collects the address and the tax, and rejects
 * `custom_text`, so the consent sentence shows beside our buy button instead.
 */
export function checkoutSessionParams(
  order: OpenedOrder,
  config: MembershipBillingConfig,
): Stripe.Checkout.SessionCreateParams {
  const metadata = { purpose: MEMBERSHIP_BILLING_PURPOSE, order_id: order.orderId, term: order.term };
  const back = (state: "return" | "cancelled") =>
    `${config.appOrigin}${MEMBERSHIP_RETURN_PATH}?${CHECKOUT_RETURN_PARAM}=${state}`;
  const subscription = order.term !== "lifetime";
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: subscription ? "subscription" : "payment",
    line_items: [{ price: config.priceIds[order.priceKey], quantity: 1 }],
    success_url: back("return"),
    cancel_url: back("cancelled"),
    client_reference_id: order.orderId,
    metadata,
    ...(subscription ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    ...(order.stripeCustomerId
      ? { customer: order.stripeCustomerId }
      : { customer_email: order.email, ...(subscription ? {} : { customer_creation: "always" as const }) }),
    ...(order.sessionExpiresAt === null ? {} : { expires_at: Math.floor(order.sessionExpiresAt / 1000) }),
    consent_collection: { terms_of_service: "required" },
  };
  if (config.taxMode === "managed_payments") return { ...params, managed_payments: { enabled: true } };
  return {
    ...params,
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    ...(order.stripeCustomerId ? { customer_update: { address: "auto", name: "auto" } } : {}),
    custom_text: {
      terms_of_service_acceptance: {
        message: checkoutConsentMessage({
          term: order.term,
          origin: config.appOrigin,
          lifetimeAmountMinor: order.term === "lifetime" ? amountForPriceKey(order.priceKey) : undefined,
        }),
      },
    },
  };
}

/** Exactly `{ term, idempotencyKey }`, or null. */
export function parseMembershipCheckoutRequest(value: unknown): MembershipCheckoutRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).sort().join(",") !== "idempotencyKey,term") return null;
  if (!(MEMBERSHIP_TERMS as readonly unknown[]).includes(candidate.term)) return null;
  if (typeof candidate.idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(candidate.idempotencyKey)) return null;
  return { term: candidate.term as MembershipTerm, idempotencyKey: candidate.idempotencyKey };
}

export const MEMBERSHIP_ERROR_STATUS: Record<MembershipErrorCode, number> = {
  AUTHENTICATION_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_REVIEW: 403,
  SOLD_OUT: 409,
  ALREADY_SUBSCRIBED: 409,
  NOT_YET_ELIGIBLE: 409,
  RATE_LIMITED: 429,
  INVALID_REQUEST: 400,
  BILLING_UNAVAILABLE: 503,
};

/** The contract's answer for a refusal. Anything unknown is unavailable, never a detail. */
export function membershipError(code: unknown, opensAt?: unknown): Response {
  const known: MembershipErrorCode = (MEMBERSHIP_ERROR_CODES as readonly unknown[]).includes(code)
    ? (code as MembershipErrorCode)
    : "BILLING_UNAVAILABLE";
  const body =
    known === "NOT_YET_ELIGIBLE" && typeof opensAt === "number" && Number.isFinite(opensAt)
      ? { ok: false, code: known, opensAt }
      : { ok: false, code: known };
  return Response.json(body, { status: MEMBERSHIP_ERROR_STATUS[known] });
}
