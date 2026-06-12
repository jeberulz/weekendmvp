import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MegaNav />
      {children}
      <SiteFooter />
    </>
  );
}
