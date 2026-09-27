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
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/dashboard"
          aria-label="Weekend MVP home"
          className="shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-black/30"
        >
          <Logo className="h-4 w-32 text-black" />
        </Link>

        <nav
          aria-label="Workspace"
          className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto sm:gap-2"
        >
          {PRIMARY_NAV.map((item) => {
            const current =
              (item.id === "ideas" && onIdeaReader) ||
              isWorkspaceNavCurrent(item.id, pathname, null);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-black/30 sm:px-3",
                  current
                    ? "bg-neutral-900 font-medium text-white"
                    : "text-neutral-500 hover:text-black",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="ml-1 shrink-0 sm:ml-2">
            <IdeaAccountMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
