import { MarketingNav } from "@/components/layout/MarketingNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Dark MegaNav by default; cream on light workshop pages (/shipable, /dare). */}
      <MarketingNav />
      {children}
      <SiteFooter />
    </>
  );
}
