import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { PRICING, lifetimeTrancheForSeat, type PlanId } from "../plans";
import { ACCESS_SUBSCRIPTION_STATUSES } from "./validators";

/**
 * WP64-S2. Read-only membership state: which plan an owner holds and the
 * billing summary the dashboard shows. `resolvePlan` and `entitlements.mine`
 * both come here, so the plan and the summary always agree.
 *
 * Clock-free on purpose (frozen contract 3). Access follows the stored
 * status, and the stored status follows Stripe through the S4 webhooks and
 * the daily reconcile. No write lives in this module.
 */

/**
 * An owner holds a lifetime grant, at most one comp grant and one live
 * subscription. Revoked grants and ended subscriptions accumulate slowly,
 * one per refund or re-purchase, so the newest 25 of each always include the
 * live ones.
 */
export const MEMBERSHIP_SCAN_CAP = 25;

export const billingSummaryValidator = v.object({
  term: v.union(
    v.literal("monthly"),
    v.literal("annual"),
    v.literal("lifetime"),
    v.literal("comp"),
    v.null(),
  ),
  status: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("suspended"),
    v.literal("canceled"),
    v.literal("unpaid"),
    v.literal("paused"),
    v.null(),
  ),
  /** The next renewal, for a subscription that renews. */
  renewsAt: v.union(v.number(), v.null()),
  /** When access ends or ended, for a subscription set to cancel or already over. */
  endsAt: v.union(v.number(), v.null()),
  foundingSeat: v.union(v.number(), v.null()),
});

export type BillingSummary = Infer<typeof billingSummaryValidator>;

export const NO_BILLING: BillingSummary = {
  term: null,
  status: null,
  renewsAt: null,
  endsAt: null,
  foundingSeat: null,
};

type Grant = Doc<"plan_grants">;
type Subscription = Doc<"plan_subscriptions">;

const grantIsLive = (grant: Grant) => grant.revokedAt === undefined && grant.suspendedAt === undefined;
const grantIsSuspended = (grant: Grant) => grant.revokedAt === undefined && grant.suspendedAt !== undefined;

const statusKeepsAccess = (subscription: Subscription) =>
  (ACCESS_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status);

/** Active or past due, and no open dispute (O9: a dispute suspends access). */
const subscriptionIsLive = (subscription: Subscription) =>
  statusKeepsAccess(subscription) && subscription.disputedAt === undefined;

function subscriptionSummary(subscription: Subscription, status: BillingSummary["status"]): BillingSummary {
  const periodEnd = subscription.currentPeriodEnd ?? null;
  const ending = subscription.cancelAtPeriodEnd;
  let renewsAt: number | null = null;
  let endsAt: number | null = null;
  if (status === "canceled") {
    endsAt = subscription.canceledAt ?? periodEnd;
  } else if (status === "active" || status === "past_due" || status === "suspended") {
    // An unpaid or paused subscription has no date to promise either way.
    if (ending) endsAt = periodEnd;
    else if (status !== "suspended") renewsAt = periodEnd;
  }
  return { term: subscription.term, status, renewsAt, endsAt, foundingSeat: null };
}

function grantSummary(grant: Grant, status: "active" | "suspended"): BillingSummary {
  return {
    term: grant.kind,
    status,
    renewsAt: null,
    endsAt: null,
    foundingSeat: grant.kind === "lifetime" ? (grant.seatNumber ?? null) : null,
  };
}

/**
 * Pure. Grants and subscriptions arrive newest first. Order of precedence:
 * a live lifetime grant, then a live subscription, then a live comp grant.
 * Without access: a suspended grant, then a disputed subscription, then the
 * newest ended subscription. Revoked grants and unfinished subscriptions
 * (`incomplete`, `trialing`) show nothing.
 */
export function deriveMembership(
  grants: readonly Grant[],
  subscriptions: readonly Subscription[],
): { plan: PlanId; billing: BillingSummary } {
  const lifetime = grants.find((grant) => grant.kind === "lifetime" && grantIsLive(grant));
  if (lifetime) return { plan: "builders_hub", billing: grantSummary(lifetime, "active") };

  const live = subscriptions.find(subscriptionIsLive);
  if (live) {
    return {
      plan: "builders_hub",
      billing: subscriptionSummary(live, live.status === "past_due" ? "past_due" : "active"),
    };
  }

  const comp = grants.find((grant) => grant.kind === "comp" && grantIsLive(grant));
  if (comp) return { plan: "builders_hub", billing: grantSummary(comp, "active") };

  const suspended = grants.find(grantIsSuspended);
  if (suspended) return { plan: "free", billing: grantSummary(suspended, "suspended") };

  const disputed = subscriptions.find(
    (subscription) => statusKeepsAccess(subscription) && subscription.disputedAt !== undefined,
  );
  if (disputed) return { plan: "free", billing: subscriptionSummary(disputed, "suspended") };

  const ended = subscriptions.find(
    (subscription) =>
      subscription.status === "canceled" || subscription.status === "unpaid" || subscription.status === "paused",
  );
  if (ended) {
    const status = ended.status as "canceled" | "unpaid" | "paused";
    return { plan: "free", billing: subscriptionSummary(ended, status) };
  }

  return { plan: "free", billing: NO_BILLING };
}

export async function readMembershipState(ctx: QueryCtx, ownerId: Id<"users">) {
  const [grants, subscriptions] = await Promise.all([
    ctx.db
      .query("plan_grants")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP),
    ctx.db
      .query("plan_subscriptions")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP),
  ]);
  return deriveMembership(grants, subscriptions);
}

export type SeatCounts = {
  free: number;
  reserved: number;
  taken: number;
  /** True when the table holds more rows than seats, which the seed never does. */
  overflow: boolean;
};

/**
 * Founding seats by status. Reads at most one row more than the 50 seats,
 * never `.collect()`. An unseeded table reads as no free seats, so checkout
 * fails closed with SOLD_OUT.
 */
export async function countSeats(ctx: QueryCtx): Promise<SeatCounts> {
  const rows = await ctx.db
    .query("founding_seats")
    .withIndex("by_seatNumber")
    .take(PRICING.lifetime.seats + 1);
  const counts: SeatCounts = { free: 0, reserved: 0, taken: 0, overflow: rows.length > PRICING.lifetime.seats };
  for (const row of rows.slice(0, PRICING.lifetime.seats)) counts[row.status] += 1;
  return counts;
}

export type SeatOffer = {
  /** False until the operator seeds the seats (S12). */
  open: boolean;
  seatsTotal: number;
  seatsLeft: number;
  /** Held by an unfinished checkout. They come back if it expires. */
  seatsHeld: number;
  nextSeatAmountMinor: number | null;
};

/** WP64-S6 and S7. The true free-seat count and the next seat's price, for the ladder and the Home card. */
export async function readSeatOffer(ctx: QueryCtx): Promise<SeatOffer> {
  const [counts, nextFree] = await Promise.all([
    countSeats(ctx),
    ctx.db
      .query("founding_seats")
      .withIndex("by_status_and_seatNumber", (q) => q.eq("status", "free"))
      .first(),
  ]);
  const tranche = nextFree ? lifetimeTrancheForSeat(nextFree.seatNumber) : null;
  return {
    open: counts.free + counts.reserved + counts.taken > 0,
    seatsTotal: PRICING.lifetime.seats,
    seatsLeft: counts.free,
    seatsHeld: counts.reserved,
    nextSeatAmountMinor: tranche?.amountMinor ?? null,
  };
}
