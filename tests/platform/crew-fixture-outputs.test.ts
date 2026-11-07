/**
 * WP75-S2a. The fixture-output registry (`convex/ai/providers/fixtureOutputs.ts`):
 * every registered output is a valid artifact, lookups by artifact schema and
 * by prompt ref work through the fixture Claude client, and live mode never
 * reaches the registry. No test reaches the network.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { afterEach, describe, expect, test, vi } from "vitest";

import { outputJsonSchema } from "@/convex/ai/gateway";
import { createAnthropicAdapter, type AnthropicMessagesClient } from "@/convex/ai/providers/anthropic";
import { createFixtureAnthropicClient } from "@/convex/ai/providers/fixtures";
import {
  ARTIFACT_FIXTURES,
  FIXTURE_OUTPUTS_BY_REF,
  createFixtureOutputRegistry,
  fixtureOutputFor,
} from "@/convex/ai/providers/fixtureOutputs";
import type { PromptEntry } from "@/convex/ai/registry";
import type { TextRequest } from "@/convex/ai/providers/types";
import {
  ARTIFACT_KINDS,
  artifactOutputSchemas,
  parseModelOutput,
} from "@/lib/workspace/contracts/artifacts";
import { TIER_MODELS, promptRef } from "@/lib/workspace/contracts/prompts";
import { wrenChatSpec } from "@/convex/ai/prompts/wrenChat";
import { wrenPlanTurnSpec } from "@/convex/ai/prompts/wrenPlanTurn";

// Request and message types come from the adapter's client type: tests never import the provider SDK.
type MessageParams = Parameters<AnthropicMessagesClient["messages"]["create"]>[0];
type Message = Awaited<ReturnType<AnthropicMessagesClient["messages"]["create"]>>;

vi.mock("@/convex/ai/providers/fixtureOutputs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/convex/ai/providers/fixtureOutputs")>();
  return { ...actual, fixtureOutputFor: vi.fn(actual.fixtureOutputFor) };
});

afterEach(() => {
  vi.mocked(fixtureOutputFor).mockClear();
});

function params(schema: z.ZodType, system = "Any system block"): MessageParams {
  return {
    model: TIER_MODELS.fast,
    max_tokens: 4_096,
    system: [{ type: "text", text: system }],
    messages: [{ role: "user", content: "Draft it." }],
    output_config: { format: { type: "json_schema", schema: outputJsonSchema(schema) } },
  };
}

function request(schema: z.ZodType): TextRequest {
  return {
    model: TIER_MODELS.fast,
    effort: "low",
    thinking: { type: "disabled" },
    maxTokens: 4_096,
    system: [{ text: "You are a test crew member.", cacheBreakpoint: true }],
    user: "Draft the brand kit.",
    outputSchema: outputJsonSchema(schema),
    timeoutMs: 5_000,
  };
}

function replyText(message: Message): string {
  return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

describe("fixture-output registry", () => {
  test("every artifact fixture is a valid model output for its schema and a valid stored artifact", () => {
    expect(ARTIFACT_FIXTURES.length).toBeGreaterThan(0);
    for (const fixture of ARTIFACT_FIXTURES) {
      const output = fixture.output(params(fixture.schema));
      expect(fixture.schema.safeParse(output).success, fixture.key).toBe(true);
      const kind = fixture.key.split(":")[0] as (typeof ARTIFACT_KINDS)[number];
      expect(parseModelOutput(kind, output).success, fixture.key).toBe(true);
      // A fresh copy each time: a caller cannot mutate the next reply.
      expect(fixture.output(params(fixture.schema))).not.toBe(output);
    }
    // Every model-facing artifact schema has a fixture.
    const keys = new Set(ARTIFACT_FIXTURES.map((fixture) => fixture.key));
    for (const kind of Object.keys(artifactOutputSchemas)) expect(keys.has(kind), kind).toBe(true);
    // By ref: Wren's two chat prompts (L1 beta), nothing else.
    expect(Object.keys(FIXTURE_OUTPUTS_BY_REF).sort()).toEqual([promptRef(wrenChatSpec), promptRef(wrenPlanTurnSpec)].sort());
  });

  test("lookup by artifact schema returns that artifact; an unknown schema returns nothing", () => {
    const registry = createFixtureOutputRegistry();
    for (const kind of ["brand_kit", "landing_spec", "blueprint", "build_pack"] as const) {
      const output = registry.outputFor(params(artifactOutputSchemas[kind]));
      expect(parseModelOutput(kind, output).success, kind).toBe(true);
    }
    expect(registry.outputFor(params(z.object({ echo: z.string() })))).toBeUndefined();
    const noSchema = params(artifactOutputSchemas.brand_kit);
    delete noSchema.output_config;
    expect(registry.outputFor(noSchema)).toBeUndefined();
  });

  test("lookup by prompt ref matches the registered spec's system block and schema, before the kind fallback", () => {
    const schema = artifactOutputSchemas.brand_kit;
    const entry = { spec: { system: "Ref-specific system.", outputSchema: schema } } as unknown as PromptEntry;
    const registry = createFixtureOutputRegistry({
      byRef: { "test-ref@1": () => ({ marker: "by-ref" }) },
      getEntry: (ref) => {
        if (ref !== "test-ref@1") throw new Error(`unknown ref ${ref}`);
        return entry;
      },
    });
    expect(registry.outputFor(params(schema, "Ref-specific system."))).toEqual({ marker: "by-ref" });
    expect(parseModelOutput("brand_kit", registry.outputFor(params(schema, "Another system."))).success).toBe(true);
  });

  test("a ref with no registered spec fails loudly on every lookup, not only the first", () => {
    const getEntry = vi.fn(() => {
      throw new Error("unknown prompt ref");
    });
    const registry = createFixtureOutputRegistry({ byRef: { "missing@1": () => ({}) }, getEntry });
    // The index is built once, when the registry is made.
    expect(getEntry).toHaveBeenCalledTimes(1);
    expect(() => registry.outputFor(params(artifactOutputSchemas.brand_kit))).toThrow("unknown prompt ref");
    expect(() => registry.outputFor(params(artifactOutputSchemas.seo_pack))).toThrow("unknown prompt ref");
    expect(getEntry).toHaveBeenCalledTimes(1);
  });

  test("end to end: the fixture client answers an artifact request with a valid artifact", async () => {
    const client = createFixtureAnthropicClient();
    const message = await client.messages.create(params(artifactOutputSchemas.seo_pack));
    expect(parseModelOutput("seo_pack", JSON.parse(replyText(message))).success).toBe(true);
    expect(fixtureOutputFor).toHaveBeenCalledTimes(1);
  });

  test("a responder still wins over the registry", async () => {
    const client = createFixtureAnthropicClient(() => ({ json: { scripted: true } }));
    const message = await client.messages.create(params(artifactOutputSchemas.seo_pack));
    expect(JSON.parse(replyText(message))).toEqual({ scripted: true });
    expect(fixtureOutputFor).not.toHaveBeenCalled();
  });

  test("fixture mode through the adapter uses the registry; live mode never reaches it", async () => {
    const fixture = createAnthropicAdapter({ env: {} });
    const drafted = await fixture.complete(request(artifactOutputSchemas.brand_kit));
    expect(parseModelOutput("brand_kit", drafted.json).success).toBe(true);
    expect(fixtureOutputFor).toHaveBeenCalledTimes(1);
    vi.mocked(fixtureOutputFor).mockClear();

    const liveText = JSON.stringify({ from: "live client" });
    const calls: MessageParams[] = [];
    const client: AnthropicMessagesClient = {
      messages: {
        async create(sent) {
          calls.push(sent);
          return {
            id: "msg_live_fake", type: "message", role: "assistant", model: TIER_MODELS.fast,
            container: null, diagnostics: null,
            content: [{ type: "text", text: liveText, citations: null }],
            stop_reason: "end_turn", stop_sequence: null, stop_details: null,
            usage: {
              input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
              cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
              output_tokens_details: { thinking_tokens: 0 },
              inference_geo: null, server_tool_use: null, service_tier: "standard", speed: null,
            },
          } as Message;
        },
      },
    };
    const live = createAnthropicAdapter({
      env: { AI_PROVIDER_MODE: "live", ANTHROPIC_API_KEY: "test-anthropic-key" },
      clientFactory: () => client,
    });
    const result = await live.complete(request(artifactOutputSchemas.brand_kit));
    expect(calls).toHaveLength(1);
    expect(result.text).toBe(liveText);
    expect(fixtureOutputFor).not.toHaveBeenCalled();
  });

  test("only the fixture client imports the registry, and only the registry imports the Wren fixture reply", () => {
    const root = process.cwd();
    const importersOf = (module: string): string[] => {
      const pattern = new RegExp(`from\\s+["'][^"']*${module}["']`);
      const importers: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          if (name === "node_modules" || name === "_generated" || name.startsWith(".")) continue;
          const path = join(dir, name);
          if (statSync(path).isDirectory()) walk(path);
          else if (/\.(ts|tsx|mts|mjs|js)$/.test(name) && !/\.test\.(ts|tsx|mjs)$/.test(name)) {
            if (pattern.test(readFileSync(path, "utf8"))) importers.push(relative(root, path));
          }
        }
      };
      for (const dir of ["convex", "lib", "app", "components", "scripts"]) walk(join(root, dir));
      return importers;
    };
    expect(importersOf("fixtureOutputs")).toEqual(["convex/ai/providers/fixtures.ts"]);
    expect(importersOf("wrenFixtureReply")).toEqual(["convex/ai/providers/fixtureOutputs.ts"]);
  });
});
