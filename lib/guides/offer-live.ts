import { BUILD_ALONG, NEXT_BUILD_ALONG, NEXT_SESSION_CHECKOUT_ENABLED, SALES_OPEN_AT } from "@/lib/live/config";
import { buildAlongPhase } from "@/lib/live/schedule";

import type { EffectiveStatus, Offer, PriceConfigKey, StatusResolverKey } from "./offers.ts";

/**
 * Config-backed lookups for offers (WP103-S3): prices and live status come from
 * `lib/live/config.ts`. Imports through the `@/` alias, so plain Node needs the alias hook in
 * `scripts/lib/alias-hooks.mjs` (the audit CLI registers it).
 */

const PRICE_RESOLVERS: Record<PriceConfigKey, () => number> = {
  "BUILD_ALONG.standardUsd": () => BUILD_ALONG.standardUsd,
};

/** Every price key must have a resolver. Checked by a test, so adding a key without one fails. */
export const resolvablePriceKeys = Object.keys(PRICE_RESOLVERS);

export function resolvePrice(key: PriceConfigKey): number {
  const resolve = PRICE_RESOLVERS[key];
  if (!resolve) throw new Error(`No price resolver for config key "${key}"`);
  return resolve();
}

export function formatPrice(amount: number): string {
  return `$${amount}`;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const STATUS_RESOLVERS: Record<StatusResolverKey, (now: number) => EffectiveStatus> = {
  /**
   * Follows the checkout page's own clock, `buildAlongPhase`, so the audit and the page agree on when a
   * ticket can be bought. It reads config only. The live page can also be sold out from a seat counter
   * that this does not see, so "open" here means "config allows a purchase", not "a seat is free".
   */
  "build-along": (now) => {
    const phase = buildAlongPhase(now);
    if (phase === "pre_sale") {
      return {
        status: "closed",
        reason: `ticket sales for the ${day(BUILD_ALONG.startAt)} session open on ${day(SALES_OPEN_AT)} (SALES_OPEN_AT in lib/live/config.ts), until then the checkout page disables the ticket button`,
      };
    }
    if (phase !== "ended") {
      return { status: "open", reason: `the ${day(BUILD_ALONG.startAt)} session is in its ${phase} phase` };
    }
    if (NEXT_SESSION_CHECKOUT_ENABLED && now < NEXT_BUILD_ALONG.endAt) {
      return { status: "open", reason: `checkout is on for the ${day(NEXT_BUILD_ALONG.startAt)} session` };
    }
    return {
      status: "closed",
      reason: `the ${day(BUILD_ALONG.startAt)} session has ended and checkout for the next session (${day(NEXT_BUILD_ALONG.startAt)}) is off, NEXT_SESSION_CHECKOUT_ENABLED is false in lib/live/config.ts`,
    };
  },
};

export function effectiveStatus(offer: Offer, now: number): EffectiveStatus {
  if (offer.status !== "derived") return { status: offer.status, reason: `declared ${offer.status} in the offers registry` };
  const resolver = offer.statusResolver ? STATUS_RESOLVERS[offer.statusResolver] : undefined;
  if (!resolver) throw new Error(`Offer "${offer.id}" has no status resolver`);
  return resolver(now);
}
