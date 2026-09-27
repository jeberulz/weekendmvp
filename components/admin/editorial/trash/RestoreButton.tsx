"use client";

import { useRouter } from "next/navigation";

import { restoreIdeaAction } from "@/app/admin/editorial/_actions/release";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { ReasonDialog } from "../common/ReasonDialog";
import { smallButtonClass } from "../workspace/ui";

/** Restore from Trash: unpublished and awaiting review, never straight to live. */
export function RestoreButton({ ideaId, title, version }: { ideaId: string; title: string; version: number }) {
  const router = useRouter();
  return (
    <ReasonDialog
      title={`Restore ${title}?`}
      description="It returns unpublished and awaiting review, never straight to live."
      label="Reason"
      maxLength={EDITORIAL_LIMITS.reasonChars}
      confirmLabel="Restore"
      trigger={
        <button type="button" className={smallButtonClass}>
          Restore…<span className="sr-only"> {title}</span>
        </button>
      }
      onConfirm={async (reason) => {
        const result = await restoreIdeaAction({ ideaId, expectedVersion: version, reason }).catch(() => null);
        if (!result) return "The server could not be reached. Nothing changed; try again.";
        if (!result.ok) return result.error.message;
        router.refresh();
        return null;
      }}
    />
  );
}
