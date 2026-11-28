import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNavigation } from "./navigation";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  assertEditorialRoutesEnabled();
  return <><AdminNavigation />{children}</>;
}
