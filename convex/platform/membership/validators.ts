import { v, type VLiteral } from "convex/values";

/**
 * WP63-S2. Value lists and validators for the Builder's Hub membership
 * tables. Pure, so `schema.ts` and the membership functions share one copy.
 *
 * Times are milliseconds since the epoch, like every other platform table.
 * Stripe sends seconds, so the S4 settlement converts before it writes.
 */

type LiteralValues = readonly [string, string, ...string[]];

function stringLiteralUnion<const Values extends LiteralValues>(values: Values) {
  const members = values.map((value) => v.literal(value)) as unknown as [
    VLiteral<Values[number]>,
    VLiteral<Values[number]>,
    ...VLiteral<Values[number]>[],
  ];
  return v.union(...members);
}

/** Metadata `purpose` on every membership Checkout Session, subscription and payment. */
export const MEMBERSHIP_BILLING_PURPOSE = "weekendmvp_membership_v1";

/** How a member pays for Builder's Hub. A comp grant is not a term. */
export const MEMBERSHIP_TERM_VALUES = ["monthly", "annual", "lifetime"] as const;
export const membershipTermValidator = stringLiteralUnion(MEMBERSHIP_TERM_VALUES);

/** The terms Stripe bills as a subscription. */
export const SUBSCRIPTION_TERM_VALUES = ["monthly", "annual"] as const;
export const subscriptionTermValidator = stringLiteralUnion(SUBSCRIPTION_TERM_VALUES);

/** One key per Stripe Price. The seat number picks the lifetime tranche. */
export const PRICE_KEY_VALUES = ["monthly", "annual", "lifetime_t1", "lifetime_t2"] as const;
export const priceKeyValidator = stringLiteralUnion(PRICE_KEY_VALUES);

/** Stripe's subscription statuses, stored as Stripe sends them. */
export const STRIPE_SUBSCRIPTION_STATUS_VALUES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;
export const stripeSubscriptionStatusValidator = stringLiteralUnion(STRIPE_SUBSCRIPTION_STATUS_VALUES);

/** Statuses that keep access (frozen contract, O9: access continues while Stripe retries). */
export const ACCESS_SUBSCRIPTION_STATUSES = ["active", "past_due"] as const;

export const ORDER_STATUS_VALUES = [
  "pending",
  "paid",
  "expired",
  "failed",
  "refunded",
  "disputed",
] as const;
export const orderStatusValidator = stringLiteralUnion(ORDER_STATUS_VALUES);

export const GRANT_KIND_VALUES = ["lifetime", "comp"] as const;

/** Why a grant ended. Never free text, so no PII lands in the row. */
export const REVOKE_REASON_VALUES = ["refund", "dispute_lost", "operator"] as const;
export const revokeReasonValidator = stringLiteralUnion(REVOKE_REASON_VALUES);

export const grantKindValidator = stringLiteralUnion(GRANT_KIND_VALUES);

/**
 * A lifetime grant names its order and seat. A comp grant names neither.
 * Flat rather than a union, because `referenceTables.ts` reads `.fields` from
 * every table validator. The writers (S4 settlement, `comp.ts`) keep the rule.
 */
export const planGrantValidator = v.object({
  ownerId: v.id("users"),
  kind: grantKindValidator,
  orderId: v.optional(v.id("membership_orders")),
  seatNumber: v.optional(v.number()),
  grantedAt: v.number(),
  /** Set while a dispute is open (O9). Cleared when it is won. */
  suspendedAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
  revokeReason: v.optional(revokeReasonValidator),
});

export const SEAT_STATUS_VALUES = ["free", "reserved", "taken"] as const;
export const seatStatusValidator = stringLiteralUnion(SEAT_STATUS_VALUES);

/** A free seat holds no owner. A reserved seat expires at `reservedUntil`. A taken seat is paid. */
export const foundingSeatValidator = v.object({
  seatNumber: v.number(),
  status: seatStatusValidator,
  ownerId: v.optional(v.id("users")),
  orderId: v.optional(v.id("membership_orders")),
  reservedUntil: v.optional(v.number()),
  updatedAt: v.number(),
});

/** What settlement did with a Stripe event. Ids, types and outcomes only. */
export const BILLING_EVENT_OUTCOME_VALUES = ["applied", "ignored", "stale", "rejected"] as const;
export const billingEventOutcomeValidator = stringLiteralUnion(BILLING_EVENT_OUTCOME_VALUES);

/** WP63-S7. Who a founding offer window opens for before it opens to everyone. */
export const FOUNDING_COHORT_VALUES = ["buyers", "newsletter"] as const;
export const foundingCohortValidator = stringLiteralUnion(FOUNDING_COHORT_VALUES);
