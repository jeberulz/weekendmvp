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
 */
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";

export function wireOutputSchema(schema: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const wire: Record<string, unknown> = transformJSONSchema({ ...schema });
  return wire;
}
