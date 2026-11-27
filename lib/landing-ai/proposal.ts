import { z } from "zod";
import { beforeCopy, generateInput, landingBlocks, proposalSchema, type Copy, type LandingPageId } from "./blocks";
import { assertEditorialInstruction, validateProposal } from "./guard";
import { landingVoice } from "./voice";

export class ProposalRejected extends Error {}

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
  try {
    assertEditorialInstruction(input.instruction);
  } catch {
    throw new ProposalRejected("Enhance requires source evidence for claims, testimonials and receipts.");
  }
  const block = landingBlocks(input.page, await dependencies.read(input.page)).find(({ id }) => id === input.blockId);
  if (!block || (input.action === "add") !== (block.kind === "add")) throw new ProposalRejected("Select a valid section for this action.");
  const before = beforeCopy(block);
  const { output, usage } = await dependencies.model({
    system: landingVoice,
    action: input.action,
    instruction: input.instruction ?? "",
    before,
    fields: block.kind === "edit" ? block.fields.map(({ id, label }) => ({ id, label })) : [],
    outputSchema: z.toJSONSchema(proposalSchema(block), { target: "draft-7" }),
  });
  try {
    return { before, after: validateProposal(block, output), costEstimate: usage };
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    throw new ProposalRejected("The proposal changed protected wording or introduced an unsupported claim.");
  }
}
