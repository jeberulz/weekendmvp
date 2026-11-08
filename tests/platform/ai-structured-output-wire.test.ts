/**
 * Every prompt's reply schema, as it goes over the wire to Anthropic's
 * structured outputs (`output_config.format`), uses only the JSON Schema the
 * API accepts. The first live batch on production (2026-11-08) failed every
 * request with `invalid_request_error`: zod's schema carried `minLength`,
 * `maxLength`, `maxItems` and `minItems` above 1, which structured outputs
 * reject. The limits still hold: the gateway parses every reply with the
 * spec's zod schema.
 */
import { describe, expect, test } from "vitest";

import { inputTokenUpperBound, outputJsonSchema, systemBlocksFor } from "@/convex/ai/gateway";
import { PROMPT_ENTRIES } from "@/convex/ai/prompts";
import { buildMessageParams } from "@/convex/ai/providers/anthropic";
import { createFixtureAnthropicClient } from "@/convex/ai/providers/fixtures";
import type { TextRequest } from "@/convex/ai/providers/types";
import { routeSpec } from "@/convex/ai/router";
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
    timeoutMs: 60_000,
  };
}

describe("structured output schemas on the wire", () => {
  test("every registered prompt has a reply schema to check", () => {
    expect(specsWithSchema.length).toBeGreaterThanOrEqual(5);
  });

  for (const spec of specsWithSchema) {
    test(`${spec.id}: only keywords structured outputs accepts`, () => {
      const params = buildMessageParams(requestFor(spec));
      const format = params.output_config?.format;
      expect(format?.type).toBe("json_schema");
      expect(problems(format && "schema" in format ? format.schema : null)).toEqual([]);
    });

    test(`${spec.id}: the input bound covers the schema that is sent`, () => {
      const request = requestFor(spec);
      const params = buildMessageParams(request);
      const format = params.output_config?.format;
      const sentBytes = Buffer.byteLength(JSON.stringify(format && "schema" in format ? format.schema : null));
      const withoutSchema = inputTokenUpperBound({ ...request, outputSchema: undefined });
      expect(inputTokenUpperBound(request) - withoutSchema).toBeGreaterThanOrEqual(sentBytes);
    });
  }

  test("the limits move into the field's description, where the model can read them", () => {
    const seed = specsWithSchema.find((spec) => spec.id === "crew-idea-seed");
    if (seed === undefined) throw new Error("expected the seed spec");
    const params = buildMessageParams(requestFor(seed));
    const format = params.output_config?.format;
    expect(JSON.stringify(format && "schema" in format ? format.schema : null)).toMatch(/maxLength: \d+/u);
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
