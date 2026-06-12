import Link from "next/link";
import { cacheLife } from "next/cache";

import { ReadingNav } from "@/components/layout/ReadingNav";

// Strict prerender forbids new Date() in uncached server components; a daily
// cache window keeps the copyright year correct without going dynamic.
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

const FOOTER_LINKS = [
  { label: "Newsletter", href: "/newsletter" },
  { label: "Articles", href: "/articles" },
  { label: "Starter Kit", href: "/starter-kit" },
  { label: "Privacy", href: "/privacy-policy" },
];

/** Compact one-row footer ported from the legacy newsletter/{slug}.html. */
function IssueFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#050505] mt-16">
      <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-neutral-600 text-xs">
          © <CopyrightYear /> Weekend MVP. Built to ship.
        </p>
        <div className="flex items-center gap-6 text-xs text-neutral-500">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

/**
 * Issue pages use the minimal reading nav + compact footer of the legacy
 * newsletter/{slug}.html pages (the archive keeps the mega nav).
 */
export default function NewsletterIssueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ReadingNav />
      {children}
      <IssueFooter />
    </>
  );
}
