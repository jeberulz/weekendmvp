"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search, SearchX, X } from "lucide-react";

export type IssueCard = {
  slug: string;
  title: string;
  description?: string;
  edition: "am" | "pm";
  /** Preformatted "May 22, 2026" (server-side, deterministic). */
  displayDate?: string;
  /** YYYY-MM-DD for <time datetime> */
  isoDate?: string;
};

/**
 * "Past sends" archive with a client-side search filter (title +
 * description + AM/PM edition), mirroring the ArticlesIndex search
 * pattern. All cards are in the server HTML; filtering only hides.
 */

/** Archive card ported from the legacy newsletter-cards grid markup. */
function IssueCardLink({ issue }: { issue: IssueCard }) {
  const am = issue.edition === "am";
  return (
    <Link
      href={`/newsletter/${issue.slug}`}
      data-nl-card
      data-nl-slot={issue.edition}
      data-nl-date={issue.isoDate}
      className="nl-card group block p-6 bg-[#0A0A0A] border border-white/[0.06] rounded-2xl hover:border-white/20 transition-all"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span
          className={`px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
            am
              ? "bg-[#CC5500]/10 border-[#CC5500]/30 text-[#CC5500]"
              : "bg-white/5 border-white/10 text-neutral-300"
          }`}
        >
          {am ? "AM · Idea of the Day" : "PM · Builder Brief"}
        </span>
        <time
          className="text-[11px] font-mono text-neutral-500"
          dateTime={issue.isoDate}
        >
          {issue.displayDate}
        </time>
      </div>
      <h3 className="text-lg font-medium text-white mb-2 leading-snug group-hover:text-[#CC5500] transition-colors">
        {issue.title}
      </h3>
      <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2">
        {issue.description}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-600 group-hover:text-[#CC5500] transition-colors">
        <span>Read</span>
        <ArrowRight size={14} aria-hidden="true" />
      </div>
    </Link>
  );
}

export function NewsletterArchive({ issues }: { issues: IssueCard[] }) {
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? issues.filter(
        (issue) =>
          issue.title.toLowerCase().includes(q) ||
          (issue.description ?? "").toLowerCase().includes(q) ||
          issue.edition === q,
      )
    : issues;

  return (
    <>
      <div className="relative mb-8">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search past sends..."
          aria-label="Search newsletter issues"
          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
        />
      </div>

      {filtered.length > 0 ? (
        <div
          id="newsletter-grid"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {filtered.map((issue) => (
            <IssueCardLink key={issue.slug} issue={issue} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <SearchX size={24} className="text-neutral-600" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            No sends found
          </h3>
          <p className="text-sm text-neutral-500 mb-6">
            Try a different search term, or “am” / “pm” for an edition.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <X size={14} aria-hidden="true" />
            Clear search
          </button>
        </div>
      )}
    </>
  );
}
