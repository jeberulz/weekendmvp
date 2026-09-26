"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useRef, type RefObject } from "react";
import { api } from "@/convex/_generated/api";
import { categoryName } from "@/components/ideas/idea-meta";
import { ModuleSkeleton, PersonalModule } from "./module-states";
import { OfferCard } from "./OfferCard";

type HomeState = FunctionReturnType<typeof api.platform.dashboard.home>;

const EYEBROW = "font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-home-ink-3";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

function SavedList({ home, headingRef }: { home: HomeState; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const { latest, count } = home.saved;
  return (
    <section
      aria-labelledby="rail-saved-heading"
      className="flex flex-col gap-2 rounded-[14px] border border-home-rule bg-home-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="rail-saved-heading" ref={headingRef} tabIndex={-1} className={`${EYEBROW} outline-none`}>
          Saved
        </h2>
        {count > 0 && (
          <Link
            href="/dashboard/saved"
            className={`text-[13px] font-medium text-home-orange-ink underline-offset-4 hover:text-home-ink hover:underline ${FOCUS}`}
          >
            See all<span className="sr-only"> saved ideas</span>
          </Link>
        )}
      </div>
      {latest.length === 0 ? (
        <p className="text-sm leading-[1.5] text-home-ink-2">
          Nothing saved yet. Tap Save on any idea to keep it here.
        </p>
      ) : (
        <ul className="flex flex-col">
          {latest.map((idea) => (
            <li key={idea.ideaId} className="border-b border-home-rule py-2 last:border-b-0">
              <Link
                href={`/ideas/${idea.slug}`}
                className={`block text-sm font-medium leading-snug text-home-ink underline-offset-4 hover:text-home-orange-ink hover:underline ${FOCUS}`}
              >
                {idea.title}
              </Link>
              <span className="mt-0.5 block text-[12px] text-home-ink-3">
                {categoryName(idea.category)} · {idea.buildTime} hrs
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LiveRail() {
  const home = useQuery(api.platform.dashboard.home);
  const savedHeading = useRef<HTMLHeadingElement>(null);
  if (home === undefined) return <RailSkeleton />;
  return (
    <>
      <SavedList home={home} headingRef={savedHeading} />
      {/* WP44-S12: at most one offer, chosen on the server (PRD 6.2). */}
      <OfferCard onDismissed={() => savedHeading.current?.focus()} />
    </>
  );
}

function RailSkeleton() {
  return <ModuleSkeleton label="Loading your saved ideas" className="h-[200px]" />;
}

/**
 * Right rail at 1280px and wider. Below that it drops under module 4 in the
 * same order (PRD 6.2). A plain wrapper, not an `aside`: complementary
 * landmarks must not nest inside `main`.
 */
export function HomeRail() {
  return (
    <div className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20">
      <PersonalModule skeleton={<RailSkeleton />}>
        <LiveRail />
      </PersonalModule>
    </div>
  );
}
