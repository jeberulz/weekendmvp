import type { ReactNode } from "react";

import { MegaNav } from "@/components/layout/MegaNav";
import { newsreaderEditorial } from "@/lib/fonts";
import { cn } from "@/lib/utils";

/**
 * Research-desk auth chrome: the cream site MegaNav (Login outline + Sign up
 * filled) above a centred auth column on the paper ground with the dotted
 * texture. Sets the editorial serif variable and the light shadcn tokens
 * (`.theme-desk`) for the card inside.
 */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
      )}
    >
      <div aria-hidden className="home-dots absolute inset-0 opacity-60" />
      <MegaNav variant="cream" />
      <main className="relative flex min-h-screen items-center justify-center px-5 pb-16 pt-28">
        {children}
      </main>
    </div>
  );
}
