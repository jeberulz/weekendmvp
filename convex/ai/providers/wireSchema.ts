/**
 * The reply schema as Anthropic's structured outputs (`output_config.format`)
 * accepts it.
 *
 * Structured outputs rejects string lengths, number bounds, `maxItems`,
 * `minItems` above 1 and other constraints with `invalid_request_error`. The
 * SDK's own `transformJSONSchema` (what `messages.parse()` applies) drops
 * them from the schema and appends them to each field's `description`, so the
 * model still reads the limits. The gateway then enforces every limit: it
 * parses each reply with the spec's zod schema.
 *
 * Every place that sends or sizes a request uses this one function: the
 * request body, the input-token bound, and the fixture client's schema keys.
 *
 * Prompted mode (`outputMode: "prompted"`): some schemas are accepted keyword
 * by keyword but still rejected as a whole with "The compiled grammar is too
 * large" (live probe 2026-11-08: `crew-idea-seed` and `crew-social-pack`;
 * removing descriptions, requiring every field or dropping `minItems` did not
 * bring either under the limit). Those requests send the same wire schema as
 * a system block (`promptedSchemaBlock`) instead of `output_config.format`.
 * The block starts with `PROMPTED_SCHEMA_HEADER`, so the fixture client can
 * read the schema back (`promptedSchemaFrom`) and answer it like a grammar
 * request.
 */
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";

export function wireOutputSchema(schema: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const wire: Record<string, unknown> = transformJSONSchema({ ...schema });
  return wire;
}

/** The first line of a prompted schema block. Changing it changes every prompted request. */
export const PROMPTED_SCHEMA_HEADER =
  "Reply format: reply with exactly one JSON object that validates against the JSON Schema below. " +
  "Every limit in a field's description is a hard limit. Write only the JSON: no code fence, no text before or after it.";

/** The system block a prompted request carries in place of `output_config.format`. */
export function promptedSchemaBlock(schema: Readonly<Record<string, unknown>>): string {
  return `${PROMPTED_SCHEMA_HEADER}\n\n${JSON.stringify(wireOutputSchema(schema))}`;
}

/** The schema a prompted system block carries, or undefined when the text is not one. */
export function promptedSchemaFrom(text: string): Record<string, unknown> | undefined {
  const prefix = `${PROMPTED_SCHEMA_HEADER}\n\n`;
  if (!text.startsWith(prefix)) return undefined;
  try {
    const parsed: unknown = JSON.parse(text.slice(prefix.length));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The JSON text of a prompted reply. Without a grammar the model may still
 * wrap the object in one Markdown code fence despite the instruction; that
 * one fence is removed. Anything else is returned unchanged for `JSON.parse`
 * to judge.
 */
export function unfencedJson(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/u.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}
