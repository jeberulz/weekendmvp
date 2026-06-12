import "./newsletter.css";

/**
 * /newsletter subtree shell. The two legacy page types use different chrome:
 *
 *   newsletter.html (archive)        → dark mega nav + full site footer
 *                                      (rendered by app/newsletter/page.tsx)
 *   newsletter/{slug}.html (issues)  → minimal reading nav + compact footer
 *                                      (rendered by app/newsletter/[slug]/layout.tsx)
 *
 * so this layout only carries what both share: the accent scope and the
 * fixed grid-lines background.
 */
export default function NewsletterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="newsletter-accent">
      {/* Background Grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0 grid-lines"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
