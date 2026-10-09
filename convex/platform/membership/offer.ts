import { ConvexError } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { cohortEmailHash } from "./cohortHash";
import { readSeatOffer } from "./state";
import { FOUNDING_WINDOWS, type FoundingWindows } from "./windows";

/**
 * WP64-S7. Who may buy a Founding Lifetime seat, and from when. Read-only
 * and clock-free: callers pass `now`. The checkout mutation (S3) passes its
 * own `Date.now()`. A query never decides "open now", it returns the date
 * and the browser compares it with its own clock for display only.
 *
 * Eligibility comes only from `offer_cohorts`, which only the operator
 * import writes, matched against the member's verified email. The legacy
 * `stripe_events` and `subscriptions` tables are publicly writable, so they
 * are never read here.
 */

export type FoundingCohort = "buyers" | "newsletter";

/** One row per cohort is the norm. A few spare rows tolerate a repeated import. */
const COHORT_READ = 4;

/** The earliest window that includes these cohorts, or null while none is dated. */
export function foundingEligibleFrom(
  cohorts: ReadonlySet<FoundingCohort>,
  windows: FoundingWindows = FOUNDING_WINDOWS,
): number | null {
  const buyer = cohorts.has("buyers");
  const subscriber = buyer || cohorts.has("newsletter");
  const opens = [buyer ? windows.buyers : null, subscriber ? windows.newsletter : null, windows.everyone].filter(
    (opensAt): opensAt is number => opensAt !== null,
  );
  return opens.length === 0 ? null : Math.min(...opens);
}

export function isFoundingOpen(eligibleFrom: number | null, now: number): boolean {
  return eligibleFrom !== null && now >= eligibleFrom;
}

/** Dated windows must open in order: buyers, then newsletter, then everyone. */
export function windowsInOrder(windows: FoundingWindows = FOUNDING_WINDOWS): boolean {
  const dated = [windows.buyers, windows.newsletter, windows.everyone].filter(
    (opensAt): opensAt is number => opensAt !== null,
  );
  return dated.every((opensAt, index) => index === 0 || opensAt >= dated[index - 1]);
}

type Member = Pick<Doc<"users">, "email" | "emailVerificationTime" | "isAnonymous">;

/** The member's cohorts. Only a verified, non-anonymous email can be in one. */
export async function readFoundingCohorts(ctx: Pick<QueryCtx, "db">, user: Member): Promise<Set<FoundingCohort>> {
  if (!user.email || user.emailVerificationTime === undefined || user.isAnonymous === true) return new Set();
  const emailHash = await cohortEmailHash(user.email);
  const rows = await ctx.db
    .query("offer_cohorts")
    .withIndex("by_emailHash", (q) => q.eq("emailHash", emailHash))
    .take(COHORT_READ);
  return new Set(rows.map((row) => row.cohort));
}

export async function readFoundingEligibleFrom(ctx: Pick<QueryCtx, "db">, user: Member): Promise<number | null> {
  return foundingEligibleFrom(await readFoundingCohorts(ctx, user));
}

/**
 * For the S3 checkout mutation, before it reserves a seat. Throws
 * `NOT_YET_ELIGIBLE`, with `opensAt` when the member's window is dated.
 */
export async function assertFoundingEligible(ctx: Pick<QueryCtx, "db">, user: Member, now: number): Promise<void> {
  const eligibleFrom = await readFoundingEligibleFrom(ctx, user);
  if (isFoundingOpen(eligibleFrom, now)) return;
  throw new ConvexError(
    eligibleFrom === null ? { code: "NOT_YET_ELIGIBLE" } : { code: "NOT_YET_ELIGIBLE", opensAt: eligibleFrom },
  );
}

/**
 * What the Home offer card needs (`lib/dashboard/offers.ts`): this member's
 * window and the live seat count. Before the seed there are no free seats
 * and no price, so the card cannot show.
 */
export async function readFoundingInput(ctx: QueryCtx, user: Member) {
  const [seats, eligibleFrom] = await Promise.all([readSeatOffer(ctx), readFoundingEligibleFrom(ctx, user)]);
  return { eligibleFrom, seatsLeft: seats.seatsLeft, nextSeatAmountMinor: seats.nextSeatAmountMinor };
}
