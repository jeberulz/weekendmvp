/**
 * WP90-S3. The `crew-idea-seed` request for one library idea, built the same
 * way for the dry-run estimate, the batch submit and the results read (a
 * result is read against the request it was sent with, so missing usage
 * falls back to that request's size).
 *
 * The settings come from `routeSpec` (`deep`, batch mode), the system block
 * and the output schema from the gateway's own helpers, so a seed request is
 * the request any batch spec would send. The reservation is the worst case at
 * the batch rate (`anthropicWorstCaseMicroUsd`, `batch: true`).
 *
 * Pure: no Convex runtime calls, safe in queries, mutations and actions.
 */
import { MAX_RESERVATION_MICRO_USD } from "../../lib/workspace/contracts/metering";
import { promptRef, type PromptModel } from "../../lib/workspace/contracts/prompts";
import { seedSourceJson, type SeedSource } from "../../lib/workspace/crew/seedSource";
import { inputTokenUpperBound, outputJsonSchema, systemBlocksFor } from "../ai/gateway";
import { anthropicWorstCaseMicroUsd } from "../ai/pricing";
import { ideaSeedSpec } from "../ai/prompts/ideaSeed.v2";
import type { TextRequest } from "../ai/providers/types";
import { routeSpec } from "../ai/router";

/** The seed prompt every precompute run sends: `crew-idea-seed@2`. */
export const SEED_PROMPT_REF = promptRef(ideaSeedSpec);

/** Deadline for one Batch API call (create, retrieve, results). */
export const SEED_BATCH_CALL_TIMEOUT_MS = 2 * 60 * 1_000;

export type SeedRequest = {
  readonly request: TextRequest;
  readonly model: PromptModel;
  readonly reservedMicroUsd: number;
};

/** The request and its worst-case reservation. Throws when the source is over its bound or the lane ceiling. */
export function seedRequestFor(source: SeedSource): SeedRequest {
  const route = routeSpec(ideaSeedSpec);
  if (route.mode !== "batch") throw new Error(`${SEED_PROMPT_REF} must be a batch spec`);
  const request: TextRequest = {
    model: route.model,
    effort: route.effort,
    thinking: route.thinking,
    maxTokens: route.maxTokens,
    system: systemBlocksFor(ideaSeedSpec, undefined),
    user: ideaSeedSpec.buildUser({ source: seedSourceJson(source) }),
    outputSchema: outputJsonSchema(ideaSeedSpec.outputSchema),
    timeoutMs: SEED_BATCH_CALL_TIMEOUT_MS,
  };
  const reservedMicroUsd = anthropicWorstCaseMicroUsd({
    model: route.model,
    inputTokens: inputTokenUpperBound(request),
    maxTokens: request.maxTokens,
    batch: true,
    maxInputTokens: route.maxInputTokens,
  });
  if (reservedMicroUsd > MAX_RESERVATION_MICRO_USD) {
    throw new RangeError(`reservation ${reservedMicroUsd} is over the meter's limit of ${MAX_RESERVATION_MICRO_USD}`);
  }
  return { request, model: route.model, reservedMicroUsd };
}

/** C-METER's ownerless precompute key: `precompute:{ideaSlug}:{seedVersion}:{promptRef}:{attempt}`. */
export function precomputeAttemptKey(ideaSlug: string, seedVersion: string, attempt: number): string {
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/u.test(ideaSlug)) throw new RangeError("ideaSlug must be a library slug");
  if (!SEED_VERSION.test(seedVersion)) throw new RangeError("seedVersion must be 1-40 of [0-9A-Za-z._-]");
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new RangeError(`attempt must be a positive integer, got ${attempt}`);
  return `precompute:${ideaSlug}:${seedVersion}:${SEED_PROMPT_REF}:${attempt}`;
}

/** A seed version: compared numerically by `compareSeedVersions` (for example `2026-11-07.1`). */
export const SEED_VERSION = /^[0-9A-Za-z._-]{1,40}$/u;
