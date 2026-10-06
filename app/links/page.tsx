import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Em } from "@/components/home/ui";
import { Logo } from "@/components/primitives/Logo";
import {
  filterReleasedRows,
  paginateReleasedRows,
} from "./_archive-core.mjs";
import {
  CATEGORY_OPTIONS,
  getReleasedVideoLinks,
  type VideoLink,
} from "./_data";
import { newsreaderEditorial } from "@/lib/fonts";
import { SITE } from "@/lib/seo";
import { cn } from "@/lib/utils";

const CAMPAIGN_TIME_ZONE = "Europe/London";
const PAGE_SIZE = 8;

type RawSearchParams = Record<string, string | string[] | undefined>;

type LinksPageProps = {
  searchParams: Promise<RawSearchParams>;
};

type ArchiveState = {
  query: string;
  category?: string;
  format?: string;
  page: number;
};

type PaginationResult = {
  items: VideoLink[];
  page: number;
  pageSize: number;
  totalCount: number;
  visibleCount: number;
  remainingCount: number;
  nextBatchSize: number;
  hasMore: boolean;
};

export const metadata: Metadata = {
  title: "Daily Startup Ideas",
  description:
    "Today's Weekend MVP idea plus every previously released buildable startup concept.",
  alternates: { canonical: "/links" },
  openGraph: {
    type: "website",
    url: `${SITE}/links`,
    title: "Daily Startup Ideas | Weekend MVP",
    description:
      "Start with today's idea, then explore the complete archive of buildable startup concepts.",
    images: [`${SITE}/image/og-image.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily Startup Ideas | Weekend MVP",
    description:
      "Start with today's idea, then explore the complete archive of buildable startup concepts.",
    images: [`${SITE}/image/og-image.png`],
  },
};

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatLabel(value: string): string {
  const acronyms: Record<string, string> = {
    ai: "AI",
    mvp: "MVP",
    pov: "POV",
  };
  const lowercase = new Set(["and", "for", "of", "the"]);

  return value
    .split("-")
    .map((word, index) => {
      if (acronyms[word]) return acronyms[word];
      if (index > 0 && lowercase.has(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function archiveHref(state: Partial<ArchiveState>): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.category) params.set("category", state.category);
  if (state.format) params.set("format", state.format);
  if (state.page && state.page > 1) params.set("page", String(state.page));

  const query = params.toString();
  return `${query ? `/links?${query}` : "/links"}#released-ideas`;
}

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const MONO = "font-mono text-[11px] uppercase tracking-[0.08em]";
const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-home-rule bg-home-card px-3 py-1.5 text-home-ink-2 transition-colors hover:border-home-ink hover:text-home-ink motion-reduce:transition-none";
const SOLID_BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-home-ink px-6 text-sm font-semibold text-home-d1 transition-colors hover:bg-home-ink-2 motion-reduce:transition-none";

function VideoCard({
  link,
  featured = false,
}: {
  link: VideoLink;
  featured?: boolean;
}) {
  const destination = link.kind === "idea" ? "Read full idea" : "Read article";

  return (
    <Link
      href={link.href}
      className={cn(
        "group grid min-h-36 grid-cols-[7.5rem_1fr] overflow-hidden rounded-2xl border transition-[border-color,background-color] duration-200 motion-reduce:transition-none sm:grid-cols-[9rem_1fr]",
        FOCUS,
        featured
          ? "border-home-ink bg-home-card hover:bg-home-sunk"
          : "border-home-rule bg-home-card hover:border-home-ink",
      )}
      aria-label={`${destination}: ${link.title}`}
    >
      <div className="relative m-2 mr-0 min-h-32 overflow-hidden rounded-xl bg-home-sunk">
        <Image
          src={link.image}
          alt=""
          fill
          sizes="(max-width: 640px) 120px, 144px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
          priority={featured}
        />
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {featured ? (
              <span className="rounded-full bg-home-orange-ink px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-white">
                Today
              </span>
            ) : null}
            <span className={cn(MONO, "text-home-ink-3")}>
              {link.day}, {link.date}
            </span>
          </div>
          <h3
            className={cn(
              "font-editorial font-normal leading-[1.15] tracking-[-0.01em] text-home-ink text-balance",
              featured ? "text-[22px] sm:text-[26px]" : "text-xl sm:text-[22px]",
            )}
          >
            {link.title}
          </h3>
        </div>

        <div className="flex min-w-0 items-end justify-between gap-3 text-xs">
          <div className="min-w-0">
            <p className="truncate font-medium text-home-ink-2">
              {link.categoryLabel}
            </p>
            <p className="mt-1 truncate text-home-ink-3">
              {formatLabel(link.format)}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 font-medium text-home-orange-ink">
            {destination}
            <ArrowUpRight
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function LinksPage({ searchParams }: LinksPageProps) {
  await connection();
  const currentDate = dateInTimeZone(new Date(), CAMPAIGN_TIME_ZONE);
  const [releasedLinks, rawParams] = await Promise.all([
    getReleasedVideoLinks(currentDate),
    searchParams,
  ]);
  const today =
    releasedLinks.find((link) => link.isoDate === currentDate) ?? null;
  const previousLinks = today
    ? releasedLinks.filter((link) => link.href !== today.href)
    : releasedLinks;
  const availableCategories = CATEGORY_OPTIONS.filter((option) =>
    previousLinks.some((link) => link.category === option.slug),
  );
  const availableFormats = [...new Set(previousLinks.map((link) => link.format))]
    .sort((left, right) => formatLabel(left).localeCompare(formatLabel(right)));

  const query = firstParam(rawParams.q).trim().slice(0, 80);
  const requestedCategory = firstParam(rawParams.category);
  const category = availableCategories.some(
    (option) => option.slug === requestedCategory,
  )
    ? requestedCategory
    : undefined;
  const requestedFormat = firstParam(rawParams.format);
  const format = availableFormats.includes(requestedFormat)
    ? requestedFormat
    : undefined;
  const requestedPage = Number.parseInt(firstParam(rawParams.page), 10);
  const filteredLinks = filterReleasedRows(previousLinks, {
    query,
    category,
    format,
  }) as VideoLink[];
  const pagination = paginateReleasedRows(
    filteredLinks,
    requestedPage,
    PAGE_SIZE,
  ) as PaginationResult;
  const state: ArchiveState = {
    query,
    category,
    format,
    page: pagination.page,
  };
  const activeFilterCount = [query, category, format].filter(Boolean).length;

  return (
    <main
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk min-h-[100dvh] bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
      )}
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <header className="mb-12 sm:mb-16">
          <div className="flex items-center justify-between gap-6">
            <Link
              href="/"
              className={cn("inline-flex rounded-md", FOCUS)}
              aria-label="Weekend MVP home"
            >
              <Logo className="h-6 w-40 text-home-ink" />
            </Link>

            <div className="flex items-center gap-3">
              <p className="hidden max-w-40 text-right text-xs leading-relaxed text-home-ink-3 sm:block">
                A buildable startup idea, every day.
              </p>
              <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-home-sunk">
                <Image
                  src="/image/john-portrait.webp"
                  alt="John Iseghohi, creator of Weekend MVP"
                  fill
                  priority
                  sizes="44px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          <div className="mt-12 max-w-2xl border-b border-home-ink pb-10 sm:mt-16 sm:pb-12">
            <p className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink md:text-xs">
              I&apos;d Build This Weekend
            </p>
            <h1 className="max-w-xl font-editorial text-[42px] font-normal leading-[1.02] tracking-[-0.03em] text-balance text-home-ink sm:text-5xl md:text-6xl">
              Today&apos;s idea. <Em>Every release behind it.</Em>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-[1.55] text-home-ink-2 sm:text-lg">
              Start with today&apos;s short video, then explore every research-backed
              startup idea released so far.
            </p>
          </div>
        </header>

        {today ? (
          <section className="mb-16 sm:mb-20" aria-labelledby="today-heading">
            <div className="mb-6 max-w-xl">
              <h2
                id="today-heading"
                className="font-editorial text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink sm:text-[34px]"
              >
                Today&apos;s startup idea
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-home-ink-2 sm:text-base">
                The complete research, business model, and weekend build plan.
              </p>
            </div>
            <div className="max-w-2xl">
              <VideoCard link={today} featured />
            </div>
          </section>
        ) : null}

        <section id="released-ideas" aria-labelledby="released-heading">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="released-heading"
                className="font-editorial text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink sm:text-[34px]"
              >
                Previously released
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-home-ink-2 sm:text-base">
                Browse the ideas behind earlier daily videos.
              </p>
            </div>
            <p className={cn(MONO, "text-home-ink-3")} aria-live="polite">
              {pagination.totalCount} {pagination.totalCount === 1 ? "idea" : "ideas"}
              {activeFilterCount > 0 ? " found" : " released"}
            </p>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <form action="/links" method="get" className="flex min-w-0 flex-1 gap-2">
              {category ? (
                <input type="hidden" name="category" value={category} />
              ) : null}
              {format ? <input type="hidden" name="format" value={format} /> : null}
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search released ideas</span>
                <Search
                  size={17}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-home-ink-3"
                />
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  maxLength={80}
                  placeholder="Search released ideas"
                  className={cn(
                    "h-12 w-full rounded-full border border-home-ink-3 bg-home-card pl-11 pr-4 text-base text-home-ink transition-colors placeholder:text-home-ink-3 motion-reduce:transition-none",
                    FOCUS,
                  )}
                />
              </label>
              <button type="submit" className={cn(SOLID_BUTTON, "shrink-0", FOCUS)}>
                Search
              </button>
            </form>

            <details className="group relative sm:w-auto">
              <summary
                className={cn(
                  "flex h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-home-ink-3 bg-home-card px-5 text-sm font-medium text-home-ink transition-colors hover:border-home-ink motion-reduce:transition-none [&::-webkit-details-marker]:hidden",
                  FOCUS,
                )}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
                {format ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-home-orange-ink text-[11px] font-bold text-white">
                    1
                  </span>
                ) : null}
              </summary>
              <div className="z-10 mt-2 rounded-2xl border border-home-rule bg-home-card p-4 sm:absolute sm:right-0 sm:w-72">
                <form action="/links" method="get">
                  {query ? <input type="hidden" name="q" value={query} /> : null}
                  {category ? (
                    <input type="hidden" name="category" value={category} />
                  ) : null}
                  <fieldset>
                    <legend className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-2">
                      Video format
                    </legend>
                    <div className="mt-3 space-y-1">
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-home-ink-2 hover:bg-home-sunk hover:text-home-ink">
                        <input
                          type="radio"
                          name="format"
                          value=""
                          defaultChecked={!format}
                          className="accent-home-orange-ink"
                        />
                        All formats
                      </label>
                      {availableFormats.map((option) => (
                        <label
                          key={option}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-home-ink-2 hover:bg-home-sunk hover:text-home-ink"
                        >
                          <input
                            type="radio"
                            name="format"
                            value={option}
                            defaultChecked={format === option}
                            className="accent-home-orange-ink"
                          />
                          {formatLabel(option)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button
                    type="submit"
                    className={cn(SOLID_BUTTON, "mt-4 w-full", FOCUS)}
                  >
                    Apply filter
                  </button>
                </form>
              </div>
            </details>
          </div>

          {availableCategories.length > 0 ? (
            <nav
              aria-label="Filter released ideas by category"
              className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            >
              <div className="flex w-max gap-2">
                <Link
                  href={archiveHref({ ...state, category: undefined, page: 1 })}
                  aria-current={!category ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none",
                    FOCUS,
                    !category
                      ? "border-home-ink bg-home-ink text-home-d1"
                      : "border-home-rule bg-home-card text-home-ink-2 hover:border-home-ink hover:text-home-ink",
                  )}
                >
                  All
                </Link>
                {availableCategories.map((option) => {
                  const active = category === option.slug;
                  return (
                    <Link
                      key={option.slug}
                      href={archiveHref({
                        ...state,
                        category: option.slug,
                        page: 1,
                      })}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none",
                        FOCUS,
                        active
                          ? "border-home-ink bg-home-ink text-home-d1"
                          : "border-home-rule bg-home-card text-home-ink-2 hover:border-home-ink hover:text-home-ink",
                      )}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}

          {activeFilterCount > 0 ? (
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-home-ink-3">Active:</span>
              {query ? (
                <Link
                  href={archiveHref({ ...state, query: "", page: 1 })}
                  className={cn(PILL, FOCUS)}
                >
                  &ldquo;{query}&rdquo;
                  <X size={12} aria-hidden="true" />
                </Link>
              ) : null}
              {format ? (
                <Link
                  href={archiveHref({ ...state, format: undefined, page: 1 })}
                  className={cn(PILL, FOCUS)}
                >
                  {formatLabel(format)}
                  <X size={12} aria-hidden="true" />
                </Link>
              ) : null}
              {category ? (
                <Link
                  href={archiveHref({ ...state, category: undefined, page: 1 })}
                  className={cn(PILL, FOCUS)}
                >
                  {availableCategories.find((option) => option.slug === category)
                    ?.label ?? category}
                  <X size={12} aria-hidden="true" />
                </Link>
              ) : null}
              <Link
                href="/links#released-ideas"
                className={cn(
                  "rounded-full px-2 py-1.5 font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink",
                  FOCUS,
                )}
              >
                Clear all
              </Link>
            </div>
          ) : null}

          {pagination.items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                {pagination.items.map((link) => (
                  <VideoCard key={`${link.isoDate}-${link.href}`} link={link} />
                ))}
              </div>

              {pagination.hasMore ? (
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Link
                    href={archiveHref({ ...state, page: pagination.page + 1 })}
                    className={cn(
                      "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-home-ink px-6 text-sm font-semibold text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper motion-reduce:transition-none sm:w-auto",
                      FOCUS,
                    )}
                  >
                    Load {pagination.nextBatchSize} more {pagination.nextBatchSize === 1 ? "idea" : "ideas"}
                  </Link>
                  <p className={cn(MONO, "text-home-ink-3")}>
                    Showing {pagination.visibleCount} of {pagination.totalCount}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-home-rule bg-home-card px-6 py-12 text-center">
              <h3 className="font-editorial text-2xl font-normal text-home-ink">
                {previousLinks.length === 0
                  ? "The archive starts tomorrow"
                  : "No released ideas match"}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-home-ink-2">
                {previousLinks.length === 0
                  ? "Today's idea will move here when the next daily release goes live."
                  : "Try another search or clear the filters to see every released idea."}
              </p>
              {activeFilterCount > 0 ? (
                <Link
                  href="/links#released-ideas"
                  className={cn(SOLID_BUTTON, "mt-6", FOCUS)}
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
          )}
        </section>

        <footer className="mt-20 border-t border-home-rule pt-8 sm:mt-28">
          <div className="flex flex-col gap-2 text-sm text-home-ink-3 sm:flex-row sm:items-center sm:justify-between">
            <p>A new idea joins the archive every day.</p>
            <Link
              href="/"
              className={cn(
                "inline-flex min-h-11 w-fit items-center text-home-ink-2 underline underline-offset-4 transition-colors hover:text-home-ink motion-reduce:transition-none",
                FOCUS,
              )}
            >
              Weekend MVP
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
