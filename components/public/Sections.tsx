import type { ReactNode } from "react";
import Link from "next/link";

import { Icon } from "@/components/home/icons";
import { Container, Eyebrow } from "@/components/home/ui";
import { cn } from "@/lib/utils";
import { FeaturedIdeaCard } from "./IdeaCards";
import type { PublicIdea } from "./types";

/** A paper section with the standard container and vertical rhythm. */
export function Section({
  children,
  labelledBy,
  label,
  className,
  containerClassName,
}: {
  children: ReactNode;
  labelledBy?: string;
  label?: string;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} aria-label={label} className={cn("py-14 lg:py-20", className)}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

/** Section heading pair: an optional orange mono eyebrow over an editorial H2. */
export function SectionHeading({
  id,
  eyebrow,
  children,
  intro,
  dark = false,
  className,
}: {
  id: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  intro?: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {eyebrow && <Eyebrow dark={dark}>{eyebrow}</Eyebrow>}
      <h2
        id={id}
        className={cn(
          "max-w-[820px] font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-balance md:text-[44px]",
          dark ? "text-home-d1" : "text-home-ink",
        )}
      >
        {children}
      </h2>
      {intro && (
        <p className={cn("max-w-[640px] text-pretty text-base leading-[1.55] md:text-[17px]", dark ? "text-home-d2" : "text-home-ink-2")}>
          {intro}
        </p>
      )}
    </div>
  );
}

/**
 * The page's one warm-ink moment (the homepage index band, on a sub-page).
 * `inset` draws it as a rounded panel inside the container instead of full bleed.
 */
export function InkBand({
  children,
  labelledBy,
  inset = false,
  className,
}: {
  children: ReactNode;
  labelledBy?: string;
  inset?: boolean;
  className?: string;
}) {
  if (inset) {
    return (
      <section aria-labelledby={labelledBy} className={cn("py-10 lg:py-14", className)}>
        <Container>
          <div className="rounded-[22px] bg-home-ink p-7 text-home-d1 md:p-12 lg:p-14">{children}</div>
        </Container>
      </section>
    );
  }
  return (
    <section aria-labelledby={labelledBy} className={cn("bg-home-ink py-16 text-home-d1 lg:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** "Start here": three hand-picked ideas as large cards. */
export function FeaturedIdeas({
  id,
  eyebrow = "Start here · hand-picked",
  heading,
  intro,
  ideas,
}: {
  id: string;
  eyebrow?: ReactNode;
  heading: ReactNode;
  intro?: ReactNode;
  ideas: PublicIdea[];
}) {
  if (ideas.length === 0) return null;
  return (
    <section aria-labelledby={id} className="pt-14 lg:pt-20">
      <Container className="flex flex-col gap-7">
        <SectionHeading id={id} eyebrow={eyebrow} intro={intro}>
          {heading}
        </SectionHeading>
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ideas.slice(0, 3).map((idea) => (
            <li key={idea.slug}>
              <FeaturedIdeaCard idea={idea} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export type BrowseLink = { href: string; label: string; blurb?: string };

/** Ruled serif links in three columns: "Keep browsing", "Other problems", related hubs. */
export function KeepBrowsing({
  id,
  heading,
  links,
  className,
}: {
  id: string;
  heading: ReactNode;
  links: BrowseLink[];
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby={id} className={cn("py-14 lg:py-20", className)}>
      <Container className="flex flex-col gap-5">
        <h2 id={id} className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3 md:text-xs">
          {heading}
        </h2>
        <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <li key={link.href} className="border-t border-home-rule">
              <Link
                href={link.href}
                className="group flex flex-col gap-1 py-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
              >
                <span className="flex items-center justify-between gap-4 font-editorial text-[22px] leading-[1.15] text-home-ink md:text-2xl">
                  {link.label}
                  <Icon
                    name="arrow"
                    size={20}
                    strokeWidth={1.75}
                    className="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
                {link.blurb && <span className="text-[15px] leading-[1.5] text-home-ink-2">{link.blurb}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export type FaqItem = { question: string; answer: ReactNode };

/** Questions as ruled `<details>` rows; the first opens by default. */
export function RuledFaq({
  id,
  heading,
  items,
  className,
}: {
  id: string;
  heading: ReactNode;
  items: FaqItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className={cn("py-14 lg:py-20", className)}>
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-14">
        <h2 id={id} className="font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-balance text-home-ink md:text-[40px]">
          {heading}
        </h2>
        <div className="border-t border-home-ink">
          {items.map((item, i) => (
            <details key={item.question} open={i === 0} className="group border-b border-home-rule py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-editorial text-[20px] leading-[1.25] text-home-ink marker:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-orange-ink md:text-[22px] [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden className="mt-1 font-mono text-base leading-none text-home-orange-ink group-open:hidden">
                  +
                </span>
                <span aria-hidden className="mt-1 hidden font-mono text-base leading-none text-home-orange-ink group-open:inline">
                  –
                </span>
              </summary>
              <div className="mt-3 max-w-[600px] text-base leading-[1.6] text-home-ink-2">{item.answer}</div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

