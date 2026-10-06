import { PublicShell } from "@/components/public/PublicShell";

/**
 * /articles + /articles/[slug] shell: the research-desk public chrome (cream
 * nav, paper ground, warm-ink footer). The index ends on its own call and the
 * detail page renders `FooterCta` itself, so the shared band is off here.
 * `PublicShell` renders the page's `<main>`.
 */
export default function ArticlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicShell footerCta={false}>{children}</PublicShell>;
}
