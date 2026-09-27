"use client";

import { useId, useState, type FormEvent } from "react";

import { DialogClose } from "@/components/ui/dialog";
import type { FlagInput } from "@/lib/editorial/contracts/commands";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import type { ReviewItemView, RevisionView } from "@/lib/editorial/contracts/views";
import { shortHash } from "@/lib/editorial/presentation/format";
import { EditorialDialog } from "../common/EditorialDialog";
import { ReasonDialog } from "../common/ReasonDialog";
import { buttonClass, fieldClass } from "../common/primitives";
import { smallButtonClass, textButtonClass } from "./ui";

/** Resolves with an error message, or null on success. */
type Command<T = void> = (input: T) => Promise<string | null>;

/**
 * Per-item attestation. Each click attests one item for the hash on screen;
 * there is no way to mark several at once.
 */
export function ReviewItemControls({
  item,
  disabled,
  onMark,
  onRetract,
  onFlag,
  onNote,
}: {
  item: ReviewItemView;
  disabled: boolean;
  onMark: Command;
  onRetract: Command;
  onFlag: Command<FlagInput>;
  onNote: Command<string> | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Busy is aria-disabled, not disabled: a disabled button loses keyboard focus.
  const run = async (command: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failure = await command();
    setBusy(false);
    setError(failure);
  };
  // One button element in both states, so focus stays put when it toggles.
  const reviewed = item.status === "reviewed";
  return (
    <>
      <button
        type="button"
        className={reviewed ? `${textButtonClass} text-xs` : smallButtonClass}
        disabled={disabled}
        aria-disabled={busy || undefined}
        onClick={() => void run(() => (reviewed ? onRetract() : onMark()))}
      >
        {busy ? "Saving…" : reviewed ? "Retract review" : item.status === "stale" ? "Review again" : "Mark reviewed"}
        <span className="sr-only">: {item.label}</span>
      </button>
      {!item.flag || item.flag.resolved ? <FlagDialog item={item} disabled={disabled} onFlag={onFlag} /> : null}
      {onNote ? (
        <ReasonDialog
          title="Add an editorial note"
          description={`Notes stay with the idea's history. About: ${item.label}`}
          label="Note"
          maxLength={EDITORIAL_LIMITS.noteChars}
          confirmLabel="Add note"
          trigger={
            <button type="button" className={`${textButtonClass} text-xs`} disabled={disabled}>
              Note…<span className="sr-only"> about {item.label}</span>
            </button>
          }
          onConfirm={onNote}
        />
      ) : null}
      {error ? (
        <p role="alert" className="basis-full text-xs text-(--ed-danger)">
          {error}
        </p>
      ) : null}
    </>
  );
}

function FlagDialog({ item, disabled, onFlag }: { item: ReviewItemView; disabled: boolean; onFlag: Command<FlagInput> }) {
  const name = useId();
  const [severity, setSeverity] = useState<FlagInput["severity"]>("high");
  return (
    <ReasonDialog
      title="Flag a discrepancy"
      description={`A high-severity flag blocks approval until it is resolved with a note. About: ${item.label}`}
      label="What is wrong"
      maxLength={EDITORIAL_LIMITS.noteChars}
      confirmLabel="Flag"
      tone="danger"
      onOpenChange={(open) => {
        if (!open) setSeverity("high");
      }}
      trigger={
        <button type="button" className={`${textButtonClass} text-xs`} disabled={disabled}>
          Flag…<span className="sr-only"> {item.label}</span>
        </button>
      }
      onConfirm={(note) => onFlag({ severity, note })}
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Severity</legend>
        {(["high", "low"] as const).map((value) => (
          <label key={value} className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              value={value}
              checked={severity === value}
              onChange={() => setSeverity(value)}
              className="size-4 accent-(--ed-text)"
            />
            {value === "high" ? "High — blocks approval until resolved" : "Low — a warning to resolve with a note"}
          </label>
        ))}
      </fieldset>
    </ReasonDialog>
  );
}

/** Request changes, resume review, and the explicit approval of one fixed revision. */
export function ApprovalControls({
  view,
  disabledReason,
  onRequestChanges,
  onResume,
  onApprove,
}: {
  view: RevisionView;
  disabledReason: string | null;
  onRequestChanges: Command<string>;
  onResume: Command;
  onApprove: Command<string | null>;
}) {
  const [resumeError, setResumeError] = useState<string | null>(null);
  const disabled = disabledReason !== null;
  if (view.reviewState === "approved") return null;
  return (
    <div className="flex flex-col gap-2 border-t border-(--ed-border) pt-3">
      {disabledReason ? <p className="text-xs text-(--ed-text-2)">{disabledReason}</p> : null}
      <div className="flex flex-wrap gap-2">
        {view.reviewState === "changes_requested" ? (
          <button
            type="button"
            className={smallButtonClass}
            disabled={disabled}
            onClick={async () => setResumeError(await onResume())}
          >
            Resume review
          </button>
        ) : (
          <ReasonDialog
            title="Request changes"
            description="Say what has to change. The draft stays editable and approval is unavailable until you resume review."
            label="What has to change"
            maxLength={EDITORIAL_LIMITS.noteChars}
            confirmLabel="Request changes"
            trigger={
              <button type="button" className={smallButtonClass} disabled={disabled}>
                Request changes…
              </button>
            }
            onConfirm={onRequestChanges}
          />
        )}
        <ApproveDialog view={view} disabled={disabled || !view.eligibility.canApprove} onApprove={onApprove} />
      </div>
      {resumeError ? (
        <p role="alert" className="text-xs text-(--ed-danger)">
          {resumeError}
        </p>
      ) : null}
    </div>
  );
}

function ApproveDialog({ view, disabled, onApprove }: { view: RevisionView; disabled: boolean; onApprove: Command<string | null> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [attested, setAttested] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reviewed = view.reviewItems.filter((item) => item.status === "reviewed").length;

  const change = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setAttested(false);
      setNote("");
      setError(null);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attested) {
      setError("Confirm the statement to approve.");
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await onApprove(note.trim() || null);
    setBusy(false);
    if (failure) setError(failure);
    else change(false);
  };

  return (
    <EditorialDialog
      open={open}
      onOpenChange={change}
      title={`Approve revision v${view.number}?`}
      description="Approval records your statement about this exact revision. It does not publish anything; publishing is a separate step."
      trigger={
        <button
          type="button"
          className={buttonClass.primary}
          disabled={disabled}
          aria-describedby={disabled && !view.eligibility.canApprove ? "approval-blockers" : undefined}
        >
          Approve v{view.number}…
        </button>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-(--ed-border) px-3 py-2 text-sm">
          <dt className="text-(--ed-text-2)">Revision</dt>
          <dd>
            v{view.number} · artifact <span className="font-mono">{shortHash(view.hashes.artifact)}</span>
          </dd>
          <dt className="text-(--ed-text-2)">Policy</dt>
          <dd className="font-mono">{view.policy.version}</dd>
          <dt className="text-(--ed-text-2)">Checks</dt>
          <dd>{view.policy.checksCurrent ? "Current for this content" : "Out of date"}</dd>
          <dt className="text-(--ed-text-2)">Review</dt>
          <dd>
            {reviewed} of {view.reviewItems.length} items reviewed
          </dd>
        </dl>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={attested}
            onChange={(event) => setAttested(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-(--ed-text)"
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <span>
            I reviewed the content and evidence of revision v{view.number} as it is now, and I approve this exact version for release.
          </span>
        </label>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Note (optional)
          </label>
          <textarea
            id={`${id}-note`}
            rows={2}
            maxLength={EDITORIAL_LIMITS.noteChars}
            className={`${fieldClass} py-2`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <p className="text-xs text-(--ed-text-2)">
          Any later edit to content, sources, metadata, policy or checks revokes this approval; editing then starts a new draft.
        </p>
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-(--ed-danger)">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <button type="button" className={buttonClass.secondary}>
              Cancel
            </button>
          </DialogClose>
          <button type="submit" className={buttonClass.primary} disabled={busy}>
            {busy ? "Approving…" : `Approve v${view.number}`}
          </button>
        </div>
      </form>
    </EditorialDialog>
  );
}
