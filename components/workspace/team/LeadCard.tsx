"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { EmployeeAvatar } from "@/components/workspace/kit/EmployeeAvatar";
import { StatusPill } from "@/components/workspace/kit/StatusPill";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW } from "@/components/workspace/kit/styles";
import { ROLE_LABELS } from "@/components/workspace/kit/types";
import { cn } from "@/lib/utils";
import type { LaunchView } from "@/lib/workspace/crew/launch";
import {
  BLUEPRINT_MISSING_COPY,
  BLUEPRINT_SECTION_ID,
  changeRoundNote,
  expiresInWords,
  RETRY_SENT_TEAM_COPY,
  retryMessage,
  WAITING_EMPTY_COPY,
} from "@/lib/workspace/reviewPages";
import {
  launchErrorMessage,
  REVIEW_OWNER,
  teamFailureCopy,
  teamStageAnnouncement,
  teamStageView,
  type TeamHired,
} from "@/lib/workspace/teamHq";

export type PendingReview = FunctionReturnType<typeof api.workspace.reviews.pendingReviews>[number];

/**
 * The Crew Lead card on Team HQ: who the lead is, the reviews it is routing
 * (one Review link per row; decisions are made on the review card itself,
 * where a change request needs a note), and, while the team is not written,
 * the team-stage state with Try again (`retryLaunch`, as in the wizard).
 * The Wren chat is the right-hand column of the workspace, so this card only
 * points at it.
 */

const REVIEW_LINK = cn(BTN_PRIMARY, "shrink-0");

function BlueprintLinkChecked({ projectId, title }: { projectId: Id<"projects">; title: string }) {
  const view = useQuery(api.growth.drafts.blueprint.blueprintDraft, { projectId });
  if (view !== undefined && view.state !== "ready") {
    return <p className="max-w-[16rem] text-[13px] text-home-ink-2">{BLUEPRINT_MISSING_COPY}</p>;
  }
  return (
    <a href={`#${BLUEPRINT_SECTION_ID}`} className={REVIEW_LINK}>
      Review<span className="sr-only"> {title}</span>
    </a>
  );
}

/** The blueprint is reviewed on this page; if it cannot be shown there is nothing to jump to, so say so. */
function BlueprintLink({ projectId, title }: { projectId: Id<"projects">; title: string }) {
  return (
    <QuietErrorBoundary fallback={<p className="max-w-[16rem] text-[13px] text-home-ink-2">{BLUEPRINT_MISSING_COPY}</p>}>
      <BlueprintLinkChecked projectId={projectId} title={title} />
    </QuietErrorBoundary>
  );
}

function ReviewRow({
  review,
  now,
  projectId,
  roster,
}: {
  review: PendingReview;
  now: number;
  projectId: Id<"projects">;
  roster: readonly TeamHired[];
}) {
  const owner = REVIEW_OWNER[review.kind];
  const hired = roster.find((entry) => entry.role === owner);
  const ownerName = hired?.name ?? ROLE_LABELS[owner];
  const round = changeRoundNote(Number(review.changeRound));
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-home-sunk px-3 py-2.5 last:border-b-0">
      <span aria-hidden="true">
        <EmployeeAvatar name={ownerName} role={owner} size="md" />
      </span>
      <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
        <span className="font-mono text-[11px] tracking-[0.06em] text-home-ink-3">
          From {ROLE_LABELS[owner]} · {ownerName}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-home-ink">{review.title}</span>
          <StatusPill set="output" status="ready" label={round ?? "Waiting on you"} />
        </span>
        <span className="text-[13px] text-home-ink-3">Closes {expiresInWords(review.expiresAt, now)}.</span>
      </span>
      {review.kind === "blueprint" ? (
        <BlueprintLink projectId={projectId} title={review.title} />
      ) : (
        <Link href={review.href} className={REVIEW_LINK}>
          Review<span className="sr-only"> {review.title}</span>
        </Link>
      )}
    </li>
  );
}

function leadPill(launch: LaunchView, reviewCount: number): { status: "working" | "done" | "failed"; label: string } {
  if (launch.state === "failed") return { status: "failed", label: "Couldn't put your team together" };
  if (launch.state !== "ready") return { status: "working", label: "Working · Putting your team together" };
  if (reviewCount > 0) {
    return { status: "working", label: `Working · Routing ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` };
  }
  return { status: "done", label: "All reviews routed" };
}

