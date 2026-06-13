import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

/**
 * /startup-ideas shell. The legacy startup-ideas.html used the dark mega
 * nav, the fixed grid-lines background, a fixed top glow and the standard
 * site footer — same composition as app/articles/layout.tsx.
 */
export default function StartupIdeasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Background Grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0 grid-lines"
        aria-hidden="true"
      />
      {/* Top Glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen"
        aria-hidden="true"
      />
      <MegaNav variant="dark" />
      {children}
      <SiteFooter />
    </>
  );
}
