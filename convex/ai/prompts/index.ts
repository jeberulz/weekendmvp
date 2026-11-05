/**
 * WP71-S3. Every registered prompt spec (`02` §5.3). Add a spec here with its
 * sample inputs; `convex/ai/registry.ts` builds the registry from this list,
 * and `scripts/check-prompt-versions.mjs` locks each `id@version`.
 *
 * Keeping an old version: leave its entry here next to the new one. Retiring
 * one: remove the entry and add a `retired` note to its lock entry.
 */

import { promptEntry, type PromptEntry } from "./entry.ts";
import { registryProbeSpec } from "./registryProbe.ts";

export const PROMPT_ENTRIES: readonly PromptEntry[] = Object.freeze([
  promptEntry(registryProbeSpec, { sampleInputs: { label: "registry probe sample" }, internal: true }),
]);
