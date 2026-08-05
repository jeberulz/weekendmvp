import { ConvexError } from "convex/values";

export const PLATFORM_BILLING_PURPOSE = "weekendmvp_platform_credits_v1";

export const PLATFORM_CREDIT_PACKS = [
  {
    id: "starter",
    name: "Starter",
    amountMinor: 2_900,
    credits: 25,
    priceEnv: "STRIPE_PLATFORM_TEST_PRICE_STARTER",
  },
  {
    id: "builder",
    name: "Builder",
    amountMinor: 7_900,
    credits: 75,
    priceEnv: "STRIPE_PLATFORM_TEST_PRICE_BUILDER",
  },
  {
    id: "studio",
    name: "Studio",
    amountMinor: 19_900,
    credits: 220,
    priceEnv: "STRIPE_PLATFORM_TEST_PRICE_STUDIO",
  },
] as const;

export type PlatformCreditPack = (typeof PLATFORM_CREDIT_PACKS)[number];
export type PlatformCreditPackId = PlatformCreditPack["id"];

export function getCreditPack(packId: string): PlatformCreditPack {
  const pack = PLATFORM_CREDIT_PACKS.find((candidate) => candidate.id === packId);
  if (!pack) {
    throw new ConvexError({ code: "UNKNOWN_CREDIT_PACK" });
  }
  return pack;
}
export function assertCheckoutIdempotencyKey(value: string): string {
  if (value.length < 16 || value.length > 96 || !/^[A-Za-z0-9:_-]+$/.test(value)) {
    throw new ConvexError({ code: "INVALID_IDEMPOTENCY_KEY" });
  }
  return value;
}
