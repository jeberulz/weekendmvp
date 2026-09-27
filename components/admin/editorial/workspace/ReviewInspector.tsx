"use client";

import { useCallback } from "react";

import { getRevisionAction } from "@/app/admin/editorial/_actions/draft";
import {
  cancelReleaseAction,
  prepareReleaseAction,
  publishReleaseAction,
  reconcileReleaseAction,
  requestRollbackAction,
  retryReleaseAction,
} from "@/app/admin/editorial/_actions/release";
import {
  addNoteAction,
  approveRevisionAction,
  decideCandidateAction,
  flagReviewItemAction,
  markReviewedAction,
  requestChangesAction,
  resumeReviewAction,
  retractReviewAction,
} from "@/app/admin/editorial/_actions/review";
import type { CandidateDecisionInput, FlagInput } from "@/lib/editorial/contracts/commands";
import type { CommandResult, EditorialTarget } from "@/lib/editorial/contracts/errors";
import type { IdeaDetail, ReleaseView, ReviewItemView, RevisionView } from "@/lib/editorial/contracts/views";
import { DecisionPanel } from "./DecisionPanel";
import { ReleasePanel, liveReleaseOf, type PublishingContext } from "./ReleasePanel";
import { ApprovalControls, ReviewItemControls } from "./ReviewControls";
import { ReviewPanel } from "./ReviewPanel";
import { useRefreshWithFocus } from "./useRefreshWithFocus";

const NOTE_TARGETS = new Set(["section", "claim", "source", "metadata"]);

function newKey(): string {
  return crypto.randomUUID();
}

/** Run a command; resolve with a readable error or null. */
async function attempt<T>(call: Promise<CommandResult<T>>, onOk: (value: T) => void): Promise<string | null> {
  const result = await call.catch(() => null);
  if (!result) return "The server could not be reached. Nothing changed; try again.";
  if (!result.ok) return result.error.message;
  onOk(result.value);
  return null;
}

/**
 * The Review inspector: decision, per-item attestation, approval and
 * release. Commands that change the revision return its fresh view;
 * idea-level changes refresh the page data, which never remounts the editor.
 */
