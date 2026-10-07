import { MarketingNav } from "@/components/layout/MarketingNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Cream MegaNav on every marketing page (WP56). */}
      <MarketingNav />
      {children}
      <SiteFooter />
    </>
  );
}
