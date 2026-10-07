import * as React from "react";

import { Breadcrumbs, type Crumb } from "@/components/public/PageHeader";
import { PublicShell } from "@/components/public/PublicShell";
import { cn } from "@/lib/utils";

/**
 * Page chrome for the hub routes (/ideas-for/*, /build-with/*, /solve/* and
 * the /ideas/{collection} hubs). Since WP56 this is the research-desk shell;
 * the dark #050505 chrome is retired.
 *
 * The /ideas/{collection} hubs share the /ideas/[slug] route with the cream
 * idea-detail pages; that layout renders collection slugs bare so this
 * chrome isn't wrapped in the idea page's IdeaNav/footer.
 */
export function HubShell({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-16 pt-28 md:px-10 md:pt-36 xl:px-0">{children}</div>
    </PublicShell>
  );
}

export type HubCrumb = Crumb;

/** Mono breadcrumb strip (Home / Section / Page). */
export function HubBreadcrumb({ items }: { items: HubCrumb[] }) {
  return <Breadcrumbs items={items} className="mb-6" />;
}

/**
 * Legacy hub header kept for pages not yet on `PageHeader`. Light editorial
 * type; the icon box is retired, so `icon` and `iconBoxClassName` are ignored.
 */
export function HubHero({
  title,
  description,
  chips,
}: {
  variant?: "default" | "tool";
  icon?: React.ReactNode;
  iconBoxClassName?: string;
  title: string;
  description: string;
  chips?: React.ReactNode;
}) {
  return (
    <header className="mb-14 flex flex-col gap-5">
      <h1 className="font-editorial text-[42px] font-normal leading-[1.02] tracking-[-0.03em] text-balance text-home-ink md:text-[60px]">
        {title}
      </h1>
      <p className="max-w-[660px] text-base leading-[1.55] text-home-ink-2 md:text-xl">{description}</p>
      {chips ? <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">{chips}</div> : null}
    </header>
  );
}

/** Mono metadata item (idea counts, skill level, build time). */
export function HubChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3 md:text-xs [&_svg]:hidden",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Count item: `{n} ideas` with the sr-only "Total:" prefix. */
export function HubCountChip({ children }: { children: React.ReactNode }) {
  return (
    <HubChip>
      <span className="sr-only">Total:</span>
      {children}
    </HubChip>
  );
}
