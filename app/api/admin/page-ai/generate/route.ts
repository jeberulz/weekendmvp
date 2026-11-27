import { configuredEditorMode, editorAccessAllowed } from "@/lib/landing/editor-server";
import { readLandingSnapshot } from "@/lib/landing-ai/catalog-server";
import { handleGenerate } from "@/lib/landing-ai/generate";
import { configuredLandingModel } from "@/lib/landing-ai/provider";
import { limitPreview } from "@/lib/landing-ai/rate-limit";

export function POST(request: Request) {
  return handleGenerate(request, {
    authorised: async () => Boolean(configuredEditorMode()) && await editorAccessAllowed(),
    limit: limitPreview,
    model: configuredLandingModel,
    read: readLandingSnapshot,
  });
}
