"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/primitives/Logo";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./AccountMenu";
import { CurrentObjectLabel } from "./CurrentObjectLabel";
import {
  COLD_OBJECT_LABEL,
  SIGNED_IN_HREF,
  chromeHere,
} from "@/lib/signed-in-chrome";

function ChromeLink({
  href,
  here,
  children,
  className,
}: {
  href: string;
  here: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={here ? "page" : undefined}
      className={cn(
        "rounded-2xl px-3 py-2 text-sm font-medium text-stone-700 underline-offset-4 hover:text-stone-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800",
        here && "text-stone-950 underline",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SignedInShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const here = chromeHere(pathname);

  return (
    <div className="theme-cream min-h-dvh bg-[#f3f1eb] text-[#1c1917]">
      <a
        href="#signed-in-main"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-2xl bg-stone-900 px-4 py-2 text-sm font-semibold text-[#f3f1eb] transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-stone-900 motion-reduce:transition-none"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-stone-900/10 bg-[#f3f1eb]">
        <nav
          aria-label="Product"
          className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4 sm:px-6"
        >
          <Link
            href={SIGNED_IN_HREF.home}
            className="flex shrink-0 items-center gap-2 rounded-2xl text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          >
            <Logo className="h-6 w-8" aria-label="Weekend MVP" />
            <span className="hidden text-sm font-semibold sm:inline">
              Weekend MVP
            </span>
          </Link>

          <Suspense
            fallback={
              <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-stone-500">
                {COLD_OBJECT_LABEL}
              </p>
            }
          >
            <CurrentObjectLabel />
          </Suspense>

          <div className="hidden items-center gap-1 md:flex">
            <ChromeLink href={SIGNED_IN_HREF.library} here={here === "library"}>
              Library
            </ChromeLink>
            <Suspense fallback={null}>
              <AccountMenu variant="desktop" />
            </Suspense>
          </div>
        </nav>
      </header>

      <nav
        aria-label="Product"
        className="fixed inset-x-0 bottom-0 z-40 flex min-h-[4.5rem] items-center justify-around border-t border-stone-900/10 bg-[#f3f1eb] px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ChromeLink
          href={SIGNED_IN_HREF.home}
          here={here === "home"}
          className="flex min-h-12 min-w-12 flex-col items-center justify-center text-[11px] no-underline"
        >
          Home
        </ChromeLink>
        <ChromeLink
          href={SIGNED_IN_HREF.library}
          here={here === "library"}
          className="flex min-h-12 min-w-12 flex-col items-center justify-center text-[11px] no-underline"
        >
          Library
        </ChromeLink>
        <Suspense fallback={null}>
          <AccountMenu variant="tab" />
        </Suspense>
      </nav>

      <main
        id="signed-in-main"
        tabIndex={-1}
        className="pb-24 outline-none md:pb-0"
      >
        {children}
      </main>
    </div>
  );
}
