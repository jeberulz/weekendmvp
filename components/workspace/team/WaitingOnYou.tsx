"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { CARD, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import {
  BLUEPRINT_MISSING_COPY,
  BLUEPRINT_SECTION_ID,
  changeRoundNote,
  expiresInWords,
  WAITING_EMPTY_COPY,
  WAITING_ERROR_COPY,
} from "@/lib/workspace/reviewPages";

type Review = FunctionReturnType<typeof api.workspace.reviews.pendingReviews>[number];

/**
 * L1-C6: "Waiting on you". Lists the crew's pending review cards, read from
 * `pendingReviews` (so "nothing is waiting" is a checked state). The query
 * never reads the clock, so a card past its `expiresAt` is left out here.
 * The blueprint is reviewed on this page, so its link jumps to that section;
 * every other row links to the page where it is reviewed.
 */

const link = cn("font-medium text-home-ink underline underline-offset-2", FOCUS);

const NOW_REFRESH_MS = 60_000;

/** The time now, refreshed every minute and when the tab becomes visible again, so a closed card drops off. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, NOW_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

/**
 * The blueprint is reviewed on this page, so its link jumps to the section. If
 * the blueprint cannot be shown (none, unavailable, or the read failed), there
 * is nothing to jump to, so say so instead of leaving a link that does nothing.
 */
function BlueprintLinkChecked({ projectId, label }: { projectId: Id<"projects">; label: string }) {
  const view = useQuery(api.growth.drafts.blueprint.blueprintDraft, { projectId });
  if (view !== undefined && view.state !== "ready") {
    return <p className="text-[13px] text-home-ink-2">{BLUEPRINT_MISSING_COPY}</p>;
  }
  return <a href={`#${BLUEPRINT_SECTION_ID}`} className={link}>{label}</a>;
}

function BlueprintLink({ projectId, label }: { projectId: Id<"projects">; label: string }) {
  return (
    <QuietErrorBoundary fallback={<p className="text-[13px] text-home-ink-2">{BLUEPRINT_MISSING_COPY}</p>}>
      <BlueprintLinkChecked projectId={projectId} label={label} />
    </QuietErrorBoundary>
  );
}

function Row({ review, now, projectId }: { review: Review; now: number; projectId: Id<"projects"> }) {
  const round = changeRoundNote(Number(review.changeRound));
  const label = `Review ${review.title}`;
  return (
    <li className={cn(CARD, "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3")}>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-home-ink">{review.title}</p>
        <p className="text-[13px] text-home-ink-2">
          {round === null ? "" : `${round}. `}
          Closes {expiresInWords(review.expiresAt, now)}.
        </p>
      </div>
      {review.kind === "blueprint" ? (
        <BlueprintLink projectId={projectId} label={label} />
      ) : (
        <Link href={review.href} className={link}>{label}</Link>
      )}
    </li>
  );
}

function WaitingList({ reviews, projectId }: { reviews: Review[]; projectId: Id<"projects"> }) {
  const now = useNow();
  const open = reviews.filter((review) => review.expiresAt > now);
  if (open.length === 0) {
    return <p className="text-sm text-home-ink-2">{WAITING_EMPTY_COPY}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {open.map((review) => (
        <Row key={review.approvalId} review={review} now={now} projectId={projectId} />
      ))}
    </ul>
  );
}

function Live({ projectId }: { projectId: Id<"projects"> }) {
  const reviews = useQuery(api.workspace.reviews.pendingReviews, { projectId });
  if (reviews === undefined) return <LoadingState label="Loading your reviews…" />;
  return <WaitingList reviews={reviews} projectId={projectId} />;
}

export function WaitingOnYou({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <section aria-labelledby="waiting-on-you" className="flex flex-col gap-3">
      <h2 id="waiting-on-you" className="text-lg font-medium text-home-ink">Waiting on you</h2>
      <QuietErrorBoundary fallback={<ErrorState message={WAITING_ERROR_COPY} />}>
        <Live projectId={projectId} />
      </QuietErrorBoundary>
    </section>
  );
}
