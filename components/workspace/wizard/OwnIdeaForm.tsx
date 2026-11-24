"use client";

import { useId, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { BTN_PRIMARY } from "@/components/workspace/kit/styles";
import { WIZARD_LIMITS } from "@/lib/workspace/contracts/wizard";
import { OWN_IDEA_FALLBACK_EXAMPLES, type OwnIdeaExample } from "@/lib/workspace/wizard/own-idea-examples";
import { OwnIdeaExamples } from "./OwnIdeaExamples";
import { OwnIdeaLibraryLink } from "./OwnIdeaLibraryLink";
import { Field, StepHeadView } from "./wizard-ui";

/** The one line under the step's sub, the same before and after the session exists. */
export const OWN_IDEA_SAVE_NOTE = "Your answers save as you go.";

/**
 * What an inline field action (for example "Improve with AI", WP100) gets to
 * work with: the current text, a way to replace it, the field's id (to focus
 * it or point `aria-controls` at it), the current selection and the pending flag.
 */
export type OwnIdeaFieldApi = {
  readonly text: string;
  /** Replaces the text and clears any local error, like typing would. */
  readonly setText: (next: string) => void;
  readonly fieldId: string;
  /** The field's selection as UTF-16 offsets, or null when it is not in the page. */
  readonly getSelection: () => { readonly start: number; readonly end: number } | null;
  readonly pending: boolean;
};

export type OwnIdeaFormProps = {
  /** The saved idea when the founder comes back to step 1; empty on a first visit. */
  readonly initialText?: string;
  /** True while a call is in flight: Continue stays focusable but inert. */
  readonly pending: boolean;
  readonly error: string | null;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** The trimmed, non-empty sentence. */
  readonly onSubmit: (text: string) => void;
  /** Example ideas for the chips (WP99: live library ideas, drawn per visit; the static lines as a fallback). */
  readonly examples?: readonly OwnIdeaExample[];
  /** An optional action rendered right under the field, before the example chips. */
  readonly renderFieldAction?: (field: OwnIdeaFieldApi) => ReactNode;
};

/**
 * Step 1 for an own idea: one sentence, example chips (WP99), the library
 * link, Continue. The single surface for this step, rendered both before a
 * session exists (`WizardFlow`) and once it does (`WizardStepPanel`, after
 * Back or a reload), so the step never changes look between visits.
 */
export function OwnIdeaForm({
  initialText = "",
  pending,
  error,
  headingRef,
  onSubmit,
  examples = OWN_IDEA_FALLBACK_EXAMPLES,
  renderFieldAction,
}: OwnIdeaFormProps) {
  const base = useId();
  const [text, setText] = useState(initialText);
  const [localError, setLocalError] = useState<string | null>(null);
  const fieldId = `${base}-idea`;
  const errorId = `${base}-error`;
  const shownError = localError ?? error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setLocalError("Write your idea in one sentence first.");
      return;
    }
    setLocalError(null);
    onSubmit(trimmed);
  }

  function replaceText(next: string) {
    setText(next);
    setLocalError(null);
  }

  // A tapped example fills the field and hands focus back to it, ready to edit.
  function applyExample(example: string) {
    replaceText(example);
    document.getElementById(fieldId)?.focus();
  }

  function getSelection() {
    const field = document.getElementById(fieldId);
    if (!(field instanceof HTMLInputElement)) return null;
    return { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 };
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-[600px] flex-col gap-6">
      <StepHeadView step="idea" headingId={`${base}-heading`} headingRef={headingRef}>
        <p className="mt-2 text-[13px] text-home-ink-3">{OWN_IDEA_SAVE_NOTE}</p>
      </StepHeadView>
      <Field
        id={fieldId}
        label="Your idea in one sentence"
        hint={`Up to ${WIZARD_LIMITS.ownIdea} characters. Your own idea gets a light blueprint, marked "Not yet validated".`}
        value={text}
        onChange={setText}
        maxLength={WIZARD_LIMITS.ownIdea}
        errorId={errorId}
        invalid={shownError !== null}
        serif
      />
      {renderFieldAction?.({ text, setText: replaceText, fieldId, getSelection, pending })}
      <OwnIdeaExamples examples={examples} value={text} onApply={applyExample} />
      <OwnIdeaLibraryLink />
      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Saving…" : ""}
      </p>
      {shownError ? (
        <p id={errorId} role="alert" className="text-sm text-home-clay-ink">
          {shownError}
        </p>
      ) : null}
      <button type="submit" className={`${BTN_PRIMARY} min-h-[52px] w-full text-[15px]`} aria-disabled={pending || undefined}>
        Continue
      </button>
    </form>
  );
}
