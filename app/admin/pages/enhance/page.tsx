import Link from "next/link";
import { requireLandingEditor } from "@/lib/landing/editor-server";
import { readPanelCatalog } from "@/lib/landing-ai/catalog-server";
import { generationConfigured } from "@/lib/landing-ai/provider";
import { EnhancePanel } from "./panel";

export const instant = false;

export default async function EnhancePage() {
  await requireLandingEditor();
  const pages = await readPanelCatalog();
  return (
    <main className="min-h-screen bg-[#faf9f5] px-5 py-10 text-neutral-950 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link className="text-sm font-medium underline" href="/admin/pages">Back to the page editor</Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Enhance with AI</h1>
        <EnhancePanel pages={pages} generationAvailable={generationConfigured()} />
      </div>
    </main>
  );
}
