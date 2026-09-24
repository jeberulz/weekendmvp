import Link from "next/link";

import type { CategoryCount, IndexRow } from "@/lib/home/types";
import { IndexList } from "../client/IndexList";
import { ButtonLink, Container, Em, Eyebrow, TextLink } from "../ui";

/** 02 · The Index: live count, categories, newest ideas. */
export function IdeaLibrary({ total, categories, rows }: { total: number; categories: CategoryCount[]; rows: IndexRow[] }) {
  return (
    <section aria-labelledby="home-library-title" className="bg-home-ink py-14 lg:py-24">
      <Container className="flex flex-col gap-7 lg:gap-10">
        <div className="flex items-center justify-between">
          <Eyebrow dark>The idea library · updated weekly</Eyebrow>
          <TextLink href="/startup-ideas" dark className="hidden lg:inline-flex">
            Browse all {total}
          </TextLink>
        </div>
        <h2 id="home-library-title" className="flex flex-col gap-1.5 font-editorial font-normal text-home-d1 lg:flex-row lg:items-end lg:gap-9">
          <span className="text-[150px] leading-[0.8] tracking-[-0.05em] lg:text-[300px] lg:leading-[0.78]">{total}</span>
          <span className="max-w-[560px] text-[32px] leading-[1.02] tracking-[-0.025em] lg:mb-3.5 lg:text-[56px] lg:tracking-[-0.02em]">
            startup ideas, each one <Em dark>sized for a weekend.</Em>
          </span>
        </h2>
        <nav aria-label="Idea categories" className="border-t border-home-dr pt-4 lg:pt-[22px]">
          <ul className="no-scrollbar flex gap-5 overflow-x-auto pb-1 [mask-image:linear-gradient(90deg,#000_78%,transparent)] lg:flex-wrap lg:gap-x-[26px] lg:gap-y-4 lg:overflow-visible lg:[mask-image:none]">
            <li className="shrink-0">
              <Link
                href="/startup-ideas"
                className="whitespace-nowrap border-b border-home-orange-light pb-1 font-mono text-[11px] tracking-[0.08em] text-home-orange-light lg:text-xs"
              >
                ALL <span className="text-home-d3">{total}</span>
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug} className="shrink-0">
                <Link
                  href={`/ideas/${c.slug}`}
                  className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em] text-home-d2 transition-colors hover:text-home-d1 lg:text-xs"
                >
                  {c.name} <span className="text-home-d3">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <IndexList rows={rows} />
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between lg:pt-2">
          <p className="font-mono text-[11px] tracking-[0.06em] text-home-d3 lg:text-xs">
            SHOWING <span className="lg:hidden">6</span>
            <span className="max-lg:hidden">{rows.length}</span> OF {total} · NEWEST FIRST
          </p>
          <ButtonLink href="/startup-ideas" tone="dark" className="w-full lg:w-auto">
            Browse all {total} ideas
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
