import * as React from "react";
import Link from "next/link";

import { MegaNav } from "@/components/layout/MegaNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { cn } from "@/lib/utils";

/**
 * Dark page chrome for the dark hub routes: the standalone hubs
 * (/ideas-for/*, /build-with/*, /solve/*) and the /ideas/{collection}
 * hubs. Legacy body classes + dark MegaNav + dark footer, with the legacy
 * <main> container.
 *
 * The /ideas/{collection} hubs share the /ideas/[slug] route with the
 * cream idea-detail pages; that layout renders collection slugs bare so
 * this dark chrome isn't wrapped in the cream IdeaNav/footer.
 */
export function HubShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white selection:bg-white/20 selection:text-white">
      <MegaNav variant="dark" />
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-16">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export type HubCrumb = { label: string; href?: string };

/** Legacy breadcrumb strip (Home / Section / Page). */
export function HubBreadcrumb({ items }: { items: HubCrumb[] }) {
  return (
    <nav className="mb-8" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <li>
                <span className="text-neutral-600">/</span>
              </li>
            ) : null}
            <li>
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-white">{item.label}</span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Hub page header. `variant="default"` is the square icon next to the H1
 * (audience / solve / collection pages); `variant="tool"` is the large
 * gradient logo box beside title+description (build-with pages).
 */
export function HubHero({
  variant = "default",
  icon,
  iconBoxClassName,
  title,
  description,
  chips,
}: {
  variant?: "default" | "tool";
  icon: React.ReactNode;
  iconBoxClassName?: string;
  title: string;
  description: string;
  chips?: React.ReactNode;
}) {
  if (variant === "tool") {
    return (
      <header className="mb-16">
        <div className="flex flex-col md:flex-row md:items-start gap-8 mb-8">
          <div
            className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10",
              iconBoxClassName,
            )}
          >
            {icon}
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-4">
              {title}
            </h1>
            <p className="text-xl text-neutral-400 font-light max-w-3xl leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        {chips ? (
          <div className="flex flex-wrap items-center gap-3">{chips}</div>
        ) : null}
      </header>
    );
  }

  return (
    <header className="mb-16">
      <div className="flex items-center gap-4 mb-6">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            iconBoxClassName,
          )}
        >
          {icon}
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight">
            {title}
          </h1>
        </div>
      </div>
      <p className="text-xl text-neutral-400 font-light max-w-3xl leading-relaxed">
        {description}
      </p>
      {chips ? (
        <div className="flex flex-wrap items-center gap-3 mt-6">{chips}</div>
      ) : null}
    </header>
  );
}

/** Neutral hero stat chip (idea counts, skill level, build time). */
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
        "inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-neutral-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Green-dot count chip: `● {n} ideas` with the sr-only "Total:" prefix. */
export function HubCountChip({ children }: { children: React.ReactNode }) {
  return (
    <HubChip>
      <span
        className="w-1.5 h-1.5 rounded-full bg-green-500"
        aria-hidden="true"
      />
      <span className="sr-only">Total:</span>
      {children}
    </HubChip>
  );
}
