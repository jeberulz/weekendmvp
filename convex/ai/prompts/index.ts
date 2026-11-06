/**
 * WP71-S3. Every registered prompt spec (`02` §5.3). Add a spec here with its
 * module path and sample inputs; `convex/ai/registry.ts` builds the registry
 * from this list, and `scripts/check-prompt-versions.mjs` locks each
 * `id@version`.
 *
 * `module` is the repo-relative path of the file that defines the spec, and
 * the entry must register that module's exported spec object unchanged (the
 * script checks every field). The lock hashes that file and every repo-local
 * module it imports at runtime (not `node_modules`, not
 * `lib/workspace/contracts/prompts.ts`), so a locked version's module is
 * frozen. Keep each version in its own module (`brandKit.v1.ts`,
 * `brandKit.v2.ts`) when an old one must stay registered.
 *
 * Dependency bumps count too: the `outputSchema` part is zod's
 * `toJSONSchema` output, so a zod upgrade that changes it (and a C-PROMPT
 * change to `TIER_MODELS` or a ceiling, through the `run` part) fails every
 * locked prompt it touches and forces a version bump of each.
 *
 * Retiring a version: remove its entry here and add a `retired` note to its
 * lock entry.
 */

import { promptEntry, type PromptEntry } from "./entry.ts";
import { registryProbeSpec } from "./registryProbe.ts";
import { wrenChatSpec } from "./wrenChat.ts";
import { wrenPlanTurnSpec } from "./wrenPlanTurn.ts";

const WREN_SAMPLE = {
  message: "Can we move the launch email to Sunday morning?",
  history: ["founder: The brand kit looks good.", "wren: Great. The landing page is next."],
} as const;

export const PROMPT_ENTRIES: readonly PromptEntry[] = Object.freeze([
  promptEntry(registryProbeSpec, {
    module: "convex/ai/prompts/registryProbe.ts",
    sampleInputs: { label: "registry probe sample" },
    internal: true,
  }),
  promptEntry(wrenChatSpec, { module: "convex/ai/prompts/wrenChat.ts", sampleInputs: WREN_SAMPLE }),
  promptEntry(wrenPlanTurnSpec, { module: "convex/ai/prompts/wrenPlanTurn.ts", sampleInputs: WREN_SAMPLE }),
]);
