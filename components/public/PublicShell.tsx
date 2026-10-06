import type { ReactNode } from "react";

import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { newsreaderEditorial } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { FooterCta } from "./FooterCta";

/**
 * Research-desk page chrome for the public pages (WP56): cream MegaNav,
 * paper ground, the editorial serif variable, light shadcn tokens
 * (`.theme-desk`), the closing call and the warm-ink footer. Pages render
 * their own `<main>` content inside.
 */
export function PublicShell({
  children,
  footerCta = true,
  className,
}: {
  children: ReactNode;
  /** The "Pick an idea…" band above the footer; off where a page ends on its own call. */
  footerCta?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
        className,
      )}
    >
      <MegaNav variant="cream" />
      <main id="main">{children}</main>
      {footerCta && <FooterCta />}
      <SiteFooter />
    </div>
  );
}
