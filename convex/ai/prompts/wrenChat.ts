/**
 * WP77-S3. Wren's everyday chat turn: the `fast` tier (`02` §5.2, D11).
 * Every turn runs this unless the routing rule in `lib/workspace/wren.ts`
 * marks it plan-changing and the business has an escalation left today.
 *
 * Any change to this file or to `wrenShared.ts` (comments included: the lock
 * hashes module source) needs a version bump, then
 * `node --experimental-strip-types scripts/check-prompt-versions.mjs --write`.
 */

import { definePromptSpec } from "../../../lib/workspace/contracts/prompts.ts";
import {
  WREN_SYSTEM_RULES,
  wrenReplyOutput,
  wrenTaskBlock,
  type WrenReplyOutput,
  type WrenTurnInput,
} from "./wrenShared.ts";

export const wrenChatSpec = definePromptSpec<WrenTurnInput, WrenReplyOutput>({
  id: "wren-chat",
  version: 1,
  tier: "fast",
  effort: "low",
  thinking: { type: "disabled" },
  maxTokens: 1_024,
  system: WREN_SYSTEM_RULES,
  buildUser: (inputs) =>
    wrenTaskBlock(
      inputs,
      "Answer the founder's message as Wren. Be brief and specific to their business.",
    ),
  outputSchema: wrenReplyOutput,
  cacheLayout: { system: "stable", business: "per_business", ttl: "5m" },
  evalSuite: "wren-chat",
  mode: "realtime",
  fallbacks: "none",
});
