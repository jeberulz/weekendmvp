import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { LANDING_MODEL, MAX_OUTPUT_TOKENS } from "./cost";
import type { Model } from "./proposal";

const outputTool = "return_editorial_proposal";

export function generationConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function configuredLandingModel(): Model | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 25_000 });
  return async ({ system, action, instruction, before, fields, outputSchema }) => {
    const response = await client.messages.create({
      model: LANDING_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      output_config: { effort: "low" },
      system,
      messages: [
        { role: "user", content: JSON.stringify({ action, instruction, before, fields }) },
      ],
      tools: [{
        name: outputTool,
        description: "Return the proposed copy for the selected editorial block in the supplied shape.",
        input_schema: { ...outputSchema, type: "object" },
      }],
      tool_choice: { type: "tool", name: outputTool },
    });
    const tools = response.content.filter((part) => part.type === "tool_use");
    if (response.stop_reason !== "tool_use" || tools.length !== 1 || tools[0].name !== outputTool) {
      throw new Error("The provider did not return a complete proposal.");
    }
    return { output: tools[0].input, usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    } };
  };
}
