import { PublicShell } from "@/components/public/PublicShell";

/**
 * /newsletter subtree shell: the research-desk public chrome (cream nav,
 * paper ground, warm-ink footer) for both the archive and the issue pages.
 * Both end on their own call, so the shared closing band is off.
 * `PublicShell` renders the page's `<main>`.
 */
export default function NewsletterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicShell footerCta={false}>{children}</PublicShell>;
}
