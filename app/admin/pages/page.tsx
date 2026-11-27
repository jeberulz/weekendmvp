import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireLandingEditor } from "@/lib/landing/editor-server";

async function OpenEditor() {
  await requireLandingEditor();
  return redirect("/keystatic");
}

export default function Page() {
  return <Suspense fallback={null}><OpenEditor /></Suspense>;
}
