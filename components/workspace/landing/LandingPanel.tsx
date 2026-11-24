"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { BTN_PRIMARY, CARD, FOCUS } from "@/components/workspace/kit/styles";
import { LiveArtifactReview } from "@/components/workspace/review/LiveArtifactReview";
import { workspacePath } from "@/lib/workspace/routes";
import { cn } from "@/lib/utils";

const LANDING_REVIEW = {
  plural: "landing page details",
  approvedNote: "Your approval is saved for this private preview.",
  readFrom: "above",
  piece: "landing_spec",
} as const;

const BLOCKED = {
  blueprint: "Approve the blueprint in Team HQ so Leo can use it.",
  brand_kit: "Approve the Brand Kit so Leo can use Iris’s direction.",
  roster: "Leo has no landing assignment for this business.",
  conflict: "The current work needs a decision before Leo can start. Check Team HQ.",
} as const;

function LandingContent({ projectId }: { projectId: Id<"projects"> }) {
  const status = useQuery(api.crew.launch.privateLandingStatus, { projectId });
  const preview = useQuery(api.growth.drafts.landing.privateLandingPreview, { projectId });
  const start = useMutation(api.crew.launch.startPrivateLanding);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [needsSpend, setNeedsSpend] = useState(false);
  const inFlight = useRef(false);
  const team = workspacePath(projectId, "team");

  if (!status || preview === undefined) return <LoadingState label="Loading Leo’s work…" />;

  const busy = status.state === "queued" || status.state === "working";
  const blockedOn = status.blockedOn;
  const description = blockedOn ? BLOCKED[blockedOn]
    : status.state === "not_started" ? "Leo will use your approved blueprint and Brand Kit. Iris contributes the design direction before Leo drafts the page."
    : status.state === "queued" ? "Leo’s draft is queued."
    : status.state === "working" ? status.failure ?? (status.irisAnswer ? "Leo is using Iris’s reply to draft the page." : "Leo is waiting for Iris’s design direction.")
    : status.state === "failed" ? status.failure ?? "Leo’s draft did not finish. You can retry it."
    : "Leo saved a private landing page for your review.";
  const canStart = (status.state === "not_started" || status.state === "failed") && !blockedOn;

  async function requestDraft() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setMessage("");
    setNeedsSpend(false);
    try {
      const result = await start({ projectId });
      if (result.state === "blocked") setMessage(BLOCKED[result.reason]);
      else if (result.state === "spend_required") {
        setNeedsSpend(true);
        setMessage("This rewrite needs a spending approval in Team HQ.");
      }
    } catch {
      setMessage("Leo’s task could not start. Check Team HQ or try again.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="leo-work-heading" className={cn(CARD, "space-y-3 px-5 py-5")}>
        <h2 id="leo-work-heading" className="font-editorial text-2xl text-home-ink">Leo’s work</h2>
        <p className="max-w-[65ch] text-home-ink-2" aria-live="polite">{description}</p>
        {canStart ? (
          <button type="button" className={BTN_PRIMARY} aria-disabled={sending} onClick={() => void requestDraft()}>
            {sending ? "Starting…" : status.state === "failed" ? "Retry Leo’s draft" : "Ask Leo to draft"}
          </button>
        ) : null}
        {blockedOn === "blueprint" ? <Link href={`${team}#blueprint`} className={cn("inline-block underline", FOCUS)}>Review the blueprint</Link> : null}
        {blockedOn === "brand_kit" ? <Link href={workspacePath(projectId, "brand")} className={cn("inline-block underline", FOCUS)}>Review the Brand Kit</Link> : null}
        {message ? <p role="status" className="text-sm text-home-ink-2">{message}</p> : null}
        {needsSpend ? <Link href={team} className={cn("inline-block underline", FOCUS)}>Open Team HQ</Link> : null}
        {status.state !== "not_started" ? (
          <details className="border-t border-home-rule pt-3" open={status.state === "ready"}>
            <summary className={cn("cursor-pointer font-semibold text-home-ink", FOCUS)}>Iris’s handoff</summary>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm text-home-ink-2">
              <dt className="font-medium text-home-ink">Leo asked</dt>
              <dd>{status.irisQuestion}</dd>
              <dt className="mt-2 font-medium text-home-ink">Iris replied</dt>
              <dd className="whitespace-pre-wrap">{status.irisAnswer ?? "Waiting for Iris."}</dd>
            </dl>
          </details>
        ) : null}
      </section>
      {preview.state === "ready" ? (
        <section aria-labelledby="landing-draft-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="landing-draft-heading" className="font-editorial text-2xl text-home-ink">Private preview</h2>
              <p className="mt-1 text-sm text-home-ink-2">
                Draft {preview.version.toString()} · {preview.testLeadCount} test {preview.testLeadCount === 1 ? "entry" : "entries"}
              </p>
            </div>
            <Link href={workspacePath(projectId, "landing-preview")} className={BTN_PRIMARY}>Open preview</Link>
          </div>
          {preview.card && !busy ? <LiveArtifactReview projectId={projectId} card={preview.card} artifact={LANDING_REVIEW} approveLabel="Approve private draft" /> : null}
        </section>
      ) : preview.state === "unavailable" ? (
        <p role="status" className="text-home-ink-2">The saved preview is unavailable. Check Leo’s task in Team HQ.</p>
      ) : null}
    </div>
  );
}

export function LandingPanel({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <QuietErrorBoundary fallback={<ErrorState message="Leo’s work is unavailable. Reload this page to check the latest draft." />}>
      <WhenConvexReady fallback={<LoadingState label="Loading Leo’s work…" />}>
        <LandingContent projectId={projectId} />
      </WhenConvexReady>
    </QuietErrorBoundary>
  );
}
