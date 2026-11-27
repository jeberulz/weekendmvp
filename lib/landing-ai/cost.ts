export const LANDING_MODEL = "claude-haiku-5-5";
export const MAX_OUTPUT_TOKENS = 4096;

// Standard Claude API rates for Haiku 5.5. See the model card linked in the runbook.
export function estimatedUsd(inputTokens: number, outputTokens: number) {
  const longContext = inputTokens > 100_000;
  const inputRate = longContext ? 0.50 : 0.10;
  const outputRate = longContext ? 2.50 : 0.50;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

export function estimateInputTokens(characters: number, fields: number, instructionLength: number) {
  return Math.ceil((characters + fields * 45 + instructionLength + 1000) / 4);
}
