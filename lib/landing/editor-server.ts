import "server-only";

import { notFound } from "next/navigation";
import { connection } from "next/server";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { resolveLiveWorkspace } from "@/lib/editorial/runtime/workspace";
import { editorMode } from "./editor-policy";

export function configuredEditorMode() {
  return editorMode(process.env.NODE_ENV === "production", [
    process.env.KEYSTATIC_GITHUB_CLIENT_ID,
    process.env.KEYSTATIC_GITHUB_CLIENT_SECRET,
    process.env.KEYSTATIC_SECRET,
    process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG,
  ]);
}

export async function editorAccessAllowed() {
  return (await resolveLiveWorkspace()).status === "live";
}

export async function requireLandingEditor() {
  assertEditorialRoutesEnabled();
  await connection();
  const mode = configuredEditorMode();
  if (!mode || !(await editorAccessAllowed())) notFound();
  return mode;
}
