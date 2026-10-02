"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { EDITORIAL_NAV, isNavItemActive, type NavCounts } from "./nav-items";

/**
 * Primary editorial navigation. The current page is marked with
 * `aria-current` and a visible bar plus weight, never colour alone.
 */
export function NavList({ counts, onNavigate }: { counts: NavCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {EDITORIAL_NAV.map((item) => {
        const active = isNavItemActive(item.href, pathname);
        const count = item.countKey && counts ? counts[item.countKey] : null;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "relative flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm text-(--ed-text-2) outline-hidden",
                "hover:bg-(--ed-sunk) hover:text-(--ed-text)",
                "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)",
                active &&
                  "bg-(--ed-surface) font-semibold text-(--ed-text) shadow-[inset_3px_0_0_var(--ed-text)] hover:bg-(--ed-surface)",
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {count !== null && count > 0 ? (
                <span className="font-mono text-xs tabular-nums text-(--ed-text-2)">
                  {count}
                  <span className="sr-only">
                    {item.countKey === "queue" ? " need review" : " need attention"}
                  </span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
