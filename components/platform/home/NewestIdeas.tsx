import Link from "next/link";
import { CategoryTag } from "@/components/home/ui";
import type { IndexRow } from "@/lib/home/types";
import { SaveIdeaButton } from "./SaveIdeaButton";

/**
 * Module 4. The head of the homepage Index, rendered on the server. Called
 * "Newest ideas" rather than "New this week": the library does not publish
 * every week, and the label must stay true.
 */
export function NewestIdeas({ rows }: { rows: IndexRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="newest-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="newest-heading"
          className="font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-home-ink-3"
        >
          Newest ideas
        </h2>
        <Link
          href="/dashboard/explore?sort=newest"
          className="text-[13px] font-medium text-home-orange-ink underline-offset-4 hover:text-home-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          View all<span className="sr-only"> newest ideas</span>
        </Link>
      </div>
      <ul className="border-t border-home-ink">
        {rows.map((row) => (
          <li key={row.slug} className="flex items-center gap-3 border-b border-home-rule py-2">
            <span className="w-14 shrink-0 font-mono text-xs text-home-ink-3">
              <span aria-hidden>N°</span>
              <span className="sr-only">Number </span>
              {row.libraryNo}
            </span>
            <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
              <Link
                href={`/ideas/${row.slug}`}
                className="block text-[15px] font-medium leading-snug text-home-ink underline-offset-4 hover:text-home-orange-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink md:flex-1"
              >
                {row.title}
              </Link>
              <div className="mt-1 flex shrink-0 items-center gap-3 md:mt-0">
                {row.category && <CategoryTag slug={row.category} name={row.categoryName} />}
                {row.buildTime > 0 && (
                  <span className="w-14 font-mono text-[11px] tracking-[0.08em] text-home-ink-2">
                    {row.buildTime} HRS
                  </span>
                )}
              </div>
            </div>
            <SaveIdeaButton slug={row.slug} title={row.title} variant="icon" />
          </li>
        ))}
      </ul>
    </section>
  );
}