export function ReviewInspector({
  detail,
  view,
  onView,
  disabledReason,
  liveMarkdown,
  publishing,
  baseHref,
  nowMs,
  onGoTo,
  onAnnounce,
  onRestart,
}: {
  detail: IdeaDetail;
  view: RevisionView;
  onView(view: RevisionView): void;
  /** Restart the editor from a server view (after approval froze the draft). */
  onRestart(view: RevisionView): void;
  /** Why review commands are unavailable right now (unsaved text, not the working revision, trash). */
  disabledReason: string | null;
  liveMarkdown: string | null;
  publishing: PublishingContext;
  baseHref: string;
  nowMs: number;
  onGoTo(target: EditorialTarget): void;
  onAnnounce(message: string): void;
}) {
  const ids = { ideaId: view.ideaId, revisionId: view.id };

  // Refreshes run in a transition; focus then moves to the section whose
  // controls changed, so it is never dropped when a pressed button goes away.
  const refresh = useRefreshWithFocus();

  const withView = useCallback(
    (message: string, focusSelector: string | null = null) =>
      (value: { view: RevisionView }) => {
        onView(value.view);
        onAnnounce(message);
        if (focusSelector) refresh(focusSelector);
      },
    [onView, onAnnounce, refresh],
  );
  const refreshed = useCallback(
    (message: string) => () => {
      onAnnounce(message);
      refresh("#release");
    },
    [onAnnounce, refresh],
  );

  const decide = (input: CandidateDecisionInput) =>
    attempt(
      decideCandidateAction({ ...ids, expectedVersion: detail.idea.version, input }),
      withView("Decision recorded.", "#decision-panel"),
    );
  const mark = (item: ReviewItemView) =>
    attempt(
      markReviewedAction({ ...ids, itemId: item.id, dependencyHash: item.dependencyHash, note: null }),
      withView(`Marked reviewed: ${item.label}.`),
    );
  const retract = (item: ReviewItemView) =>
    attempt(retractReviewAction({ ...ids, itemId: item.id }), withView(`Review retracted: ${item.label}.`));
  const flag = (item: ReviewItemView, input: FlagInput) =>
    attempt(flagReviewItemAction({ ...ids, itemId: item.id, dependencyHash: item.dependencyHash, input }), (value) => {
      withView(`Flagged: ${item.label}.`)(value);
      // The Flag button goes away once flagged; keep focus on the item.
      window.requestAnimationFrame(() => document.getElementById(`review-item-${item.id}`)?.focus());
    });
  const note = (target: EditorialTarget, text: string) =>
    attempt(
      addNoteAction({ ...ids, target: { kind: target.kind as "section" | "claim" | "source" | "metadata", id: target.id }, note: text }),
      withView("Note added."),
    );

  const liveRelease = liveReleaseOf(detail);

  return (
    <div className="flex flex-col gap-4">
      <ReviewPanel
        view={view}
        onGoTo={onGoTo}
        decision={
          <DecisionPanel
            idea={detail.idea}
            disabledReason={detail.idea.lifecycle === "trashed" ? "Restore the idea to change the decision." : null}
            onDecide={decide}
          />
        }
        itemActions={(item) => (
          <ReviewItemControls
            item={item}
            disabled={disabledReason !== null}
            onMark={() => mark(item)}
            onRetract={() => retract(item)}
            onFlag={(input) => flag(item, input)}
            onNote={item.target && NOTE_TARGETS.has(item.target.kind) ? (text) => note(item.target as EditorialTarget, text) : null}
          />
        )}
        approval={
          <>
            {disabledReason ? <p className="text-xs text-(--ed-text-2)">Review is unavailable: {disabledReason}</p> : null}
            <ApprovalControls
              view={view}
              disabledReason={disabledReason}
              onRequestChanges={(text) =>
                attempt(requestChangesAction({ ...ids, note: text }), withView("Changes requested.", "#review-checklist"))
              }
              onResume={() => attempt(resumeReviewAction(ids), withView("Review resumed.", "#review-checklist"))}
              onApprove={(text) =>
                attempt(
                  approveRevisionAction({ ...ids, artifactHash: view.hashes.artifact, input: { attest: true, note: text } }),
                  (value) => {
                    // The draft is now a frozen, approved snapshot: restart the editor from it.
                    onRestart(value.view);
                    onAnnounce(`Revision v${view.number} approved. Prepare a release when you are ready.`);
                    refresh("#release");
                  },
                )
              }
            />
          </>
        }
        release={
          <ReleasePanel
            detail={detail}
            view={view}
            liveMarkdown={liveMarkdown}
            nowMs={nowMs}
            publishing={publishing}
            baseHref={baseHref}
            onPrepare={(revisionId) =>
              attempt(
                prepareReleaseAction({ revisionId, expectedLiveReleaseId: liveRelease?.id ?? null, idempotencyKey: newKey() }),
                refreshed("Preparing the preview (simulated)."),
              )
            }
            onPublish={(release: ReleaseView) =>
              release.approvalId
                ? attempt(
                    publishReleaseAction({
                      releaseId: release.id,
                      expectedState: release.state,
                      approvalId: release.approvalId,
                      idempotencyKey: newKey(),
                    }),
                    refreshed(`Release of v${release.revisionNumber} requested (simulated).`),
                  )
                : Promise.resolve("This release has no approval to publish.")
            }
            onCancel={({ release, reason }) =>
              attempt(cancelReleaseAction({ releaseId: release.id, expectedState: release.state, reason }), refreshed("Release cancelled."))
            }
            onRetry={(release) =>
              attempt(
                retryReleaseAction({ releaseId: release.id, expectedState: release.state, idempotencyKey: newKey() }),
                refreshed("Release retried (simulated)."),
              )
            }
            onReconcile={(release) => attempt(reconcileReleaseAction({ releaseId: release.id }), refreshed("Release reconciled."))}
            onRollback={({ target, reason }) =>
              liveRelease
                ? attempt(
                    requestRollbackAction({
                      ideaId: view.ideaId,
                      targetReleaseId: target.id,
                      expectedLiveReleaseId: liveRelease.id,
                      reason,
                      idempotencyKey: newKey(),
                    }),
                    refreshed(`Rollback to v${target.revisionNumber} requested (simulated).`),
                  )
                : Promise.resolve("Nothing is live to roll back.")
            }
            onLoadRevision={async (revisionId) => {
              const result = await getRevisionAction({ ideaId: view.ideaId, revisionId }).catch(() => null);
              if (!result) return "The server could not be reached.";
              return result.ok ? result.value : result.error.message;
            }}
          />
        }
      />
    </div>
  );
}
