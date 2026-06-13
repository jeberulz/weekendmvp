"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX, X } from "lucide-react";

export type ArticleCard = {
  slug: string;
  title: string;
  description: string;
  category?: string;
  /** Preformatted "Jun 3, 2026" (server-side, deterministic). */
  displayDate?: string;
  readMinutes?: number;
};

/**
 * Archive hero + "All Articles" card list ported from articles.html,
 * including its client-side search filter ("/" focuses the input).
 */
export function ArticlesIndex({
  articles,
  updatedLabel,
}: {
  articles: ArticleCard[];
  updatedLabel?: string;
}) {
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

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

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[50vh] flex items-center justify-center pt-32 pb-16 px-6 overflow-hidden">
        {/* Background accent glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#CC5500]/5 blur-[120px] rounded-full pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto w-full">
          {/* Terminal-style header */}
          <div className="animate-enter mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] font-mono text-xs text-neutral-500">
              <span
                className="w-2 h-2 rounded-full bg-[#CC5500]/60 badge-pulse"
                aria-hidden="true"
              />
              <span className="sr-only">Section:</span>
              <span>~/articles</span>
            </div>
          </div>

          {/* Main heading with search integrated */}
          <div className="animate-enter stagger-1">
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <Search size={32} className="text-white/20" aria-hidden="true" />
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight leading-none">
                  Search for an article
                  <span className="search-cursor text-[#CC5500]">_</span>
                </h1>
              </div>

              {/* Search input */}
              <div className="relative mt-8">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="search-input w-full text-2xl md:text-3xl text-white/90 border-b border-white/10 pb-4 focus:border-[#CC5500]/50 transition-colors"
                  placeholder="Start typing to filter..."
                  aria-label="Search articles"
                />
                <div className="absolute right-0 bottom-4 flex items-center gap-2">
                  <kbd className="hidden md:inline-flex px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-neutral-500">
                    /
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="animate-enter stagger-2 mt-8 flex items-center gap-6 text-xs font-mono text-neutral-500">
            <span>
              <span className="text-white">{filtered.length}</span> articles
            </span>
            <span
              className="w-1 h-1 rounded-full bg-neutral-700"
              aria-hidden="true"
            />
            <span>
              <span className="text-white">{categoryCount}</span> categories
            </span>
            {updatedLabel ? (
              <>
                <span
                  className="w-1 h-1 rounded-full bg-neutral-700"
                  aria-hidden="true"
                />
                <span>
                  Updated <span className="text-white">{updatedLabel}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* Accent Line */}
      <div className="accent-line max-w-4xl mx-auto" aria-hidden="true" />

      {/* All Articles List */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-12">
            <h2 className="text-2xl font-semibold text-white">All Articles</h2>
            <span className="text-xs font-mono text-neutral-500">
              Sorted by date
            </span>
          </header>

          {filtered.length > 0 ? (
            <div className="space-y-6">
              {filtered.map((article) => (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group block p-6 bg-[#0A0A0A] border border-white/[0.06] rounded-xl hover:border-[#CC5500]/30 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {article.category ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#CC5500]/10 text-[#CC5500] border border-[#CC5500]/20">
                            {article.category}
                          </span>
                        ) : null}
                        {article.displayDate ? (
                          <span className="text-xs font-mono text-neutral-600">
                            {article.displayDate}
                          </span>
                        ) : null}
                        {article.readMinutes ? (
                          <span className="text-xs font-mono text-neutral-600">
                            {article.readMinutes} min read
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-lg font-medium text-white group-hover:text-[#CC5500] transition-colors">
                        {article.title}
                      </h3>
                      <p className="mt-2 text-sm text-neutral-500 line-clamp-2">
                        {article.description}
                      </p>
                    </div>
                    <ArrowRight
                      size={20}
                      className="text-neutral-600 group-hover:text-[#CC5500] group-hover:translate-x-1 transition-all"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* No Results State */
            <div className="py-24 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <SearchX size={24} className="text-neutral-600" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No articles found
              </h3>
              <p className="text-sm text-neutral-500 mb-6">
                Try a different search term or browse all categories.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors"
              >
                <X size={14} aria-hidden="true" />
                Clear search
              </button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-white/5 bg-gradient-to-b from-[#050505] to-[#0A0A0A]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#CC5500]/10 border border-[#CC5500]/20 font-mono text-xs text-[#CC5500] mb-8">
            Ready to ship?
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-4">
            Stop reading. Start building.
          </h2>
          <p className="text-lg text-neutral-400 font-light mb-10 max-w-xl mx-auto">
            Get the Weekend MVP Starter Kit and turn your idea into something
            real this weekend.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
          >
            <span>Get the Starter Kit</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
