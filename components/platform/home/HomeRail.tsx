"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type RefObject } from "react";
import { api } from "@/convex/_generated/api";
import { categoryName } from "@/components/ideas/idea-meta";
import { STARTER_KIT_HREF } from "@/components/platform/shell/workspace-current";
import { trackDashboardEvent } from "@/lib/track";
import { useDismissed } from "./dismiss-state";
import { ModuleSkeleton, PersonalModule } from "./module-states";

type HomeState = FunctionReturnType<typeof api.platform.dashboard.home>;

const EYEBROW = "font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-home-ink-3";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

const KIT_OFFER = { offer_id: "starter-kit", kind: "starter_kit" } as const;
const KIT_ITEMS = [
  "The 15-second demo test",
  "3-screen MVP template",
  "48-hour weekend plan",
  "Copy-paste AI prompts",
];

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

/**
 * Interim offer slot (ruling R6): the Starter Kit card for free members,
 * dismissible. WP44-S12 replaces the choice with the server rules (first 24
 * hours, promos, kit claimed) and stores the dismissal on the member.
 */
function StarterKitCard({ onDismissed }: { onDismissed: () => void }) {
  const [dismissed, dismiss] = useDismissed(KIT_OFFER.offer_id);
  const viewed = useRef(false);

  useEffect(() => {
    if (dismissed || viewed.current) return;
    viewed.current = true;
    trackDashboardEvent({ name: "offer_viewed", props: KIT_OFFER });
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <section
      aria-labelledby="rail-kit-heading"
      className="flex flex-col gap-2.5 rounded-[14px] border border-dashed border-home-ink-3 bg-home-sunk p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={EYEBROW}>Free · Starter Kit</p>
        <button
          type="button"
          aria-label="Dismiss the Starter Kit card"
          onClick={() => {
            trackDashboardEvent({ name: "offer_dismissed", props: KIT_OFFER });
            dismiss();
            onDismissed();
          }}
          className={`-my-3 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-lg text-home-ink-2 transition-colors hover:bg-home-card hover:text-home-ink ${FOCUS}`}
        >
          <X aria-hidden className="size-4" strokeWidth={1.8} />
        </button>
      </div>
      <h2
        id="rail-kit-heading"
        className="font-editorial text-[21px] font-normal leading-[1.15] text-home-ink"
      >
        Everything for your first weekend build
      </h2>
      <ul className="flex list-disc flex-col gap-0.5 pl-[18px] text-[13px] text-home-ink-2">
        {KIT_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="flex justify-between border-t border-dashed border-home-ink-3 pt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
        <span>From an idea</span>
        <span>To a live link</span>
      </p>
      <Link
        href={STARTER_KIT_HREF}
        onClick={() => trackDashboardEvent({ name: "offer_clicked", props: KIT_OFFER })}
        className={`inline-flex h-11 items-center justify-center rounded-[9px] border border-home-rule bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3 ${FOCUS}`}
      >
        Get the free kit
      </Link>
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
      {home.plan === "free" && <StarterKitCard onDismissed={() => savedHeading.current?.focus()} />}
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
