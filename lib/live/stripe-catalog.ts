/**
 * Live Build-Along Stripe catalog (purpose-separated from ship·able,
 * membership, and platform credits).
 *
 * Purpose metadata on product + every Checkout Session:
 *   purpose=weekendmvp_workshop_v1
 *
 * Prices use lookup keys (resolved server-side by time):
 *   weekendmvp_buildalong_20261114_early   → until 2026-11-08T23:59:59Z inclusive
 *   weekendmvp_buildalong_20261114_regular → after
 *
 * Checkout: normal Stripe Payments (NOT Managed Payments), automatic_tax,
 * billing address required, tax-inclusive prices. Seller: Rulz&Co.
 *
 * Do NOT add these to membership catalogs or legacy Payment Link handlers.
 */

export const LIVE_WORKSHOP_PURPOSE = "weekendmvp_workshop_v1" as const;

/** Pin to the same Stripe SDK apiVersion the membership catalog uses. */
export const LIVE_WORKSHOP_STRIPE_API_VERSION = "2026-05-27.dahlia" as const;

export const LIVE_WORKSHOP_SELLER = "Rulz&Co" as const;

export const LIVE_WORKSHOP_LOOKUP_KEYS = {
  early: "weekendmvp_buildalong_20261114_early",
  regular: "weekendmvp_buildalong_20261114_regular",
  /** Optional next session — only once created. */
  dec5: "weekendmvp_buildalong_20261205_regular",
} as const;

export type LiveWorkshopLookupKey =
  (typeof LIVE_WORKSHOP_LOOKUP_KEYS)[keyof typeof LIVE_WORKSHOP_LOOKUP_KEYS];

export type LiveWorkshopPriceKey = keyof typeof LIVE_WORKSHOP_LOOKUP_KEYS;

export const LIVE_WORKSHOP_PRODUCT = {
  name: "Weekend MVP Build-Along: Sat 14 Nov 2026, 15:00 GMT",
  description:
    "Build it Saturday, ship it Sunday. 2 hours live on Zoom. Ship Sheet, prompts and the replay (no expiry) included.",
  metadata: { purpose: LIVE_WORKSHOP_PURPOSE },
} as const;

/** Env vars for the workshop billing slice. */
export const LIVE_WORKSHOP_ENV = {
  mode: "LIVE_WORKSHOP_BILLING_MODE",
  appOrigin: "LIVE_WORKSHOP_BILLING_APP_ORIGIN",
  bridgeSecret: "LIVE_WORKSHOP_BILLING_BRIDGE_SECRET",
  restrictedKey: "STRIPE_LIVE_WORKSHOP_RESTRICTED_KEY",
  webhookSecret: "STRIPE_LIVE_WORKSHOP_WEBHOOK_SECRET",
  /** Optional overrides when lookup keys aren't wired in test. */
  priceEarly: "STRIPE_LIVE_WORKSHOP_PRICE_EARLY",
  priceRegular: "STRIPE_LIVE_WORKSHOP_PRICE_STANDARD",
  priceDec5: "STRIPE_LIVE_WORKSHOP_PRICE_DEC5",
} as const;

export const LIVE_WORKSHOP_PRICES = [
  {
    priceKey: "early" as const,
    lookupKey: LIVE_WORKSHOP_LOOKUP_KEYS.early,
    envName: LIVE_WORKSHOP_ENV.priceEarly,
    unitAmount: 1900,
    nickname: "Early bird — through 8 Nov 2026",
  },
  {
    priceKey: "regular" as const,
    lookupKey: LIVE_WORKSHOP_LOOKUP_KEYS.regular,
    envName: LIVE_WORKSHOP_ENV.priceRegular,
    unitAmount: 2900,
    nickname: "Standard — from 9 Nov 2026",
  },
  {
    priceKey: "dec5" as const,
    lookupKey: LIVE_WORKSHOP_LOOKUP_KEYS.dec5,
    envName: LIVE_WORKSHOP_ENV.priceDec5,
    unitAmount: 2900,
    nickname: "Build-Along — Sat 5 Dec 2026",
  },
] as const;

export const LIVE_WORKSHOP_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "charge.refunded",
] as const;

/** Next.js cache tag for the public seats-left render. */
export const LIVE_SEATS_CACHE_TAG = "live-workshop-seats" as const;
