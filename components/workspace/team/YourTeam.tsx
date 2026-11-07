"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { EmptyState, LoadingState } from "@/components/workspace/kit/states";
import { CofounderTeam, launchErrorMessage } from "@/components/workspace/wizard/MeetCofounder";
import {
  RETRY_SENT_TEAM_COPY,
  retryMessage,
  TEAM_NOT_STARTED_COPY,
  TEAM_PARTNER_NAME,
  TEAM_UNAVAILABLE_COPY,
} from "@/lib/workspace/reviewPages";

/**
 * L1-C6: the hired crew on Team HQ, from `launchStatus`, using the wizard's
 * `CofounderTeam` (same wording and behaviour) at heading level 2. Team HQ
 * never starts a launch: "not started" says so instead of "putting your team
 * together". Try again is `retryLaunch`, as in the wizard.
 */

function Live({ projectId }: { projectId: Id<"projects"> }) {
  const launch = useQuery(api.crew.roster.launchStatus, { projectId });
  const retryLaunch = useMutation(api.crew.roster.retryLaunch);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState("");
  const [refusal, setRefusal] = useState<{ message: string; during: string } | null>(null);
  const stateKey = launch === undefined ? "loading" : launch.state === "failed" ? `failed:${launch.paused}:${launch.retryable}` : launch.state;
  // A refusal is shown only while the launch is still in the state it happened in.
  const error = refusal !== null && refusal.during === stateKey ? refusal.message : null;

  if (launch === undefined) {
    return (
      <section aria-labelledby="team-loading" className="flex flex-col gap-3">
        <h2 id="team-loading" className="text-lg font-medium text-home-ink">Your team</h2>
        <LoadingState label="Loading your team…" />
      </section>
    );
  }
  if (launch.state === "not_started") {
    return (
      <section aria-labelledby="team-not-started" className="flex flex-col gap-3">
        <h2 id="team-not-started" className="text-lg font-medium text-home-ink">Your team</h2>
        <EmptyState>{TEAM_NOT_STARTED_COPY}</EmptyState>
      </section>
    );
  }
  const retry = () => {
    const during = stateKey;
    setRetrying(true);
    setRefusal(null);
    setMessage("");
    retryLaunch({ projectId })
      .then((view) => setMessage(retryMessage(view, RETRY_SENT_TEAM_COPY)))
      .catch((caught: unknown) => setRefusal({ message: launchErrorMessage(caught), during }))
      .finally(() => setRetrying(false));
  };
  return (
    <div className="flex flex-col gap-2">
      <CofounderTeam
        level={2}
        partnerName={TEAM_PARTNER_NAME}
        launch={launch}
        retrying={retrying}
        error={error}
        onStart={retry}
        onRetry={retry}
      />
      <p role="status" aria-live="polite" className="text-[13px] text-home-ink-2">{message}</p>
    </div>
  );
}

export function YourTeam({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <QuietErrorBoundary
      fallback={
        <section aria-labelledby="team-unavailable" className="flex flex-col gap-3">
          <h2 id="team-unavailable" className="text-lg font-medium text-home-ink">Your team</h2>
          <EmptyState>{TEAM_UNAVAILABLE_COPY}</EmptyState>
        </section>
      }
    >
      <Live projectId={projectId} />
    </QuietErrorBoundary>
  );
}
