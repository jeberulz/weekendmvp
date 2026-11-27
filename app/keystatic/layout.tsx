import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { requireLandingEditor } from "@/lib/landing/editor-server";
import { LandingEditor } from "./keystatic";

export const metadata: Metadata = {
  title: { absolute: "Page editor — Weekend MVP" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function AuthorizedEditor() {
  return <LandingEditor mode={await requireLandingEditor()} />;
}

export default function EditorLayout({ children }: { children: ReactNode }) {
  return <><Suspense fallback={null}><AuthorizedEditor /></Suspense>{children}</>;
}
