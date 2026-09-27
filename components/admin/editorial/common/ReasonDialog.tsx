"use client";

import { useId, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { DialogClose } from "@/components/ui/dialog";
import { EditorialDialog } from "./EditorialDialog";
import { StrongAuthStep, isReauthMessage, type StrongAuthContext } from "./StrongAuthStep";
import { buttonClass, fieldClass } from "./primitives";

/**
 * A confirmation that asks for a written reason (or note, rationale or
 * question). The command runs only on submit; the dialog stays open with the
 * server's message when it is refused.
 */
export function ReasonDialog({
  title,
  description,
  label,
  hint,
  required = true,
  maxLength,
  confirmLabel,
  dismissLabel = "Cancel",
  tone = "primary",
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCloseAutoFocus,
  canSubmit = true,
  strongAuth,
  children,
  onConfirm,
}: {
  title: string;
  description: ReactNode;
  label: string;
  hint?: string;
  required?: boolean;
  maxLength: number;
  confirmLabel: string;
  /** Label of the button that closes without acting. */
  dismissLabel?: string;
  tone?: "primary" | "danger";
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?(open: boolean): void;
  onCloseAutoFocus?: ComponentProps<typeof EditorialDialog>["onCloseAutoFocus"];
  /** Extra fields (selects, checkboxes) must be complete before submitting. */
  canSubmit?: boolean;
  /** The command needs a recent sign-in confirmation (simulated in the local demo). */
  strongAuth?: StrongAuthContext;
  children?: ReactNode;
  /** Resolves with an error message, or null on success (the dialog closes). */
  onConfirm(text: string): Promise<string | null>;
}) {
  const id = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setText("");
      setError(null);
      setReauthNeeded(false);
    }
  };
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmedHere, setConfirmedHere] = useState(false);
  const [reauthNeeded, setReauthNeeded] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const authFresh = strongAuth ? (strongAuth.fresh || confirmedHere) && !reauthNeeded : true;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (required && !text.trim()) {
      setError(`${label} is required.`);
      return;
    }
    if (!canSubmit) {
      setError("Complete every field first.");
      return;
    }
    if (!authFresh) {
      setError("Confirm your sign-in first.");
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await onConfirm(text.trim());
    setBusy(false);
    if (!failure) {
      setOpen(false);
      return;
    }
    if (strongAuth && isReauthMessage(failure)) setReauthNeeded(true);
    setError(failure);
  };

  const fieldId = `${id}-text`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <EditorialDialog
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={trigger}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        {children}
        <div className="flex flex-col gap-1">
          <label htmlFor={fieldId} className="text-sm font-medium">
            {label}
            {required ? " (required)" : " (optional)"}
          </label>
          {hint ? (
            <p id={hintId} className="text-xs text-(--ed-text-2)">
              {hint}
            </p>
          ) : null}
          <textarea
            id={fieldId}
            rows={3}
            required={required}
            maxLength={maxLength}
            aria-invalid={error ? true : undefined}
            aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
            className={`${fieldClass} py-2`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        {strongAuth ? (
          <StrongAuthStep
            fresh={authFresh}
            mechanism={strongAuth.mechanism}
            onConfirmed={() => {
              // The confirm button goes away: continue on the submit button.
              flushSync(() => {
                setConfirmedHere(true);
                setReauthNeeded(false);
                setError(null);
              });
              submitRef.current?.focus();
            }}
          />
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-(--ed-danger)">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <button type="button" className={buttonClass.secondary}>
              {dismissLabel}
            </button>
          </DialogClose>
          <button
            ref={submitRef}
            type="submit"
            className={tone === "danger" ? buttonClass.danger : buttonClass.primary}
            disabled={busy || !authFresh}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </EditorialDialog>
  );
}