export function LeadCard({
  projectId,
  launch,
  lead,
  roster,
  reviews,
  now,
}: {
  projectId: Id<"projects">;
  launch: LaunchView;
  lead: string;
  roster: readonly TeamHired[];
  /** Open (unexpired) reviews only. */
  reviews: readonly PendingReview[];
  now: number;
}) {
  const retryLaunch = useMutation(api.crew.roster.retryLaunch);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState("");
  const [refusal, setRefusal] = useState<{ message: string; during: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingWhenGone = useRef(false);
  const failureId = useId();
  const stateKey = launch.state === "failed" ? `failed:${launch.paused}:${launch.retryable}` : launch.state;
  // A refusal is shown only while the launch is still in the state it happened in.
  const error = refusal !== null && refusal.during === stateKey ? refusal.message : null;
  const view = teamStageView(launch);
  const hasButton = view === "failed";

  useEffect(() => {
    if (hasButton || !focusHeadingWhenGone.current) return;
    focusHeadingWhenGone.current = false;
    // Only when the click left focus nowhere (the button unmounted); never take focus the founder moved.
    const active = document.activeElement;
    if (active === null || active === document.body) headingRef.current?.focus();
  }, [hasButton]);

  const retry = () => {
    if (retrying) return;
    const during = stateKey;
    focusHeadingWhenGone.current = true;
    setRetrying(true);
    setRefusal(null);
    setMessage("");
    retryLaunch({ projectId })
      .then((result) => setMessage(retryMessage(result, RETRY_SENT_TEAM_COPY)))
      .catch((caught: unknown) => setRefusal({ message: launchErrorMessage(caught), during }))
      .finally(() => setRetrying(false));
  };

  const pill = leadPill(launch, reviews.length);
  return (
    <section
      aria-labelledby="lead-h"
      className="flex flex-wrap gap-x-7 gap-y-5 rounded-xl border border-home-ink bg-home-card px-5 py-[18px]"
    >
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <span aria-hidden="true">
            <EmployeeAvatar name={lead} role="lead" size="lg" showAiBadge />
          </span>
          <div className="min-w-0">
            <p className={EYEBROW}>Crew Lead · runs the team</p>
            <h2
              id="lead-h"
              ref={headingRef}
              tabIndex={-1}
              className="font-editorial text-[22px] font-normal leading-tight text-home-ink focus:outline-2 focus:outline-offset-2 focus:outline-home-orange-ink"
            >
              {lead} <em className="italic">routes every approval.</em>
            </h2>
          </div>
        </div>
        <p className="text-sm text-home-ink-2">
          Sets the order, routes approvals and brings you one decision at a time. Specialists never message you directly:
          their work reaches you as review cards from {lead}.
        </p>
        <div>
          <StatusPill set="employee" status={pill.status} label={pill.label} />
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-home-sunk px-3 py-2.5 text-[13px] text-home-ink-2">
          <MessageSquare aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold text-home-ink">Chat stays with {lead}.</strong> The chat on the right is{" "}
            {lead} only: ask anything there and {lead} brings in the right specialist.
          </span>
        </p>
        <p role="status" aria-live="polite" className="sr-only">
          {teamStageAnnouncement(launch, lead)}
        </p>
        {launch.state === "failed" ? (
          <div data-state={view} className="flex flex-col items-start gap-2">
            <p id={failureId} className="text-sm text-home-ink-2">{teamFailureCopy(launch, lead)}</p>
            {hasButton ? (
              <button
                type="button"
                className={BTN_SECONDARY}
                aria-label={retrying ? "Trying again to put your team together" : "Try again: put your team together"}
                aria-describedby={failureId}
                aria-disabled={retrying || undefined}
                onClick={retry}
              >
                {retrying ? "Trying again…" : "Try again"}
              </button>
            ) : null}
          </div>
        ) : null}
        <p role="status" aria-live="polite" className="text-[13px] text-home-ink-2">{message}</p>
        {error === null ? null : (
          <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-3 py-2 text-sm text-home-clay-ink">
            {error}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-[2_1_360px] flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="appr-h" className="text-[15px] font-semibold text-home-ink">Reviews {lead} is routing</h3>
          <span className="font-mono text-xs text-home-ink-3">{reviews.length} waiting</span>
        </div>
        {reviews.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-home-d2 px-3 py-4 text-sm text-home-ink-2">
            {WAITING_EMPTY_COPY}
          </p>
        ) : (
          <ul aria-labelledby="appr-h" className="rounded-[10px] border border-home-rule">
            {reviews.map((review) => (
              <ReviewRow key={review.approvalId} review={review} now={now} projectId={projectId} roster={roster} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
