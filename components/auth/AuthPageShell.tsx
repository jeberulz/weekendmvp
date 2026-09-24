import type { ReactNode } from "react";
import { MegaNav } from "@/components/layout/MegaNav";

/**
 * IB-style auth chrome: site MegaNav (Login outline + Sign up filled) above a
 * centered auth column. Keeps Weekend MVP dark tokens — not IB’s white theme.
 */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      <MegaNav variant="dark" />
      <main className="flex min-h-screen items-center justify-center px-6 pt-28 pb-16">
        {children}
      </main>
    </div>
  );
}
