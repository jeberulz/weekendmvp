import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { PlanId } from "./plans";

/**
 * WP44-S10. Which plan a member is on. Free for everyone until the
 * subscription work package ships (FR-22). That work package reads its
 * subscription record here, and nothing else changes: every gate goes
 * through `getEntitlements`, which calls this.
 *
 * Kept in its own module so tests can stand in a Builder's Hub member.
 */
export const resolvePlan: (ctx: QueryCtx, ownerId: Id<"users">) => Promise<PlanId> = async () => "free";
