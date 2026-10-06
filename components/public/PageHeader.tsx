import { Fragment, type ReactNode } from "react";
import Link from "next/link";

import { Container } from "@/components/home/ui";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/** Mono breadcrumb; the last crumb is the current page. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
        {items.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && (
              <li aria-hidden className="select-none">
                /
              </li>
            )}
            <li>
              {item.href ? (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-home-ink">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** The ledger line under a heading: `48 IDEAS · SORTED BY … · UPDATED WEEKLY`. */
export function MetaLine({ items, className }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-[18px] gap-y-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3 md:text-xs",
        className,
      )}
    >
      {shown.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>·</span>}
          <span>{item}</span>
        </Fragment>
      ))}
    </p>
  );
}

/**
 * Page header on paper with the homepage's dotted ground. The H1 is an
 * editorial serif; pass the existing title verbatim and, optionally, an
 * italic `tail` (rendered with `<Em>`) appended after it (WP56 ruling).
 */
export function PageHeader({
  crumbs,
  eyebrow,
  title,
  description,
  meta,
  aside,
  lead,
  children,
  size = "lg",
  align = "start",
  className,
}: {
  crumbs?: Crumb[];
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode[];
  /** Right-hand slot on wide screens (a tool mark, a CTA). */
  aside?: ReactNode;
  /** Left of the title block on wide screens, above it on phones (a tool mark). */
  lead?: ReactNode;
  /** Below the meta line (search, actions). */
  children?: ReactNode;
  size?: "lg" | "md";
  align?: "start" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <header className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="home-dots absolute inset-0 opacity-60 [mask-image:linear-gradient(#000_45%,transparent)]"
      />
      <Container
        className={cn(
          "relative flex flex-col gap-5 pt-28 md:gap-[22px] md:pt-36",
          centered && "items-center text-center",
        )}
      >
        {crumbs && <Breadcrumbs items={crumbs} />}
        <div className={cn("flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between", centered && "items-center")}>
          <div className={cn("flex flex-col gap-6 md:flex-row md:items-start md:gap-8", centered && "items-center")}>
          {lead && <div className="shrink-0">{lead}</div>}
          <div className={cn("flex max-w-[960px] flex-col gap-5 md:gap-[22px]", centered && "items-center")}>
            {eyebrow && (
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink md:text-xs">
                {eyebrow}
              </p>
            )}
            <h1
              className={cn(
                "font-editorial font-normal text-home-ink text-balance",
                size === "lg"
                  ? "text-[42px] leading-[1.02] tracking-[-0.03em] md:text-[60px] lg:text-[72px] lg:leading-none"
                  : "text-[38px] leading-[1.04] tracking-[-0.025em] md:text-[52px]",
              )}
            >
              {title}
            </h1>
            {description && (
              <p className="max-w-[660px] text-pretty text-base leading-[1.55] text-home-ink-2 md:text-xl">
                {description}
              </p>
            )}
            {meta && <MetaLine items={meta} className={cn(centered && "justify-center")} />}
          </div>
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        {children}
      </Container>
    </header>
  );
}
