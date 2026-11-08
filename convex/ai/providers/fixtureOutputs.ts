/**
 * WP75-S2a. Fixture outputs: what the fixture Claude client replies with when
 * a request asks for a crew artifact (progress Stop-and-ask 3, approved).
 *
 * Without this, a fixture run replies with the smallest instance of the JSON
 * Schema (`sampleFromJsonSchema`), which fails the C-ART refinements, so a
 * fixture launch could not store a single artifact.
 *
 * Fixture only, by construction:
 * - the only caller is `createFixtureAnthropicClient` (`fixtures.ts`), which
 *   the Claude adapter builds only when `providerMode(env)` is `"fixture"`;
 *   the live branch builds the SDK client instead and never reaches this file
 *   (`tests/platform/crew-fixture-outputs.test.ts` checks both the behaviour
 *   and that nothing else imports this module);
 * - nothing here reads env, the network or the clock.
 *
 * Lookup, in order (first match wins), from the request the adapter built:
 * 1. by prompt ref: `FIXTURE_OUTPUTS_BY_REF` maps `id@version` to a reply. The
 *    request carries no ref, so the registered spec is recognised by its
 *    system block and output schema together (the gateway sends exactly
 *    `spec.system` as the first system block and the spec's schema as
 *    `output_config.format.schema`);
 * 2. by artifact schema: a request whose output schema is a C-ART model-facing
 *    schema (`artifactOutputSchemas`, or one variant of a union kind) gets the
 *    HydroTrail instance of that artifact (`contracts/fixtures/hydrotrail.ts`),
 *    the generic fallback per kind. A generator whose spec uses the C-ART
 *    schema as its output gets a valid artifact with no registration;
 * 3. nothing: the caller falls back to `sampleFromJsonSchema`.
 * A responder passed to the fixture client (tests) still wins over all three.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import {
  artifactOutputSchemas,
  blueprintVariantSchemas,
  buildPackVariantSchemas,
  type ArtifactKind,
} from "../../../lib/workspace/contracts/artifacts";
import {
  hydrotrailArtifacts,
  lightBuildPack,
  ownIdeaLightBlueprint,
} from "../../../lib/workspace/contracts/fixtures/hydrotrail";
import { promptRef } from "../../../lib/workspace/contracts/prompts";
import { blueprintOwnIdeaSpec } from "../prompts/blueprintOwnIdea.v3";
import { blueprintPersonaliseSpec } from "../prompts/blueprintPersonalise.v3";
import { ideaSeedSpec } from "../prompts/ideaSeed.v2";
import { wrenChatSpec } from "../prompts/wrenChat";
import { wrenPlanTurnSpec } from "../prompts/wrenPlanTurn";
import { canonicalJson, getEntry, type PromptEntry } from "../registry";
import { blueprintFixtureReply } from "./blueprintFixtureReply";
import { seedFixtureReply } from "./seedFixtureReply";
import { wrenFixtureReply } from "./wrenFixtureReply";
import { wireOutputSchema } from "./wireSchema";

/**
 * A fixture reply value: the JSON the fixture model "returns". It may read
 * the request (a reply built from the request's own context); it must not
 * read env, the network or the clock.
 */
export type FixtureOutput = (params: Anthropic.MessageCreateParamsNonStreaming) => unknown;

/**
 * Prompt-specific fixture replies, keyed by `id@version`: a spec whose output
 * schema is not a C-ART schema registers its reply here.
 * - Wren's chat turns (`wren-chat`, `wren-plan-turn`, L1 beta): a reply built
 *   from the founder's message and the business context
 *   (`wrenFixtureReply.ts`). Both specs share a system block and an output
 *   schema, so they share one fingerprint; the reply tells them apart by
 *   the task block.
 * - The blueprint prompts (version 3, roster per idea WP91): the HydroTrail or
 *   own-idea blueprint with a profile and team picked from the idea's own
 *   words (`blueprintFixtureReply.ts`), so local teams differ by idea.
 * - The per-idea seed (`crew-idea-seed@2`, WP90-S3): a test-mode seed draft
 *   built from the quoted idea page (`seedFixtureReply.ts`).
 */
export const FIXTURE_OUTPUTS_BY_REF: Readonly<Record<string, FixtureOutput>> = Object.freeze({
  [promptRef(wrenChatSpec)]: wrenFixtureReply,
  [promptRef(wrenPlanTurnSpec)]: wrenFixtureReply,
  [promptRef(blueprintPersonaliseSpec)]: blueprintFixtureReply,
  [promptRef(blueprintOwnIdeaSpec)]: blueprintFixtureReply,
  [promptRef(ideaSeedSpec)]: seedFixtureReply,
});

type ArtifactFixture = { readonly key: string; readonly schema: z.ZodType; readonly output: FixtureOutput };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The landing spec as the model drafts it: the stored spec without the code-added proof slots. */
function landingDraft(): unknown {
  const draft: Record<string, unknown> = { ...clone(hydrotrailArtifacts.landing_spec) };
  delete draft.proofSlots;
  return draft;
}

