import type { ReactNode } from "react";

/** Routes already restyled with the research-desk tokens. */
const RESTYLED = new Set(["/dashboard", "/dashboard/explore", "/dashboard/saved"]);

/**
 * Transitional. The shell is light (WP44-S2), and so are Home (S4), Ideas
 * and Saved (S5). Billing, projects and intake still use dark styles until
 * WP44-S7 restyles them. This keeps their text readable in the
 * meantime. Delete it once S7 lands and every dashboard route uses the
 * research-desk tokens.
 */
export function WorkspaceSurface({ pathname, children }: { pathname: string; children: ReactNode }) {
  if (RESTYLED.has(pathname)) {
    // Room for the phone tab bar, as the dark surface leaves.
    return <div className="pb-24 lg:pb-0">{children}</div>;
  }
  return <LegacyDarkSurface>{children}</LegacyDarkSurface>;
}

export function LegacyDarkSurface({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#050505] pb-24 text-zinc-100 lg:pb-0">
      {children}
    </div>
  );
}
