import { configuredEditorMode, editorAccessAllowed } from "@/lib/landing/editor-server";
import { handleApprove } from "@/lib/landing-ai/approve";
import { editorStore } from "@/lib/landing-ai/editor-store";

export function POST(request: Request) {
  const mode = configuredEditorMode();
  return handleApprove(request, {
    authorised: editorAccessAllowed,
    destination: mode ? { mode, open: (branch) => editorStore(mode, branch) } : null,
  });
}
