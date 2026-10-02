"use client";

import { useState, type ReactNode, type RefObject } from "react";

import { getRevisionAction } from "@/app/admin/editorial/_actions/draft";
import { restoreIdeaAction, trashIdeaAction, unpublishIdeaAction } from "@/app/admin/editorial/_actions/release";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import type { IdeaDetail, RevisionView } from "@/lib/editorial/contracts/views";
import { ReasonDialog } from "../common/ReasonDialog";
import type { StrongAuthContext } from "../common/StrongAuthStep";
import { buttonClass } from "../common/primitives";
import { liveReleaseOf } from "./ReleasePanel";
import type { MenuAction } from "./WorkspaceTitleBar";
import { useRefreshWithFocus } from "./useRefreshWithFocus";

export const UNPUBLISH_SURFACES = [
  "the idea page itself",
  "idea lists, category hubs and search",
  "homepage picks and the idea of the week",
  "the sitemap and structured data",
  "public APIs and prompt exports",
] as const;

async function outcome<T>(call: Promise<CommandResult<T>>): Promise<string | null> {
  const result = await call.catch(() => null);
  if (!result) return "The server could not be reached. Nothing changed; try again.";
  return result.ok ? null : result.error.message;
}

/**
 * Unpublish, trash and restore for the workspace's More actions menu. Trash
 * is refused for live ideas (unpublish first); restore returns an idea
 * unpublished and awaiting review, never straight to live. Trash and restore
 * change what may be edited, so the editor restarts in place from the
 * server's view of the revision.
 */
export function useLifecycleControls({
  detail,
  view,
  unsaved,
  moreRef,
  onAnnounce,
  onRestart,
  strongAuth,
}: {
  detail: IdeaDetail;
  view: RevisionView;
  /** Unpublish and trash need a recent sign-in confirmation. */
  strongAuth: StrongAuthContext;
  /** Trash restarts the editor, so it waits until the editor is saved. */
  unsaved: boolean;
  moreRef: RefObject<HTMLButtonElement | null>;
  onAnnounce(message: string): void;
  onRestart(view: RevisionView): void;
}): { menuActions: MenuAction[]; dialogs: ReactNode; primaryAction: ReactNode } {
  const refresh = useRefreshWithFocus();
  const [open, setOpen] = useState<"unpublish" | "trash" | null>(null);
  const idea = detail.idea;
  const trashed = idea.lifecycle === "trashed";
  const live = idea.publication === "live";
  const liveRelease = liveReleaseOf(detail);
  const unpublishPending = idea.pendingOperation?.operation === "unpublish";
  const returnFocus = (event: Event) => {
    event.preventDefault();
    moreRef.current?.focus();
  };

  /** Reload this revision's view after a lifecycle change and restart the editor from it. */
  const restart = async (message: string, focusSelector: string) => {
    const fresh = await getRevisionAction({ ideaId: view.ideaId, revisionId: view.id }).catch(() => null);
    if (fresh?.ok) onRestart(fresh.value);
    onAnnounce(message);
    refresh(focusSelector);
  };

  const menuActions: MenuAction[] = [];
  if (live && liveRelease && !unpublishPending) {
    menuActions.push({ key: "unpublish", label: "Unpublish…", destructive: true, onSelect: () => setOpen("unpublish") });
  }
  if (!trashed) {
    menuActions.push(
      live
        ? { key: "trash", label: "Move to Trash (unpublish first)", disabled: true, onSelect: () => undefined }
        : unsaved
          ? { key: "trash", label: "Move to Trash (save first)", disabled: true, onSelect: () => undefined }
          : { key: "trash", label: "Move to Trash…", destructive: true, onSelect: () => setOpen("trash") },
    );
  }

  const dialogs = (
    <>
      {liveRelease ? (
        <ReasonDialog
          open={open === "unpublish"}
          onOpenChange={(next) => setOpen(next ? "unpublish" : null)}
          onCloseAutoFocus={returnFocus}
          title={`Unpublish ${idea.title}?`}
          description="Removal is staged and verified. The idea shows as pending until every surface confirms it is gone. Unpublishing is always available, even when checks fail."
          label="Reason"
          maxLength={EDITORIAL_LIMITS.reasonChars}
          confirmLabel="Unpublish (simulated)"
          tone="danger"
          strongAuth={strongAuth}
          onConfirm={async (reason) => {
            const failure = await outcome(
              unpublishIdeaAction({ ideaId: idea.id, expectedLiveReleaseId: liveRelease.id, reason, idempotencyKey: crypto.randomUUID() }),
            );
            if (!failure) {
              onAnnounce("Unpublish requested. Removal is pending verification (simulated).");
              refresh("#workspace-heading");
            }
            return failure;
          }}
        >
          <div className="rounded-md border border-(--ed-border) px-3 py-2 text-sm">
            <p className="font-medium">Removed from:</p>
            <ul className="mt-1 list-disc pl-5">
              {UNPUBLISH_SURFACES.map((surface) => (
                <li key={surface}>{surface}</li>
              ))}
            </ul>
            <p className="mt-2 text-(--ed-text-2)">
              Readers who saved it see “Idea unavailable”. Private editorial history is kept. In the local demo nothing public changes.
            </p>
          </div>
        </ReasonDialog>
      ) : null}
      {!trashed && !live ? (
        <ReasonDialog
          open={open === "trash"}
          onOpenChange={(next) => setOpen(next ? "trash" : null)}
          onCloseAutoFocus={returnFocus}
          title={`Move ${idea.title} to Trash?`}
          description="Trash hides the idea from ordinary lists. It stays recoverable; nothing is deleted."
          label="Reason"
          maxLength={EDITORIAL_LIMITS.reasonChars}
          confirmLabel="Move to Trash"
          tone="danger"
          strongAuth={strongAuth}
          onConfirm={async (reason) => {
            const failure = await outcome(trashIdeaAction({ ideaId: idea.id, expectedVersion: idea.version, reason }));
            if (!failure) await restart("Moved to Trash. Restore it to edit or review.", "#restore-idea");
            return failure;
          }}
        />
      ) : null}
    </>
  );

  const primaryAction = trashed ? (
    <ReasonDialog
      title={`Restore ${idea.title}?`}
      description="It returns unpublished and awaiting review, never straight to live."
      label="Reason"
      maxLength={EDITORIAL_LIMITS.reasonChars}
      confirmLabel="Restore"
      trigger={
        <button id="restore-idea" type="button" className={buttonClass.primary}>
          Restore…
        </button>
      }
      onConfirm={async (reason) => {
        const failure = await outcome(restoreIdeaAction({ ideaId: idea.id, expectedVersion: idea.version, reason }));
        if (!failure) await restart("Restored. The idea is unpublished and awaiting review.", "#workspace-heading");
        return failure;
      }}
    />
  ) : null;

  return { menuActions, dialogs, primaryAction };
}
