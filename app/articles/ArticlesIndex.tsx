"use client";

import * as React from "react";
import Link from "next/link";

import { Container, Em, ButtonLink, Eyebrow } from "@/components/home/ui";
import { Icon } from "@/components/home/icons";
import { PageHeader } from "@/components/public/PageHeader";
import { cn } from "@/lib/utils";

export type ArticleCard = {
  slug: string;
  title: string;
  description: string;
  category?: string;
  /** Preformatted "Jun 3, 2026" (server-side, deterministic). */
  displayDate?: string;
  readMinutes?: number;
};

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const MONO = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";

/**
 * Archive header, the latest article as a lead, and the ruled "All articles"
 * list ported from articles.html, including its client-side search filter
 * ("/" focuses the input). `priorityLinks` is a server-rendered slot for the
 * crawl-priority links.
 */
export function ArticlesIndex({
  articles,
  updatedLabel,
  priorityLinks,
}: {
  articles: ArticleCard[];
  updatedLabel?: string;
  priorityLinks?: React.ReactNode;
}) {
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const searchId = React.useId();

  // Legacy behavior: pressing "/" anywhere focuses the search input.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.category ?? "").toLowerCase().includes(q),
      )
    : articles;

  const categoryCount = new Set(
    articles.map((a) => a.category).filter(Boolean),
  ).size;

  // The lead is the newest article, shown only while the list is unfiltered.
  const lead = q ? undefined : filtered[0];
  const rows = lead ? filtered.slice(1) : filtered;

  return (
    <>
      <PageHeader
        eyebrow="Articles"
        title={
          <>
            Search for an <Em>article</Em>
          </>
        }
        meta={[
          <>
            <span className="text-home-ink">{filtered.length}</span> articles
          </>,
          <>
            <span className="text-home-ink">{categoryCount}</span> categories
          </>,
          updatedLabel ? (
            <>
              Updated <span className="text-home-ink">{updatedLabel}</span>
            </>
          ) : null,
        ]}
      >
        <div className="relative mt-1.5 w-full max-w-[560px]">
          <label htmlFor={searchId} className="sr-only">
            Search articles
          </label>
          <Icon
            name="search"
            size={18}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-[18px] top-[17px] text-home-ink-3"
          />
          <input
            ref={inputRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing to filter..."
            className={cn(
              "h-[52px] w-full rounded-full border border-home-ink-3 bg-home-card pl-12 pr-14 text-base text-home-ink placeholder:text-home-ink-3",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink",
            )}
          />
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute right-5 top-[15px] hidden h-[22px] min-w-[22px] items-center justify-center rounded border border-home-rule bg-home-paper px-1.5 font-mono text-[11px] text-home-ink-3 md:inline-flex"
          >
            /
          </kbd>
        </div>
      </PageHeader>

      {lead ? (
        <section aria-label="Latest article" className="mt-10 lg:mt-12">
          <Container>
            <Link
              href={`/articles/${lead.slug}`}
              className={cn(
                "group grid grid-cols-1 gap-6 border-y border-t-home-ink border-b-home-rule py-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-12 lg:py-10",
                FOCUS,
              )}
            >
              <div className="flex flex-col gap-3.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-orange-ink md:text-xs">
                  Latest
                  {lead.readMinutes ? ` · ${lead.readMinutes} min read` : ""}
                </span>
                <span className="font-editorial text-[34px] leading-[1.06] tracking-[-0.02em] text-home-ink text-balance md:text-[44px] lg:text-[52px]">
                  {lead.title}
                </span>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-[17px] leading-[1.6] text-home-ink-2">
                  {lead.description}
                </span>
                <span className="inline-flex items-center gap-2 text-[15px] font-medium text-home-orange-ink underline underline-offset-4 group-hover:text-home-ink">
                  Read the guide
                  <Icon name="arrow" size={16} strokeWidth={1.75} />
                </span>
              </div>
            </Link>
          </Container>
        </section>
      ) : null}

      <section aria-labelledby="all-articles" className="pb-16 pt-12 lg:pb-24 lg:pt-14">
        <Container className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="all-articles"
              className="font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink md:text-[40px]"
            >
              All articles
            </h2>
            <span className={MONO}>Newest first</span>
          </div>

          {filtered.length > 0 ? (
            <ol className="border-t border-home-rule">
              {rows.map((article) => (
                <li key={article.slug} className="border-b border-home-rule">
                  <Link
                    href={`/articles/${article.slug}`}
                    className={cn(
                      "group grid grid-cols-1 gap-2 rounded-[10px] px-0 py-6 transition-colors duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-home-card motion-reduce:transition-none lg:grid-cols-[120px_minmax(0,1fr)_104px_28px] lg:items-baseline lg:gap-6 lg:px-4",
                      FOCUS,
                    )}
                  >
                    <span className={MONO}>{article.displayDate}</span>
                    <span className="flex flex-col gap-1.5">
                      {article.category ? (
                        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-orange-ink">
                          {article.category}
                        </span>
                      ) : null}
                      <span className="font-editorial text-[24px] leading-[1.15] text-home-ink text-balance md:text-[26px]">
                        {article.title}
                      </span>
                      <span className="line-clamp-2 max-w-[680px] text-[15px] leading-[1.55] text-home-ink-2">
                        {article.description}
                      </span>
                    </span>
                    <span className={cn(MONO, "lg:text-right")}>
                      {article.readMinutes ? `${article.readMinutes} min read` : null}
                    </span>
                    <span
                      aria-hidden="true"
                      className="hidden text-home-ink lg:block"
                    >
                      <Icon
                        name="arrow"
                        size={20}
                        strokeWidth={1.75}
                        className="transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            /* No Results State */
            <div className="border-t border-home-rule py-20 text-center">
              <h3 className="font-editorial text-[28px] font-normal text-home-ink">
                No articles found
              </h3>
              <p className="mx-auto mt-2 max-w-md text-[15px] leading-[1.55] text-home-ink-2">
                Try a different search term or browse all categories.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className={cn(
                  "mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-home-ink px-6 text-base font-semibold text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper motion-reduce:transition-none",
                  FOCUS,
                )}
              >
                Clear search
              </button>
            </div>
          )}
        </Container>
      </section>

      {/* Crawl-priority internal links — Demand GSC Sep 2026 */}
      {priorityLinks}

      {/* CTA Section */}
      <section aria-labelledby="articles-cta" className="bg-home-ink text-home-d1">
        <Container className="flex flex-col gap-7 border-b border-home-dr py-14 lg:flex-row lg:items-end lg:justify-between lg:py-[72px]">
          <div className="flex max-w-[640px] flex-col gap-3">
            <Eyebrow dark>Ready to ship?</Eyebrow>
            <h2
              id="articles-cta"
              className="font-editorial text-[34px] font-normal leading-[1.04] tracking-[-0.02em] text-balance lg:text-[48px]"
            >
              Stop reading. <Em dark>Start building.</Em>
            </h2>
            <p className="max-w-[560px] text-base leading-[1.55] text-home-d2 md:text-[17px]">
              Get the Weekend MVP Starter Kit and turn your idea into something
              real this weekend.
            </p>
          </div>
          <ButtonLink
            href="/"
            tone="dark"
            className="w-full focus-visible:outline-home-orange-light lg:w-auto"
          >
            Get the Starter Kit
          </ButtonLink>
        </Container>
      </section>
    </>
  );
}
