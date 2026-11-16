/**
 * Every prompt's reply schema, as it goes over the wire to Anthropic's
 * structured outputs (`output_config.format`), uses only the JSON Schema the
 * API accepts. The first live batch on production (2026-11-08) failed every
 * request with `invalid_request_error`: zod's schema carried `minLength`,
 * `maxLength`, `maxItems` and `minItems` above 1, which structured outputs
 * reject. The limits still hold: the gateway parses every reply with the
 * spec's zod schema.
 *
 * Two schemas are accepted keyword by keyword but refused as a whole ("The
 * compiled grammar is too large", live probe 2026-11-08): the seed and the
 * social pack. Those specs set `outputMode: "prompted"`, and their schema goes
 * in a system block instead of `output_config.format`.
 */
import { describe, expect, test } from "vitest";

import { inputTokenUpperBound, outputJsonSchema, systemBlocksFor } from "@/convex/ai/gateway";
import { PROMPT_ENTRIES } from "@/convex/ai/prompts";
import { buildMessageParams, readMessage } from "@/convex/ai/providers/anthropic";
import { createFixtureAnthropicClient } from "@/convex/ai/providers/fixtures";
import type { TextRequest } from "@/convex/ai/providers/types";
import { routeSpec } from "@/convex/ai/router";
import { PROMPTED_SCHEMA_HEADER, promptedSchemaFrom, unfencedJson } from "@/convex/ai/providers/wireSchema";
import { seedRequestFor } from "@/convex/crew/seedRequest";
import { hydrotrailManifestRow, hydrotrailPageMdx } from "@/lib/workspace/contracts/fixtures/seedSources";
import { seedSourceFromPage } from "@/lib/workspace/crew/seedSource";

/** Keywords structured outputs rejects. `minItems` is checked apart: 0 and 1 are allowed. */
const REJECTED = new Set([
  "minLength",
  "maxLength",
  "maxItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "pattern",
  "minProperties",
  "maxProperties",
  "uniqueItems",
  "propertyNames",
  "patternProperties",
]);
const FORMATS = new Set(["date-time", "time", "date", "duration", "email", "hostname", "uri", "ipv4", "ipv6", "uuid"]);

function problems(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((child, index) => problems(child, `${path}[${index}]`));
  if (node === null || typeof node !== "object") return [];
  const schema = node as Record<string, unknown>;
  const found: string[] = [];
  for (const key of Object.keys(schema)) if (REJECTED.has(key)) found.push(`${path}: ${key}`);
  if (typeof schema.minItems === "number" && schema.minItems > 1) found.push(`${path}: minItems ${schema.minItems}`);
  if (typeof schema.format === "string" && !FORMATS.has(schema.format)) found.push(`${path}: format ${schema.format}`);
  if (schema.type === "object" && schema.additionalProperties !== false) found.push(`${path}: additionalProperties`);
  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && value !== null && typeof value === "object") {
      for (const [name, child] of Object.entries(value)) found.push(...problems(child, `${path}.${name}`));
    } else if (typeof value === "object") {
      found.push(...problems(value, `${path}.${key}`));
    }
  }
  return found;
}

const specsWithSchema = PROMPT_ENTRIES.map((entry) => entry.spec).filter((spec) => spec.outputSchema !== undefined);

function requestFor(spec: (typeof specsWithSchema)[number]): TextRequest {
  const route = routeSpec(spec);
  return {
    model: route.model,
    effort: route.effort,
    thinking: route.thinking,
    maxTokens: route.maxTokens,
    system: systemBlocksFor({ ...spec, cacheLayout: { ...spec.cacheLayout, business: "none" } }, undefined),
    user: "task",
    outputSchema: outputJsonSchema(spec.outputSchema),
    ...(route.outputMode === undefined ? {} : { outputMode: route.outputMode }),
    timeoutMs: 60_000,
  };
}

/** The schema the request sends: `output_config.format.schema`, or the prompted system block's. */
function sentSchema(params: ReturnType<typeof buildMessageParams>): unknown {
  const format = params.output_config?.format;
  if (format && "schema" in format) return format.schema;
  const system = Array.isArray(params.system) ? params.system : [];
  return promptedSchemaFrom(system[1]?.text ?? "");
}

