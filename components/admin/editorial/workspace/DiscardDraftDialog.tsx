"use client";

import { useState, type ComponentProps, type FormEvent } from "react";

import { DialogClose } from "@/components/ui/dialog";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { EditorialDialog } from "../common/EditorialDialog";
import { buttonClass, fieldClass } from "../common/primitives";

/** Discarding needs a reason and never touches live content or history. */
export function DiscardDraftDialog({
  open,
  onOpenChange,
  revisionNumber,
  hasUnsavedChanges,
  onConfirm,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  revisionNumber: number;
  hasUnsavedChanges: boolean;
  /** Resolves with an error message, or null once the draft is discarded. */
  onConfirm(reason: string): Promise<string | null>;
  onCloseAutoFocus?: ComponentProps<typeof EditorialDialog>["onCloseAutoFocus"];
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Give a reason for discarding.");
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await onConfirm(reason.trim());
    setBusy(false);
    if (failure) setError(failure);
  };

  return (
    <EditorialDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Discard draft v${revisionNumber}?`}
      description="The live page and earlier revisions stay exactly as they are. The draft stays in history, marked discarded."
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        {hasUnsavedChanges ? (
          <p className="rounded-md border border-(--ed-warning) bg-(--ed-warning-bg) px-3 py-2 text-sm text-(--ed-warning)">
            This editor has changes the server has not saved. They will be lost too.
          </p>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="discard-reason" className="text-sm font-medium">
            Reason (required)
          </label>
          <textarea
            id="discard-reason"
            rows={3}
            required
            maxLength={EDITORIAL_LIMITS.reasonChars}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "discard-error" : undefined}
            className={`${fieldClass} py-2`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {error ? (
          <p id="discard-error" role="alert" className="text-sm text-(--ed-danger)">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <button type="button" className={buttonClass.secondary}>
              Keep the draft
            </button>
          </DialogClose>
          <button type="submit" className={buttonClass.danger} disabled={busy}>
            {busy ? "Discarding…" : `Discard draft v${revisionNumber}`}
          </button>
        </div>
      </form>
    </EditorialDialog>
  );
}
