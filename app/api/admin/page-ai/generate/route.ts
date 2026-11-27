import { configuredEditorMode, editorAccessAllowed } from "@/lib/landing/editor-server";
import { readLandingSnapshot } from "@/lib/landing-ai/catalog-server";
import { sealProposal } from "@/lib/landing-ai/draft";
import { editorStore } from "@/lib/landing-ai/editor-store";
import { generateProposal } from "@/lib/landing-ai/proposal";
import { handleGenerate } from "@/lib/landing-ai/generate";
import { configuredLandingModel } from "@/lib/landing-ai/provider";
import { limitPreview } from "@/lib/landing-ai/rate-limit";

export function POST(request: Request) {
  const mode = configuredEditorMode();
  return handleGenerate(request, {
    authorised: async () => Boolean(mode) && await editorAccessAllowed(),
    limit: limitPreview,
    model: configuredLandingModel,
    read: readLandingSnapshot,
    preview: mode ? async (input, model) => {
      const snapshot = await (await editorStore(mode, input.branch)).read(input.page);
      const proposal = await generateProposal(input, { model, read: async () => snapshot.document });
      return { ...proposal, approval: sealProposal(mode, input, snapshot.revision, proposal.before, proposal.after) };
    } : undefined,
  });
}
