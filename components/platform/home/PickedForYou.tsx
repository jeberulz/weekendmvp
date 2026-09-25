"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { CategoryTag } from "@/components/home/ui";
import { categoryName, normalizeCategorySlug } from "@/components/ideas/idea-meta";
import { ModuleSkeleton, PersonalModule } from "./module-states";
import { SaveIdeaButton } from "./SaveIdeaButton";

const PICK_COUNT = 3;
/** One page of the ranked library is plenty to find three unsaved ideas. */
const PICK_POOL = 24;

function PicksSkeleton() {
  return <ModuleSkeleton label="Loading ideas picked for you" className="h-[172px]" />;
}

function LivePicks({ exclude }: { exclude: string[] }) {
  const result = useQuery(api.platform.ideas.explore, {
    paginationOpts: { numItems: PICK_POOL, cursor: null },
    view: "for_you",
    sort: "recommended",
  });
  // Pin the first three picks. Otherwise saving one would swap the card out
  // from under the member's pointer as the query re-runs.
  const [pinned, setPinned] = useState<string[] | null>(null);

  if (result === undefined) return <PicksSkeleton />;

  if (pinned === null) {
    const skip = new Set(exclude);
    const slugs = result.page
      .filter((idea) => !idea.saved && !idea.interested && !skip.has(idea.slug))
      .slice(0, PICK_COUNT)
      .map((idea) => idea.slug);
    setPinned(slugs);
    return <PicksSkeleton />;
  }

  const bySlug = new Map(result.page.map((idea) => [idea.slug, idea]));
  const picks = pinned.map((slug) => bySlug.get(slug)).filter((idea) => idea !== undefined);

  if (picks.length === 0) {
    return (
      <p className="rounded-[14px] border border-home-rule bg-home-card px-5 py-4 text-sm text-home-ink-2">
        You have saved every recent idea.{" "}
        <Link
          href="/dashboard/explore"
          className="font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          Browse the full library
        </Link>
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {picks.map((idea) => {
        const category = normalizeCategorySlug(idea.category);
        return (
          <li
            key={idea.ideaId}
            className="flex min-h-[172px] flex-col gap-3 rounded-[14px] border border-home-rule bg-home-card p-4"
          >
            <div className="flex">
              <CategoryTag slug={category} name={categoryName(category)} />
            </div>
            <h3 className="font-editorial text-[19px] font-normal leading-[1.2] text-home-ink">
              <Link
                href={`/ideas/${idea.slug}`}
                className="underline-offset-4 hover:text-home-orange-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
              >
                {idea.title}
              </Link>
            </h3>
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] tracking-[0.08em] text-home-ink-2">
                {idea.buildTime} HRS
              </span>
              <SaveIdeaButton slug={idea.slug} title={idea.title} variant="icon" className="-mb-2 -mr-2" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Module 3. Three unsaved ideas from the `for_you` ranking. No reason line
 * yet: reasons arrive with the setup questions (S8), and a card shows none
 * rather than an invented one.
 */
export function PickedForYou({ exclude }: { exclude: string[] }) {
  return (
    <section aria-labelledby="picked-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="picked-heading"
          className="font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-home-ink-3"
        >
          Picked for you
        </h2>
        <Link
          href="/dashboard/explore?view=for_you"
          className="text-[13px] font-medium text-home-orange-ink underline-offset-4 hover:text-home-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          See all<span className="sr-only"> ideas picked for you</span>
        </Link>
      </div>
      <PersonalModule skeleton={<PicksSkeleton />}>
        <LivePicks exclude={exclude} />
      </PersonalModule>
    </section>
  );
}
