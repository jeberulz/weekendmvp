"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import {
  PRIMARY_NAV,
  isWorkspaceNavCurrent,
} from "@/components/platform/shell/workspace-current";
import { cn } from "@/lib/utils";
import { IdeaAccountMenu } from "./IdeaAccountMenu";

/**
 * Signed-in chrome for individual `/ideas/{slug}` pages. Mirrors PRIMARY_NAV
 * from the dashboard shell without wrapping the MDX reader in WorkspaceShell.
 */
export function IdeaMemberNav() {
  const pathname = usePathname();
  const onIdeaReader = pathname.startsWith("/ideas/");

  return (
    <header
      id="idea-site-header"
      className="fixed top-0 left-0 right-0 z-40 border-b border-neutral-200 bg-[#fcfaf7]/80 backdrop-blur-md"
    >
      <div className="flex items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link
          href="/dashboard"
          aria-label="Weekend MVP home"
          className="shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-black/30"
        >
          <Logo className="h-4 w-24 text-black sm:w-32" />
        </Link>

        {/* No justify-end on the scroller: it pushes the first links out of
            scroll reach when the row overflows on phones. `ml-auto` on the
            first link right-aligns it and collapses to 0 on overflow. */}
        <nav
          aria-label="Workspace"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:gap-2"
        >
          {PRIMARY_NAV.map((item, index) => {
            const current =
              (item.id === "ideas" && onIdeaReader) ||
              isWorkspaceNavCurrent(item.id, pathname, null);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-1.5 text-[13px] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black/30 sm:px-3 sm:text-sm",
                  index === 0 && "ml-auto",
                  current
                    ? "bg-neutral-900 font-medium text-white"
                    : "text-neutral-500 hover:text-black",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0">
          <IdeaAccountMenu />
        </div>
      </div>
    </header>
  );
}
