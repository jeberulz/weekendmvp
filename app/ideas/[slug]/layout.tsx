import { IdeaNav } from "@/components/layout/IdeaNav";
import { IdeaFooter } from "@/components/ideas/IdeaFooter";
import { COLLECTION_SLUGS } from "./collection";

/**
 * Shell for the /ideas/[slug] route, which serves two different page kinds:
 *
 *  - Individual idea pages — cream theme + sticky light IdeaNav + light
 *    footer, mirroring the legacy ideas/_template.html body chrome.
 *  - Collection hubs (/ideas/saas, /ideas/education, …) — dark-themed. They
 *    render their own dark MegaNav + SiteFooter via <HubShell>, so the layout
 *    renders them bare; wrapping them in the cream chrome is what produced the
 *    mismatched light nav over a dark page.
 */
export default async function IdeaSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (COLLECTION_SLUGS.includes(slug)) {
    return <>{children}</>;
  }

  return (
    <div className="theme-cream min-h-screen bg-[#fcfaf7] text-[#1a1a1a] selection:bg-black/10 selection:text-black">
      <IdeaNav withSidebar />
      {children}
      <IdeaFooter />
    </div>
  );
}
