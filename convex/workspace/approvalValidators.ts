import { v } from "convex/values";
import { APPROVAL_STATUSES } from "../../lib/workspace/contracts/approvals";

export const approvalStatusValidator = v.union(...APPROVAL_STATUSES.map((status) => v.literal(status)));

export const changeRoundUnavailableValidator = v.union(
  v.literal("price_not_set"),
  v.literal("plan_gated"),
  v.literal("not_revisable"),
  v.literal("untracked"),
  v.literal("busy"),
  v.literal("stale"),
  v.literal("conflict"),
);

export const changeRoundOutcomeValidator = v.union(
  v.object({ outcome: v.literal("free"), changeRound: v.number(), freeRoundsLeft: v.number(), unlimited: v.optional(v.boolean()), taskId: v.id("tasks") }),
  v.object({
    outcome: v.literal("spend_required"),
    changeRound: v.number(),
    costCredits: v.number(),
    spendApprovalId: v.id("approvals"),
  }),
  v.object({ outcome: v.literal("not_available"), reason: changeRoundUnavailableValidator, changeRound: v.optional(v.number()) }),
);
