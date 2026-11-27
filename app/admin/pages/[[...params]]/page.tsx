import Link from "next/link";
import { requireLandingEditor } from "@/lib/landing/editor-server";
import { LandingEditor } from "../keystatic";

export const instant = false;

export default async function Page() {
  const mode = await requireLandingEditor();
  return (
    <>
      <nav aria-label="Page tools" className="flex justify-end border-b border-neutral-200 bg-white px-4 py-2">
        <Link className="rounded px-2 py-1 text-sm font-medium text-neutral-900 underline" href="/admin/pages/enhance">
          Enhance with AI
        </Link>
      </nav>
      <LandingEditor mode={mode} />
    </>
  );
}
