import Link from "next/link";

import { Container } from "@/components/home/ui";
import { cn } from "@/lib/utils";

export type TabLink = { href: string; label: string; count?: number; current?: boolean };
export type TabGroup = { label?: string; ariaLabel: string; links: TabLink[] };

const TAB =
  "whitespace-nowrap border-b-[1.5px] pb-[3px] font-mono text-[11px] uppercase tracking-[0.08em] transition-colors md:text-xs " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/**
 * Mono underline tabs between two hairlines — the homepage index's category
 * strip on paper. Each group is its own `<nav>`; on phones a group scrolls
 * sideways instead of wrapping.
 */
export function LinkTabs({ groups, className }: { groups: TabGroup[]; className?: string }) {
  return (
    <Container className={className}>
      <div className="flex flex-col gap-3.5 border-y border-home-rule py-4 md:py-5">
        {groups.map((group) => (
          <nav
            key={group.ariaLabel}
            aria-label={group.ariaLabel}
            className="flex items-baseline gap-x-6 gap-y-2.5 max-md:-mx-5 max-md:overflow-x-auto max-md:px-5 max-md:no-scrollbar"
          >
            {group.label && (
              <span className="w-[112px] shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
                {group.label}
              </span>
            )}
            <ul className="flex items-baseline gap-x-6 gap-y-2.5 md:flex-wrap">
              {group.links.map((link) => (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    aria-current={link.current ? "page" : undefined}
                    className={cn(
                      TAB,
                      link.current
                        ? "border-home-orange-ink text-home-orange-ink"
                        : "border-transparent text-home-ink-2 hover:text-home-ink",
                    )}
                  >
                    {link.label}
                    {link.count !== undefined && (
                      <span className={cn("ml-1.5", !link.current && "text-home-ink-3")}>{link.count}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </Container>
  );
}
