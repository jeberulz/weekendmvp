// @vitest-environment node
/**
 * WP71-S3. The model router and the prompt registry. Pure: no env, no network.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { promptEntry, type PromptEntry } from "@/convex/ai/prompts/entry";
import { PROMPT_ENTRIES } from "@/convex/ai/prompts/index";
import { registryProbeSpec } from "@/convex/ai/prompts/registryProbe";
import {
  canonicalJson,
  createPromptRegistry,
  getEntry,
  getSpec,
  isPromptRegistryError,
  listEntries,
  listSpecs,
  promptContent,
  promptContentKey,
  PromptRegistryError,
  type PromptRegistryErrorCode,
} from "@/convex/ai/registry";
import { routeSpec, type RoutableSpec } from "@/convex/ai/router";
import {
  definePromptSpec,
  isPromptSpecError,
  PromptSpecError,
  TIER_MAX_INPUT_TOKENS,
  TIER_MODELS,
  type PromptSpec,
} from "@/lib/workspace/contracts/prompts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Input = { readonly topic: string };
const output = z.object({ text: z.string() });
type Output = z.infer<typeof output>;

function spec(overrides: Partial<PromptSpec<Input, Output>> = {}): Readonly<PromptSpec<Input, Output>> {
  return definePromptSpec<Input, Output>({
    id: "test-copy",
    version: 1,
    tier: "fast",
    effort: "low",
    thinking: { type: "disabled" },
    maxTokens: 1_000,
    system: "Write short copy.",
    buildUser: (inputs) => `Topic: ${inputs.topic}`,
    outputSchema: output,
    cacheLayout: { system: "stable", business: "none", ttl: "5m" },
    evalSuite: "test-copy",
    mode: "realtime",
    fallbacks: "none",
    ...overrides,
  });
}

function entry(overrides: Partial<PromptSpec<Input, Output>> = {}, sampleTopic = "sample"): PromptEntry {
  return promptEntry(spec(overrides), { sampleInputs: { topic: sampleTopic } });
}

function registryError(fn: () => unknown): PromptRegistryError {
  try {
    fn();
  } catch (error) {
    if (isPromptRegistryError(error)) return error;
    throw error;
  }
  throw new Error("expected a PromptRegistryError");
}

function codeOf(fn: () => unknown): PromptRegistryErrorCode {
  return registryError(fn).code;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

describe("routeSpec", () => {
  it("takes the model from the spec's tier", () => {
    expect(routeSpec(spec({ tier: "fast" })).model).toBe(TIER_MODELS.fast);
    expect(routeSpec(spec({ tier: "draft", thinking: { type: "between_tools" } })).model).toBe(TIER_MODELS.draft);
    expect(
      routeSpec(spec({ tier: "deep", effort: "medium", thinking: { type: "adaptive" }, mode: "batch" })).model,
    ).toBe(TIER_MODELS.deep);
  });

  it("returns the spec's explicit settings and the lane input ceiling", () => {
    const route = routeSpec(spec({ tier: "draft", effort: "low", thinking: { type: "between_tools" }, maxTokens: 6_000 }));
    expect(route).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      effort: "low",
      thinking: { type: "between_tools" },
      maxTokens: 6_000,
      maxInputTokens: TIER_MAX_INPUT_TOKENS.draft,
      mode: "realtime",
    });
    expect(Object.isFrozen(route)).toBe(true);
    expect(Object.isFrozen(route.thinking)).toBe(true);
  });

  it("uses the deep batch and deep realtime input lanes", () => {
    const batch = spec({ tier: "deep", effort: "medium", thinking: { type: "adaptive" }, mode: "batch" });
    const escalation = spec({
      tier: "deep",
      effort: "medium",
      thinking: { type: "adaptive" },
      mode: "realtime",
      purpose: "escalation",
    });
    expect(routeSpec(batch).maxInputTokens).toBe(TIER_MAX_INPUT_TOKENS.deep_batch);
    expect(routeSpec(escalation).maxInputTokens).toBe(TIER_MAX_INPUT_TOKENS.deep_realtime);
  });

  it("ignores any model a caller smuggles onto the spec object", () => {
    const sneaky = { ...spec({ tier: "fast" }), model: TIER_MODELS.deep, plan: "pro" };
    expect(routeSpec(sneaky).model).toBe(TIER_MODELS.fast);
  });

  it("throws on an unknown tier, including prototype keys", () => {
    for (const tier of ["ultra", "constructor", "", undefined]) {
      const bad = { ...spec(), tier } as unknown as RoutableSpec;
      let caught: unknown;
      try {
        routeSpec(bad);
      } catch (error) {
        caught = error;
      }
      expect(isPromptSpecError(caught)).toBe(true);
      expect((caught as PromptSpecError).code).toBe("INVALID_TIER");
    }
  });

  it("throws on an unknown mode", () => {
    const bad = { ...spec(), mode: "stream" } as unknown as RoutableSpec;
    expect(() => routeSpec(bad)).toThrow(PromptSpecError);
  });
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe("createPromptRegistry", () => {
  it("maps id@version to its spec", () => {
    const v1 = entry();
    const v2 = entry({ version: 2, system: "Write shorter copy." });
    const registry = createPromptRegistry([v2, v1]);
    expect(registry.getSpec("test-copy@1").system).toBe("Write short copy.");
    expect(registry.getSpec("test-copy@2").system).toBe("Write shorter copy.");
    expect(registry.listSpecs().map((s) => `${s.id}@${s.version}`)).toEqual(["test-copy@1", "test-copy@2"]);
    expect(registry.getEntry("test-copy@2").internal).toBe(false);
  });

  it("orders listSpecs by id, then version", () => {
    const registry = createPromptRegistry([
      entry({ id: "zeta", version: 1 }),
      entry({ id: "alpha", version: 10 }),
      entry({ id: "alpha", version: 2, system: "other" }),
    ]);
    expect(registry.listSpecs().map((s) => `${s.id}@${s.version}`)).toEqual(["alpha@2", "alpha@10", "zeta@1"]);
    expect(Object.isFrozen(registry.listSpecs())).toBe(true);
  });

  it("throws MALFORMED_REF on a ref that is not id@version", () => {
    const registry = createPromptRegistry([entry()]);
    for (const ref of ["", "test-copy", "test-copy@", "test-copy@0", "test-copy@01", "Test-Copy@1", "test-copy@1.5", "@1", "a@1@2"]) {
      expect(codeOf(() => registry.getSpec(ref))).toBe("MALFORMED_REF");
    }
    expect(codeOf(() => registry.getSpec(42 as unknown as string))).toBe("MALFORMED_REF");
  });

  it("throws UNKNOWN_REF on a well-formed ref that is not registered", () => {
    const registry = createPromptRegistry([entry()]);
    const error = registryError(() => registry.getSpec("test-copy@2"));
    expect(error.code).toBe("UNKNOWN_REF");
    expect(error.ref).toBe("test-copy@2");
    expect(error).toBeInstanceOf(PromptRegistryError);
    expect(codeOf(() => registry.getSpec("other@1"))).toBe("UNKNOWN_REF");
  });

  it("refuses a duplicate ref", () => {
    expect(codeOf(() => createPromptRegistry([entry(), entry({ system: "different" })]))).toBe("DUPLICATE_REF");
  });

  it("refuses two versions of one id with the same content", () => {
    const error = registryError(() => createPromptRegistry([entry(), entry({ version: 2 })]));
    expect(error.code).toBe("DUPLICATE_CONTENT");
    expect(error.message).toContain("test-copy@1");
  });

  it("allows the same content under different ids", () => {
    expect(() => createPromptRegistry([entry(), entry({ id: "test-copy-b", evalSuite: "test-copy" })])).not.toThrow();
  });

  it("counts a run-setting change as new content", () => {
    expect(() => createPromptRegistry([entry(), entry({ version: 2, maxTokens: 2_000 })])).not.toThrow();
  });

  it("re-validates specs that skipped definePromptSpec", () => {
    const raw = { ...spec(), effort: undefined } as unknown as Readonly<PromptSpec<Input, Output>>;
    const bad = promptEntry(raw, { sampleInputs: { topic: "x" } });
    expect(() => createPromptRegistry([bad])).toThrow(PromptSpecError);
  });
});

describe("prompt content", () => {
  it("covers system text, task source and sample, output schema and run settings", () => {
    const content = promptContent(entry());
    expect(content.system).toBe("Write short copy.");
    expect(content.task.sample).toBe("Topic: sample");
    expect(content.task.source).toContain("Topic:");
    expect(content.outputSchema).toMatchObject({ type: "object", required: ["text"] });
    expect(content.outputSchema).not.toHaveProperty("$schema");
    expect(content.run).toMatchObject({ tier: "fast", effort: "low", maxTokens: 1_000, purpose: null });
  });

  it("changes when the text, the schema or a template constant changes", () => {
    const base = promptContentKey(entry());
    expect(promptContentKey(entry({ system: "Write long copy." }))).not.toBe(base);
    expect(promptContentKey(entry({ outputSchema: z.object({ text: z.string().max(10) }) }))).not.toBe(base);
    expect(promptContentKey(entry({}, "another sample"))).not.toBe(base);
    expect(promptContentKey(entry({ version: 9 }))).toBe(base);
  });

  it("canonicalJson sorts keys at every depth and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[2,{"y":2,"z":1}]},"b":1}');
    expect(() => canonicalJson({ f: () => 1 })).toThrow(TypeError);
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalJson(new Date(0))).toThrow(TypeError);
  });
});

describe("the default registry", () => {
  it("serves the internal registry probe", () => {
    const probe = getSpec("internal-registry-probe@1");
    expect(probe.id).toBe(registryProbeSpec.id);
    expect(getEntry("internal-registry-probe@1").internal).toBe(true);
    expect(routeSpec(probe)).toMatchObject({ provider: "anthropic", model: TIER_MODELS.fast, maxTokens: 256 });
  });

  it("lists every entry in prompts/index.ts", () => {
    expect(listSpecs()).toHaveLength(PROMPT_ENTRIES.length);
    expect(listEntries().map((e) => e.spec.id)).toContain("internal-registry-probe");
  });

  it("throws typed errors on malformed and unknown refs", () => {
    expect(codeOf(() => getSpec("internal-registry-probe"))).toBe("MALFORMED_REF");
    expect(codeOf(() => getSpec("internal-registry-probe@2"))).toBe("UNKNOWN_REF");
  });
});
