import type { Metadata } from "next";
import type { ReactNode } from "react";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

export const metadata: Metadata = {
  title: { absolute: "Page editor — Weekend MVP" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function EditorLayout({ children }: { children: ReactNode }) {
  assertEditorialRoutesEnabled();
  return children;
}
