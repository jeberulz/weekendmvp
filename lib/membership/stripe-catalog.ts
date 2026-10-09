import { MEMBERSHIP_BILLING_PURPOSE } from "../../convex/platform/membership/validators.ts";
import { PLANS, PRICING, formatUsd, type PriceKey } from "../../convex/platform/plans.ts";

/**
 * WP64-S10. The Builder's Hub catalog in Stripe, as data. Amounts and
 * intervals come from `PRICING`, so Stripe can be checked against the code
 * and never the other way round. Pure, with relative `.ts` imports, so
 * `scripts/membership-stripe-setup.mjs` can load it under Node's type
 * stripping and the S3 and S4 routes can import it too.
 *
 * Nothing here holds a key, an id from a real account or a secret. Price ids
 * live in the env names below, set per mode outside git.
 */

/**
 * The Stripe API version every membership call pins (S3 test). It is the
 * version `stripe@22.2.0` ships with. Managed Payments needs
 * `2025-03-31.basil` or later, and this is later, so O1 can go either way.
 */
export const MEMBERSHIP_STRIPE_API_VERSION = "2026-05-27.dahlia";

/** Env names, final. Values never in git. The legacy and WP24 names stay separate. */
export const MEMBERSHIP_ENV = {
  mode: "MEMBERSHIP_BILLING_MODE",
  taxMode: "MEMBERSHIP_TAX_MODE",
  appOrigin: "MEMBERSHIP_BILLING_APP_ORIGIN",
  bridgeSecret: "MEMBERSHIP_BILLING_BRIDGE_SECRET",
  restrictedKey: "STRIPE_MEMBERSHIP_RESTRICTED_KEY",
  webhookSecret: "STRIPE_MEMBERSHIP_WEBHOOK_SECRET",
  cronSecret: "CRON_SECRET",
  /** Operator-only, for the setup script. Never set on Vercel or Convex. */
  setupKey: "STRIPE_MEMBERSHIP_SETUP_KEY",
} as const;

export type MembershipProductKey = "builders_hub" | "founding_lifetime";

export type MembershipProductSpec = {
  key: MembershipProductKey;
  name: string;
  description: string;
};

export const MEMBERSHIP_PRODUCTS: readonly MembershipProductSpec[] = [
  {
    key: "builders_hub",
    name: PLANS.builders_hub.name,
    description: `${PLANS.builders_hub.name} membership on Weekend MVP, billed monthly or yearly.`,
  },
  {
    key: "founding_lifetime",
    name: `${PLANS.builders_hub.name} Founding Lifetime`,
    description: `One payment for ${PLANS.builders_hub.name}, with no renewal. ${PRICING.lifetime.seats} seats.`,
  },
];

/**
 * Tax codes Stripe listed on 2026-10-04 as candidates. O1 picks one; it is
 * set on both products and can change later without new prices.
 */
export const MEMBERSHIP_TAX_CODE_CANDIDATES = {
  txcd_10000000: "General - Electronically Supplied Services",
  txcd_10103000: "Software as a service (SaaS) - personal use",
  txcd_10103001: "Software as a service (SaaS) - business use",
} as const;

export type MembershipPriceSpec = {
  priceKey: PriceKey;
  productKey: MembershipProductKey;
  /** Stable handle, so a replaced price can take over the same key. */
  lookupKey: string;
  nickname: string;
  unitAmount: number;
  currency: typeof PRICING.currency;
  recurring: { interval: "month" | "year"; intervalCount: 1 } | null;
  /** Where the price id for the configured mode goes. */
  envName: string;
};

const lookupKey = (priceKey: PriceKey) => `weekendmvp_membership_${priceKey}`;

