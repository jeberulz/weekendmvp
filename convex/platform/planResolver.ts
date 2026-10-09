import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { readMembershipState } from "./membership/state";
import type { PlanId } from "./plans";

/**
 * WP44-S10, filled in by WP64-S2. Which plan a member is on. Builder's Hub
 * for a live lifetime or comp grant, or a subscription stored as `active` or
 * `past_due` with no open dispute. Free otherwise. Every gate goes through
 * `getEntitlements`, which calls this. No clock read: see
 * `membership/state.ts`.
 *
 * Kept in its own module so tests can stand in a Builder's Hub member.
 */
export const resolvePlan: (ctx: QueryCtx, ownerId: Id<"users">) => Promise<PlanId> = async (ctx, ownerId) =>
  (await readMembershipState(ctx, ownerId)).plan;
