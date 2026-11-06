/**
 * WP77-S3. A plan-changing Wren turn: the `draft` tier (`02` §5.2: "Wren
 * turns that change the plan"). Chosen only by the routing rule in
 * `lib/workspace/wren.ts`, and only while the business has an escalation left
 * today (`WREN_ESCALATIONS_PER_BUSINESS_PER_DAY`). Thinking stays off
 * (`between_tools`), as the tier plans.
 *
 * Wren still changes nothing here: it proposes the change, and the founder
 * confirms it on a card (S4).
 *
 * Any change to this file or to `wrenShared.ts` (comments included) needs a
 * version bump, then `scripts/check-prompt-versions.mjs --write`.
 */

import { definePromptSpec } from "../../../lib/workspace/contracts/prompts.ts";
import {
  WREN_SYSTEM_RULES,
  wrenReplyOutput,
  wrenTaskBlock,
  type WrenReplyOutput,
  type WrenTurnInput,
} from "./wrenShared.ts";

export const wrenPlanTurnSpec = definePromptSpec<WrenTurnInput, WrenReplyOutput>({
  id: "wren-plan-turn",
  version: 1,
  tier: "draft",
  effort: "low",
  thinking: { type: "between_tools" },
  maxTokens: 2_048,
  system: WREN_SYSTEM_RULES,
  buildUser: (inputs) =>
    wrenTaskBlock(
      inputs,
      "The founder wants to change their weekend plan. Work out what they are asking for, then propose the change " +
        "as a short, concrete suggestion: what moves, what it affects, and what stays the same. You cannot change " +
        "the plan yourself; say they will confirm it.",
    ),
  outputSchema: wrenReplyOutput,
  cacheLayout: { system: "stable", business: "per_business", ttl: "5m" },
  evalSuite: "wren-chat",
  mode: "realtime",
  fallbacks: "none",
});
