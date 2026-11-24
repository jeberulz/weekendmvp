import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { assertFeatureEnabledForOwner } from "../ops/settings";
import { readMembershipState } from "./membership/state";
import { ownerAccess } from "./ownerAccess";

/** C-LIMITS: consume these in the mutation that starts the work. */
const limits = new RateLimiter(components.rateLimiter, {
  wrenFree: { kind: "fixed window", rate: 40, period: DAY },
  wrenBuildersHub: { kind: "fixed window", rate: 300, period: DAY },
  wrenGrowth: { kind: "fixed window", rate: 600, period: DAY },
  crewJob: { kind: "fixed window", rate: 10, period: HOUR },
  wizardStart: { kind: "fixed window", rate: 3, period: DAY },
  // WP100: "Improve with AI" on Step 1 (IDEA_IMPROVE_DAILY_CAP).
  ideaImprove: { kind: "fixed window", rate: 20, period: DAY },
  studioImage: { kind: "fixed window", rate: 10, period: MINUTE },
  studioVideo: { kind: "fixed window", rate: 2, period: MINUTE },
  publish: { kind: "fixed window", rate: 5, period: HOUR },
});

export type WorkspaceLimitName =
  | "wrenMessage"
  | "crewJob" | "wizardStart" | "ideaImprove" | "studioImage" | "studioVideo" | "publish";

/** The owner ID is the limiter key; callers must derive it from auth or a verified project. */
export async function checkLimit(
  ctx: MutationCtx,
  name: WorkspaceLimitName,
  key: Id<"users">,
): Promise<void> {
  const feature = name === "studioVideo" ? "studioVideo" : name === "publish" ? "publish" : "ai";
  await assertFeatureEnabledForOwner(ctx, feature, key);
  if ((name === "wrenMessage" || name === "wizardStart" || name === "ideaImprove" || name === "crewJob") &&
      (await ownerAccess(ctx, key)).unlimited) return;
  const limiterName = name === "wrenMessage"
    ? ({ free: "wrenFree", builders_hub: "wrenBuildersHub", growth: "wrenGrowth" } as const)[
        (await readMembershipState(ctx, key)).plan
      ]
    : name;
  await limits.limit(ctx, limiterName, { key, throws: true });
}
