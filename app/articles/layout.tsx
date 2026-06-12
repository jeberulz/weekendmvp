import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

import "./articles.css";

/**
 * /articles + /articles/[slug] shell. Both legacy pages (articles.html and
 * articles/*.html) used the dark mega nav, the fixed grid-lines background
 * and the standard site footer, so the whole subtree shares them here.
 */
export default function ArticlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="articles-accent">
      {/* Background Grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0 grid-lines"
        aria-hidden="true"
      />
      <MegaNav variant="dark" />
      {children}
      <SiteFooter />
    </div>
  );
}
