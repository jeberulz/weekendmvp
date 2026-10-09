import { IdeaPageNav } from "@/components/ideas/IdeaPageNav";
import { IdeaFooter } from "@/components/ideas/IdeaFooter";
import { COLLECTION_SLUGS } from "./collection";

/**
 * Shell for the /ideas/[slug] route, which serves two different page kinds:
 *
 *  - Individual idea pages — cream theme + shared floating MegaNav + light
 *    reader footer.
 *    Signed-in members (session hint) swap to PRIMARY_NAV member chrome
 *    via IdeaPageNav; collection hubs are unchanged.
 *  - Collection hubs (/ideas/saas, /ideas/education, …) render their own
 *    shared menu and SiteFooter via PublicShell, so the layout renders them
 *    bare to avoid duplicate navigation and footers.
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
      <IdeaPageNav />
      {children}
      <IdeaFooter />
    </div>
  );
}
