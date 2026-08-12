import Link from "next/link";

import { Logo } from "@/components/primitives/Logo";
import { newsreader } from "@/lib/fonts";

/**
 * Bare chrome for playbook microsites.
 *
 * Playbooks live outside `app/(marketing)/` on purpose, so they inherit only
 * the root layout — no MegaNav, no SiteFooter. Same move as
 * `app/links/page.tsx`: a playbook is a standalone page you land on from a
 * social post or an AI answer, and the site nav is a distraction from the
 * one thing it's asking for.
 *
 * `newsreader.variable` powers the `accent-italic` numerals; `theme-cream`
 * flips the shadcn tokens to the light palette, matching /shipable and /dare.
 */
export default function PlaybooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${newsreader.variable} theme-cream min-h-svh overflow-x-hidden bg-[#fcfaf7] text-[#1c1917]`}
    >
      <header className="w-full px-5 md:px-8 pt-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917] focus-visible:ring-offset-4 focus-visible:ring-offset-[#fcfaf7]"
          >
            <Logo className="h-4 w-32 text-[#1c1917]" />
            <span className="sr-only">Weekend MVP home</span>
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="w-full px-5 md:px-8 pb-16">
        <div className="max-w-3xl mx-auto border-t border-black/10 pt-8">
          <p className="text-sm text-stone-500">
            A Weekend MVP playbook, by{" "}
            <Link
              href="/john-iseghohi"
              className="underline underline-offset-4 hover:text-[#1c1917] transition-colors"
            >
              John Iseghohi
            </Link>
            .{" "}
            <Link
              href="/startup-ideas"
              className="underline underline-offset-4 hover:text-[#1c1917] transition-colors"
            >
              Browse 160 buildable ideas
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
