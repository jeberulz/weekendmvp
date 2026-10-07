import { PublicShell } from "@/components/public/PublicShell";

/**
 * /startup-ideas shell on the research-desk kit (WP56): cream MegaNav, paper
 * ground, warm-ink footer. PublicShell owns the single `<main>`; the page
 * ends on its own "Want me to build one…" call, so the shared closing band
 * is off.
 */
export default function StartupIdeasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicShell footerCta={false}>{children}</PublicShell>;
}
