import { IdeaNav } from "@/components/layout/IdeaNav";
import { IdeaFooter } from "@/components/ideas/IdeaFooter";

/**
 * Shell for idea-detail pages (and the future U11 collection hubs):
 * cream theme + sticky idea nav + light footer, mirroring the legacy
 * ideas/_template.html body chrome.
 */
export default function IdeaSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-cream min-h-screen bg-[#fcfaf7] text-[#1a1a1a] selection:bg-black/10 selection:text-black">
      <IdeaNav withSidebar />
      {children}
      <IdeaFooter />
    </div>
  );
}
