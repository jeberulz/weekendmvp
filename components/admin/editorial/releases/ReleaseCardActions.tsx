"use client";

import Link from "next/link";
import { useState } from "react";

import { cancelReleaseAction, reconcileReleaseAction, retryReleaseAction } from "@/app/admin/editorial/_actions/release";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import type { ReleaseView } from "@/lib/editorial/contracts/views";
import { ReasonDialog } from "../common/ReasonDialog";
import { StrongAuthStep, isReauthMessage } from "../common/StrongAuthStep";
import { buttonClass } from "../common/primitives";
import { EDITORIAL_BASE } from "../shell/nav-items";
import { smallButtonClass } from "../workspace/ui";
import { useRefreshWithFocus } from "../workspace/useRefreshWithFocus";

async function outcome<T>(call: Promise<CommandResult<T>>): Promise<string | null> {
  const result = await call.catch(() => null);
  if (!result) return "The server could not be reached. Try again.";
  return result.ok ? null : result.error.message;
}

/**
 * Recovery controls on the Releases screen, limited to what the release's
 * state allows. Publishing links to the workspace, where the full
 * confirmation (changes, checks, approval, re-authentication) lives.
 */
export function ReleaseCardActions({ release, authMechanism }: { release: ReleaseView; authMechanism: string }) {
  const refresh = useRefreshWithFocus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardSelector = `#release-card-${release.id}`;
  const run = async (call: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failure = await call();
    setBusy(false);
    if (failure) setError(failure);
    // The pressed button changes with the release state: keep focus on the card.
    else refresh(cardSelector);
  };
  const actions = release.availableActions;
  if (actions.length === 0) return null;
  return (
    <>
      {actions.includes("publish") && release.revisionId ? (
        <Link
          href={`${EDITORIAL_BASE}/ideas/${release.ideaId}?revision=${release.revisionId}&inspector=review`}
          className={buttonClass.primary}
        >
          Review and publish v{release.revisionNumber}
        </Link>
      ) : null}
      {actions.includes("retry") ? (
        <button
          type="button"
          className={smallButtonClass}
          aria-disabled={busy || undefined}
          onClick={() =>
            void run(() =>
              outcome(retryReleaseAction({ releaseId: release.id, expectedState: release.state, idempotencyKey: crypto.randomUUID() })),
            )
          }
        >
          Retry<span className="sr-only"> {release.ideaTitle}</span>
        </button>
      ) : null}
      {actions.includes("reconcile") ? (
        <button
          type="button"
          className={smallButtonClass}
          aria-disabled={busy || undefined}
          onClick={() => void run(() => outcome(reconcileReleaseAction({ releaseId: release.id })))}
        >
          Reconcile from probes<span className="sr-only"> for {release.ideaTitle}</span>
        </button>
      ) : null}
      {actions.includes("cancel") ? (
        <ReasonDialog
          title={`Cancel the release of ${release.ideaTitle}?`}
          description="The live page stays as it is. The release stays in history as cancelled."
          label="Reason"
          maxLength={EDITORIAL_LIMITS.reasonChars}
          confirmLabel="Cancel release"
          dismissLabel="Keep the release"
          tone="danger"
          trigger={
            <button type="button" className={smallButtonClass}>
              Cancel release…<span className="sr-only"> {release.ideaTitle}</span>
            </button>
          }
          onConfirm={async (reason) => {
            const failure = await outcome(cancelReleaseAction({ releaseId: release.id, expectedState: release.state, reason }));
            if (!failure) refresh(cardSelector);
            return failure;
          }}
        />
      ) : null}
      {error ? (
        <p role="alert" className="basis-full text-sm text-(--ed-danger)">
          {error}
        </p>
      ) : null}
      {isReauthMessage(error) ? (
        <div className="basis-full">
          <StrongAuthStep fresh={false} mechanism={authMechanism} onConfirmed={() => setError(null)} />
        </div>
      ) : null}
    </>
  );
}