/** Refused as a grammar by the live API on 2026-11-08; each must stay prompted. */
const GRAMMAR_TOO_LARGE = ["crew-idea-seed", "crew-social-pack"];

describe("structured output schemas on the wire", () => {
  test("every registered prompt has a reply schema to check", () => {
    expect(specsWithSchema.length).toBeGreaterThanOrEqual(5);
  });

  for (const spec of specsWithSchema) {
    test(`${spec.id}: only keywords structured outputs accepts`, () => {
      const params = buildMessageParams(requestFor(spec));
      const format = params.output_config?.format;
      if (spec.outputMode === "prompted") {
        expect(format).toBeUndefined();
      } else {
        expect(format?.type).toBe("json_schema");
      }
      const schema = sentSchema(params);
      expect(schema).toBeDefined();
      expect(problems(schema)).toEqual([]);
    });

    test(`${spec.id}: the input bound covers the schema that is sent`, () => {
      const request = requestFor(spec);
      const params = buildMessageParams(request);
      const system = Array.isArray(params.system) ? params.system : [];
      const sentBytes =
        spec.outputMode === "prompted"
          ? Buffer.byteLength(system[1]?.text ?? "")
          : Buffer.byteLength(JSON.stringify(sentSchema(params)));
      const withoutSchema = inputTokenUpperBound({ ...request, outputSchema: undefined });
      expect(inputTokenUpperBound(request) - withoutSchema).toBeGreaterThanOrEqual(sentBytes);
    });
  }

  test("every schema the API refused as a grammar is sent prompted", () => {
    for (const id of GRAMMAR_TOO_LARGE) {
      expect(specsWithSchema.find((spec) => spec.id === id)?.outputMode).toBe("prompted");
    }
  });

  test("a prompted request carries the schema after the system text, under the same cache breakpoint", () => {
    const seed = specsWithSchema.find((spec) => spec.id === "crew-idea-seed");
    if (seed === undefined) throw new Error("expected the seed spec");
    const request = requestFor(seed);
    const params = buildMessageParams(request);
    const system = Array.isArray(params.system) ? params.system : [];
    expect(system).toHaveLength(2);
    expect(system[0]).toEqual({ type: "text", text: seed.system });
    expect(system[1]?.text.startsWith(PROMPTED_SCHEMA_HEADER)).toBe(true);
    expect(system[1]?.cache_control).toEqual({ type: "ephemeral", ttl: "5m" });
    expect(params.output_config).toEqual({ effort: request.effort });
  });

  test("a prompted reply wrapped in one code fence still parses; prose does not", () => {
    expect(unfencedJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(unfencedJson('  {"a":1}  ')).toBe('{"a":1}');
    const seed = specsWithSchema.find((spec) => spec.id === "crew-idea-seed");
    if (seed === undefined) throw new Error("expected the seed spec");
    const request = requestFor(seed);
    const message = (text: string) => ({
      id: "msg_1",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
    expect(readMessage(message('```json\n{"a":1}\n```'), request).json).toEqual({ a: 1 });
    expect(() => readMessage(message('Here is the seed: {"a":1}'), request)).toThrow(/not valid JSON/u);
  });

  test("the limits move into the field's description, where the model can read them", () => {
    const seed = specsWithSchema.find((spec) => spec.id === "crew-idea-seed");
    if (seed === undefined) throw new Error("expected the seed spec");
    expect(JSON.stringify(sentSchema(buildMessageParams(requestFor(seed))))).toMatch(/maxLength: \d+/u);
  });

  test("the fixture client still answers the request as sent", async () => {
    const client = createFixtureAnthropicClient();
    const source = seedSourceFromPage({ mdx: hydrotrailPageMdx, manifest: hydrotrailManifestRow });
    const { request } = seedRequestFor(source);
    const message = await client.messages.create(buildMessageParams(request));
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const seed = specsWithSchema.find((spec) => spec.id === "crew-idea-seed");
    expect(seed?.outputSchema.safeParse(JSON.parse(text)).success).toBe(true);
  });
});
