"use client";

import { GitCompareArrows } from "lucide-react";

import type { DraftConflict } from "@/lib/editorial/contracts/errors";
import { formatAbsolute } from "@/lib/editorial/presentation/format";
import { buttonClass } from "../common/primitives";

/**
 * A save met a newer server copy. Nothing is merged or discarded silently:
 * compare, then keep this editor's text, take the server copy, or (when the
 * draft can no longer be edited) carry this text into a new revision.
 */
export function ConflictPanel({
  conflict,
  busy,
  error,
  onCompare,
  onKeepMine,
  onUseTheirs,
  onForkWithMine,
  onDiscardMine,
}: {
  conflict: DraftConflict;
  busy: boolean;
  error: string | null;
  onCompare(): void;
  onKeepMine(): void;
  onUseTheirs(): void;
  onForkWithMine(): void;
  onDiscardMine(): void;
}) {
  return (
    <section
      id="conflict-panel"
      tabIndex={-1}
      aria-labelledby="conflict-heading"
      className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-(--ed-danger) bg-(--ed-danger-bg) px-4 py-3 text-(--ed-danger) outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) sm:mx-6"
    >
      <h2 id="conflict-heading" className="flex items-center gap-2 font-semibold">
        <GitCompareArrows aria-hidden="true" className="size-4" />
        {conflict.frozen ? "This draft can no longer be edited" : "A newer version was saved elsewhere"}
      </h2>
      <p className="text-sm text-(--ed-text)">
        {conflict.frozen
          ? `It was approved, discarded or replaced in another session (${formatAbsolute(conflict.savedAt)}, ${conflict.savedBy}). Your text is still here and has not been saved.`
          : `${conflict.savedBy} saved version ${conflict.latestVersion} at ${formatAbsolute(conflict.savedAt)}. Your text is still here and has not been saved.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.secondary} onClick={onCompare} disabled={busy}>
          Compare with the newer copy
        </button>
        {conflict.frozen ? (
          <>
            <button type="button" className={buttonClass.primary} onClick={onForkWithMine} disabled={busy}>
              Save my text as a new revision
            </button>
            <button type="button" className={buttonClass.secondary} onClick={onDiscardMine} disabled={busy}>
              Discard my text and reload
            </button>
          </>
        ) : (
          <>
            <button type="button" className={buttonClass.primary} onClick={onKeepMine} disabled={busy}>
              Keep mine
            </button>
            <button type="button" className={buttonClass.secondary} onClick={onUseTheirs} disabled={busy}>
              Use theirs
            </button>
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
