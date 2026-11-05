/**
 * WP71-S3. One registry entry: a C-PROMPT spec plus what the version check
 * needs to fingerprint its task template.
 *
 * `buildUser` is a function, so its text cannot be read as data. The content
 * hash (`registry.ts`, `promptContent`) takes both its source and its output for
 * `sampleInputs`, so a change to the template, or to a constant the template
 * reads, changes the hash. Pick sample inputs that reach every branch of the
 * template.
 *
 * Imports carry explicit `.ts` extensions so `scripts/check-prompt-versions.mjs`
 * can load the registry under `node --experimental-strip-types`.
 */

import type { PromptSpec } from "../../../lib/workspace/contracts/prompts.ts";

/**
 * A spec with its input type erased, so specs with different inputs share one
 * list. `buildUser(never)` accepts any typed `buildUser`; a caller that needs
 * the typed spec imports the spec module directly.
 */
export type RegisteredSpec = Readonly<PromptSpec<never, unknown>>;

export type PromptEntry = {
  readonly spec: RegisteredSpec;
  /** Internal specs (registry probes, fixtures) are never a crew job's prompt. */
  readonly internal: boolean;
  /** `spec.buildUser(sampleInputs)`, bound at entry time with the typed input. */
  readonly renderSample: () => string;
};

export type PromptEntryOptions<TInput> = {
  readonly sampleInputs: TInput;
  readonly internal?: boolean;
};

export function promptEntry<TInput, TOutput>(
  spec: Readonly<PromptSpec<TInput, TOutput>>,
  options: PromptEntryOptions<TInput>,
): PromptEntry {
  const { sampleInputs } = options;
  return Object.freeze({
    spec,
    internal: options.internal === true,
    renderSample: () => spec.buildUser(sampleInputs),
  });
}
