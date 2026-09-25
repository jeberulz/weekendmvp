import type { ReactNode } from "react";

/**
 * Transitional. The shell is light (WP44-S2), but Home, Explore, billing,
 * projects and intake still use dark styles until WP44-S4, S5 and S7 restyle
 * them. This keeps their text readable in the meantime. Delete it once S7
 * lands and every dashboard route uses the research-desk tokens.
 */
export function LegacyDarkSurface({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#050505] pb-24 text-zinc-100 lg:pb-0">
      {children}
    </div>
  );
}
