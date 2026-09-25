"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { CategoryTag } from "@/components/home/ui";
import { categoryName, normalizeCategorySlug } from "@/components/ideas/idea-meta";
import { ReasonLine } from "@/components/platform/explore/ReasonLine";
import { ModuleSkeleton, PersonalModule } from "./module-states";
import { SaveIdeaButton } from "./SaveIdeaButton";

const PICK_COUNT = 3;

type Pick = FunctionReturnType<typeof api.platform.ideas.library>["items"][number];

function PicksSkeleton() {
  return <ModuleSkeleton label="Loading ideas picked for you" className="h-[172px]" />;
}

function LivePicks({ exclude }: { exclude: string[] }) {
  // Ranked over the whole library, saved ideas left out on the server.
  const result = useQuery(api.platform.ideas.library, {
    view: "for_you",
    unsavedOnly: true,
    limit: PICK_COUNT + exclude.length,
  });
  // Pin the first three picks. Otherwise saving one would drop it from the
  // query and swap the card out from under the member's pointer.
  const [picks, setPicks] = useState<Pick[] | null>(null);

  if (result === undefined) return <PicksSkeleton />;

  if (picks === null) {
    const skip = new Set(exclude);
    setPicks(result.items.filter((idea) => !skip.has(idea.slug)).slice(0, PICK_COUNT));
    return <PicksSkeleton />;
  }

  if (picks.length === 0) {
    return (
      <p className="rounded-[14px] border border-home-rule bg-home-card px-5 py-4 text-sm text-home-ink-2">
        You have saved every idea we would pick for you.{" "}
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
            <ReasonLine reason={idea.reason} />
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

const HINT = "text-[13px] text-home-ink-3";

/** New answers re-rank the library, so the pinned picks start over. */
function PicksForMember({ exclude }: { exclude: string[] }) {
  const prefs = useQuery(api.platform.preferences.get);
  if (prefs === undefined) return <PicksSkeleton />;
  return (
    <>
      <LivePicks key={prefs.updatedAt ?? 0} exclude={exclude} />
      {!prefs.setupDone &&
        (prefs.setupSkipped ? (
          <p className={HINT}>
            <Link
              href="/dashboard/settings"
              className="font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              Answer three quick questions
            </Link>{" "}
            and these picks get personal.
          </p>
        ) : (
          <p className={HINT}>Answer the three questions above and these picks get personal.</p>
        ))}
    </>
  );
}

/**
 * Module 3. Three unsaved ideas from the `for_you` ranking, each with the
 * one input that lifted it (WP44-S8), or no reason line at all.
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
        <PicksForMember exclude={exclude} />
      </PersonalModule>
    </section>
  );
}