export const MEMBERSHIP_PRICES: readonly MembershipPriceSpec[] = [
  {
    priceKey: "monthly",
    productKey: "builders_hub",
    lookupKey: lookupKey("monthly"),
    nickname: "Monthly",
    unitAmount: PRICING.monthly.amountMinor,
    currency: PRICING.currency,
    recurring: { interval: PRICING.monthly.interval, intervalCount: 1 },
    envName: "STRIPE_MEMBERSHIP_PRICE_MONTHLY",
  },
  {
    priceKey: "annual",
    productKey: "builders_hub",
    lookupKey: lookupKey("annual"),
    nickname: "Annual",
    unitAmount: PRICING.annual.amountMinor,
    currency: PRICING.currency,
    recurring: { interval: PRICING.annual.interval, intervalCount: 1 },
    envName: "STRIPE_MEMBERSHIP_PRICE_ANNUAL",
  },
  ...PRICING.lifetime.tranches.map((tranche, i) => ({
    priceKey: tranche.priceKey,
    productKey: "founding_lifetime" as const,
    lookupKey: lookupKey(tranche.priceKey),
    nickname: `Founding Lifetime, seats ${tranche.firstSeat} to ${tranche.lastSeat}`,
    unitAmount: tranche.amountMinor,
    currency: PRICING.currency,
    recurring: null,
    envName: `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T${i + 1}`,
  })),
];

export function priceSpec(priceKey: PriceKey): MembershipPriceSpec {
  const spec = MEMBERSHIP_PRICES.find((price) => price.priceKey === priceKey);
  if (!spec) throw new Error(`No catalog price for ${priceKey}`);
  return spec;
}

/** Metadata on both products and every price, so nothing else in the account is mistaken for them. */
export function productMetadata(key: MembershipProductKey) {
  return { purpose: MEMBERSHIP_BILLING_PURPOSE, product_key: key };
}
export function priceMetadata(priceKey: PriceKey) {
  return { purpose: MEMBERSHIP_BILLING_PURPOSE, price_key: priceKey };
}

/** S4 handles exactly these. The webhook endpoint subscribes to exactly these. */
export const MEMBERSHIP_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
] as const;

export const MEMBERSHIP_WEBHOOK_PATH = "/api/platform/membership/webhook";

/** The fields of a Stripe Price this check reads. A real `Stripe.Price` fits. */
export type StripePriceLike = {
  id: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  billing_scheme: string;
  type: string;
  recurring: { interval: string; interval_count: number; usage_type?: string } | null;
  lookup_key: string | null;
  metadata?: Record<string, string> | null;
};

export type PriceReview = {
  /** Checkout must refuse the price (S3): charging it would differ from `PRICING`. */
  blocking: string[];
  /** Labels only. Fix in Stripe, but money is unaffected. */
  warnings: string[];
};

/**
 * Compares a Stripe Price with the catalog. S3 calls it before each Checkout
 * Session and refuses on any blocking item. The setup script prints both.
 */
export function reviewPrice(price: StripePriceLike, priceKey: PriceKey, livemode: boolean): PriceReview {
  const spec = priceSpec(priceKey);
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (!price.active) blocking.push("price is archived");
  if (price.livemode !== livemode) blocking.push(`price is ${price.livemode ? "live" : "test"} mode`);
  if (price.currency !== spec.currency) blocking.push(`currency ${price.currency}, expected ${spec.currency}`);
  if (price.unit_amount !== spec.unitAmount) {
    blocking.push(`amount ${price.unit_amount ?? "none"}, expected ${spec.unitAmount} (${formatUsd(spec.unitAmount)})`);
  }
  if (price.billing_scheme !== "per_unit") blocking.push(`billing scheme ${price.billing_scheme}, expected per_unit`);
  if (spec.recurring === null) {
    if (price.type !== "one_time") blocking.push(`type ${price.type}, expected one_time`);
  } else if (price.type !== "recurring" || price.recurring === null) {
    blocking.push(`type ${price.type}, expected recurring`);
  } else {
    if (price.recurring.interval !== spec.recurring.interval) {
      blocking.push(`interval ${price.recurring.interval}, expected ${spec.recurring.interval}`);
    }
    if (price.recurring.interval_count !== spec.recurring.intervalCount) {
      blocking.push(`interval count ${price.recurring.interval_count}, expected ${spec.recurring.intervalCount}`);
    }
    if (price.recurring.usage_type !== undefined && price.recurring.usage_type !== "licensed") {
      blocking.push(`usage type ${price.recurring.usage_type}, expected licensed`);
    }
  }
  if (price.lookup_key !== spec.lookupKey) warnings.push(`lookup key ${price.lookup_key ?? "none"}, expected ${spec.lookupKey}`);
  const metadata = price.metadata ?? {};
  for (const [key, value] of Object.entries(priceMetadata(priceKey))) {
    if (metadata[key] !== value) warnings.push(`metadata ${key} is ${metadata[key] ?? "missing"}, expected ${value}`);
  }
  return { blocking, warnings };
}