const OBJECT_KINDS = [
  "roster_plan",
  "brand_kit",
  "email_sequence",
  "social_pack",
  "seo_pack",
  "launch_plan",
  "ads_drafts",
] as const satisfies readonly ArtifactKind[];

/** One valid instance per model-facing artifact schema (object kinds, union variants, the landing draft). */
export const ARTIFACT_FIXTURES: readonly ArtifactFixture[] = Object.freeze([
  ...OBJECT_KINDS.map((kind): ArtifactFixture => ({
    key: kind,
    schema: artifactOutputSchemas[kind],
    output: () => clone(hydrotrailArtifacts[kind]),
  })),
  { key: "landing_spec", schema: artifactOutputSchemas.landing_spec, output: landingDraft },
  { key: "blueprint:library", schema: blueprintVariantSchemas.library, output: () => clone(hydrotrailArtifacts.blueprint) },
  { key: "blueprint:own_idea", schema: blueprintVariantSchemas.own_idea, output: () => clone(ownIdeaLightBlueprint) },
  { key: "blueprint", schema: artifactOutputSchemas.blueprint, output: () => clone(hydrotrailArtifacts.blueprint) },
  { key: "build_pack:full", schema: buildPackVariantSchemas.full, output: () => clone(hydrotrailArtifacts.build_pack) },
  { key: "build_pack:light", schema: buildPackVariantSchemas.light, output: () => clone(lightBuildPack) },
  { key: "build_pack", schema: artifactOutputSchemas.build_pack, output: () => clone(hydrotrailArtifacts.build_pack) },
]);

/** The output schema as the request carries it: zod's JSON Schema without `$schema`, in its wire form (`wireOutputSchema`). */
function sentSchema(schema: z.ZodType): Record<string, unknown> {
  const json: Record<string, unknown> = { ...z.toJSONSchema(schema) };
  delete json.$schema;
  return wireOutputSchema(json);
}

function schemaKey(schema: unknown): string | null {
  try {
    return canonicalJson(schema);
  } catch {
    return null;
  }
}

function firstSystemText(params: Anthropic.MessageCreateParamsNonStreaming): string | null {
  const system = params.system;
  if (system === undefined) return null;
  if (typeof system === "string") return system;
  return system[0]?.text ?? null;
}

export type FixtureOutputRegistry = {
  /** The fixture reply for a request, or undefined when none applies. */
  readonly outputFor: (params: Anthropic.MessageCreateParamsNonStreaming) => unknown;
};

export type FixtureOutputRegistryOptions = {
  readonly byRef?: Readonly<Record<string, FixtureOutput>>;
  readonly artifacts?: readonly ArtifactFixture[];
  /** Resolves a ref to its registered entry (the prompt registry by default). */
  readonly getEntry?: (ref: string) => PromptEntry;
};

/**
 * Builds a registry. Both indexes are built here, eagerly. A registered ref
 * with no spec (a registration bug) makes EVERY lookup throw, so a fixture run
 * can never quietly fall back to the generic reply for it.
 */
export function createFixtureOutputRegistry(options: FixtureOutputRegistryOptions = {}): FixtureOutputRegistry {
  const byRef = options.byRef ?? FIXTURE_OUTPUTS_BY_REF;
  const artifacts = options.artifacts ?? ARTIFACT_FIXTURES;
  const resolve = options.getEntry ?? getEntry;

  const refFingerprint = (system: string, schema: unknown): string | null => {
    const key = schemaKey(schema);
    return key === null ? null : `${canonicalJson(system)}\u0000${key}`;
  };

  const refs = new Map<string, FixtureOutput>();
  let registrationError: Error | null = null;
  try {
    for (const [ref, output] of Object.entries(byRef)) {
      const { spec } = resolve(ref);
      const fingerprint = refFingerprint(spec.system, sentSchema(spec.outputSchema));
      if (fingerprint !== null) refs.set(fingerprint, output);
    }
  } catch (error) {
    registrationError = error instanceof Error ? error : new Error(String(error));
  }
  const schemas = new Map<string, FixtureOutput>();
  for (const fixture of artifacts) {
    const key = schemaKey(sentSchema(fixture.schema));
    if (key !== null && !schemas.has(key)) schemas.set(key, fixture.output);
  }

  return {
    outputFor(params) {
      if (registrationError !== null) throw registrationError;
      const schema = params.output_config?.format?.schema;
      if (schema === undefined) return undefined;
      const system = firstSystemText(params);
      if (system !== null) {
        const fingerprint = refFingerprint(system, schema);
        const byPrompt = fingerprint === null ? undefined : refs.get(fingerprint);
        if (byPrompt !== undefined) return byPrompt(params);
      }
      const key = schemaKey(schema);
      const byKind = key === null ? undefined : schemas.get(key);
      return byKind === undefined ? undefined : byKind(params);
    },
  };
}

let defaultRegistry: FixtureOutputRegistry | null = null;

/** The fixture reply for a request from the default registry, or undefined. Fixture client only. */
export function fixtureOutputFor(params: Anthropic.MessageCreateParamsNonStreaming): unknown {
  defaultRegistry ??= createFixtureOutputRegistry();
  return defaultRegistry.outputFor(params);
}
