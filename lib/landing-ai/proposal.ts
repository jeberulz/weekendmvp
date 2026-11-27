import { z } from "zod";
import { beforeCopy, generateInput, landingBlocks, proposalSchema, type Copy, type LandingPageId } from "./blocks";
import { assertEditorialInstruction, validateProposal } from "./guard";
import { landingVoice } from "./voice";

export type Usage = { inputTokens: number; outputTokens: number; estimated?: boolean };
export type ModelRequest = {
  system: string;
  action: string;
  instruction: string;
  before: Copy;
  fields: { id: string; label: string }[];
  outputSchema: Record<string, unknown>;
};
export type Model = (request: ModelRequest) => Promise<{ output: unknown; usage: Usage }>;

export async function generateProposal(
  raw: unknown,
  dependencies: { read(page: LandingPageId): Promise<unknown>; model: Model },
) {
  const input = generateInput.parse(raw);
  assertEditorialInstruction(input.instruction);
  const block = landingBlocks(input.page, await dependencies.read(input.page)).find(({ id }) => id === input.blockId);
  if (!block || (input.action === "add") !== (block.kind === "add")) throw new Error("Select a valid section for this action.");
  const before = beforeCopy(block);
  const { output, usage } = await dependencies.model({
    system: landingVoice,
    action: input.action,
    instruction: input.instruction ?? "",
    before,
    fields: block.kind === "edit" ? block.fields.map(({ id, label }) => ({ id, label })) : [],
    outputSchema: z.toJSONSchema(proposalSchema(block), { target: "draft-7" }),
  });
  return { before, after: validateProposal(block, output), costEstimate: usage };
}
