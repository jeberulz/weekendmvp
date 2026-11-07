"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { onWrenPrefill } from "@/lib/workspace/wrenPrefill";
import { DefaultLink } from "./DefaultLink";
import { BTN_APPROVED, BTN_PRIMARY, BTN_SECONDARY, FOCUS } from "./styles";
import { ErrorState, LoadingState } from "./states";
import { CARD_SHELL, DEFAULT_PARTNER_NAME } from "./WrenCards";
import type { LinkComponent } from "./types";

// Interactive Wren pieces (they take handlers or hold state). The hook-free cards
// live in WrenCards.tsx. `onRetry` and the other callbacks need a client parent.

export type WrenThreadStatus = "ready" | "loading" | "error";

export type WrenThreadProps = {
  status?: WrenThreadStatus;
  /** The co-founder's name, for the default error line. Default "Wren". */
  name?: string;
  errorMessage?: string;
  onRetry?: () => void;
  /**
   * Default true: the log announces what is added (implicit polite). Pass
   * false when the parent announces replies itself, e.g. to avoid reading
   * every streamed draft.
   */
  liveUpdates?: boolean;
  children?: ReactNode;
};

/** True inside a thread `role="log"` that announces new content (`liveUpdates`). */
const InsideLogContext = createContext(false);

/**
 * Loading and error render outside the log, as their own live regions. The
 * `role="log"` mounts only when there are messages to show (it is implicitly polite).
 */
export function WrenThread({
  status = "ready",
  name = DEFAULT_PARTNER_NAME,
  errorMessage = `${name}'s messages didn't load.`,
  onRetry,
  liveUpdates = true,
  children,
}: WrenThreadProps) {
  if (status === "loading") return <LoadingState label="Loading messages…" />;
  if (status === "error") {
    return <ErrorState message={errorMessage} onRetry={onRetry} retryLabel="Retry loading messages" />;
  }
  return (
    <div role="log" aria-label="Messages" aria-live={liveUpdates ? undefined : "off"} className="flex flex-col gap-4">
      <InsideLogContext.Provider value={liveUpdates}>{children}</InsideLogContext.Provider>
    </div>
  );
}

/** The founder's initial, or null when there is no name to take one from. */
export function founderInitial(name: string | undefined): string | null {
  const first = name === undefined ? undefined : Array.from(name.trim())[0];
  return first === undefined ? null : first.toUpperCase();
}

/**
 * The founder's avatar beside their messages: their initial on the same sky
 * circle as the sidebar user row (initials only, never a photo), or a person
 * icon when the name is unknown. Decorative: each message already says "You".
 */
export function FounderAvatar({ name }: { name?: string }) {
  const initial = founderInitial(name);
  return (
    <span
      aria-hidden="true"
      data-avatar="founder"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-home-sky text-xs font-semibold text-home-sky-ink"
    >
      {initial ?? <User className="size-3.5" />}
    </span>
  );
}

export type UserMessageProps = {
  children: ReactNode;
  /** The founder's name, for their avatar's initial. A person icon when absent. */
  founderName?: string;
  /** The send failed: show a retry control. */
  failed?: boolean;
  onRetry?: () => void;
};

export function UserMessage({ children, founderName, failed = false, onRetry }: UserMessageProps) {
  return (
    <div data-message="user" className="flex flex-col items-end gap-1">
      <div className="flex max-w-full items-end justify-end gap-2">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-[10px_10px_2px_10px] bg-home-sunk px-3 py-2 text-sm text-home-ink">
          <span className="sr-only">You: </span>
          {children}
        </p>
        <FounderAvatar name={founderName} />
      </div>
      {failed ? (
        <p className="flex items-center gap-2 text-xs text-home-clay-ink">
          <span>Not sent.</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className={cn("min-h-6 rounded px-1 font-medium underline", FOCUS)}
            >
              Retry sending
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export type BrandKitCardState = "pending" | "approved" | "asking";

export type BrandKitCardProps = {
  pieceCount?: number;
  state: BrandKitCardState;
  /** A decision is in flight: buttons stay focusable but ignore activation. */
  pending?: boolean;
  openHref: string;
  onApprove: () => void;
  onAskChanges: () => void;
  linkComponent?: LinkComponent;
  /**
   * Wrap the status text in its own live region. Defaults to true, except inside a
   * WrenThread, whose `role="log"` already announces it (avoids a double announcement).
   */
  announce?: boolean;
};

export function BrandKitCard({
  announce,
  ...rest
}: BrandKitCardProps) {
  const insideLog = useContext(InsideLogContext);
  return <BrandKitCardView {...rest} announce={announce ?? !insideLog} />;
}

/** Hook-free view; `announce` decides whether the status text is its own live region. */
export function BrandKitCardView({
  pieceCount = 9,
  state,
  pending = false,
  openHref,
  onApprove,
  onAskChanges,
  linkComponent: Link = DefaultLink,
  announce: live = true,
}: Omit<BrandKitCardProps, "announce"> & { announce?: boolean }) {
  const statusText = pending
    ? "Sending your decision…"
    : state === "approved"
      ? "Approved. Site, emails and Studio now use it."
      : state === "asking"
        ? "Tell me what to change below — I'll rework it right here."
        : "";
  return (
    <div data-card="brand-kit" aria-busy={pending} className={CARD_SHELL}>
      <Link href={openHref} className={cn("grid grid-cols-3 gap-1 rounded-lg", FOCUS)}>
        <span className="sr-only">Open brand kit</span>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} aria-hidden="true" className="aspect-square rounded bg-home-sunk" />
        ))}
      </Link>
      <p className="text-[13px] text-home-ink-2">Generated brand kit · {pieceCount} pieces</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={state === "approved" ? BTN_APPROVED : BTN_PRIMARY}
          aria-pressed={state === "approved"}
          aria-disabled={pending || undefined}
          onClick={() => {
            if (!pending) onApprove();
          }}
        >
          {state === "approved" ? <span aria-hidden="true">✓ </span> : null}Looks good<span className="sr-only"> · brand kit</span>
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          aria-pressed={state === "asking"}
          aria-disabled={pending || undefined}
          onClick={() => {
            if (!pending) onAskChanges();
          }}
        >
          Ask for changes<span className="sr-only"> · brand kit</span>
        </button>
        <Link href={openHref} className={cn(BTN_SECONDARY)}>
          Open brand kit
        </Link>
      </div>
      <p
        role={live ? "status" : undefined}
        aria-live={live ? "polite" : undefined}
        className="min-h-5 text-[13px] text-home-ink-2"
      >
        {statusText}
      </p>
    </div>
  );
}

/** Pure draft check: trims, and returns null for an empty message (nothing is sent). */
export function prepareMessage(draft: string): string | null {
  const text = draft.trim();
  return text.length > 0 ? text : null;
}

/**
 * Enter sends; Shift+Enter is a newline. Never send mid-composition: Safari fires
 * the committing Enter with `isComposing` false but `keyCode` 229.
 */
export function shouldSendOnKeyDown(input: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode?: number;
}): boolean {
  if (input.isComposing || input.keyCode === 229) return false;
  return input.key === "Enter" && !input.shiftKey;
}

export type WrenComposerProps = {
  /**
   * Return `true` (or a promise of it) once the message was accepted: only then
   * is the draft cleared. `false` keeps the text for another try. `void` clears
   * straight away.
   */
  onSend: (text: string) => boolean | Promise<boolean> | void;
  /** A send is in flight: Send stays focusable (`aria-disabled`) and ignores activation. */
  sending?: boolean;
  /** The co-founder's name, for the label and placeholder. Default "Wren". */
  name?: string;
  /** Take questions a page puts in with `askWren` (`lib/workspace/wrenPrefill.ts`): the text replaces the draft and focus moves here. */
  acceptPrefill?: boolean;
};

/** The board's send button: a 40px ink square with an up arrow. */
const SEND_BTN = `inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-home-ink text-home-card hover:bg-home-panel ${FOCUS} aria-disabled:cursor-not-allowed aria-disabled:border aria-disabled:border-dashed aria-disabled:border-home-ink-3 aria-disabled:bg-home-sunk aria-disabled:text-home-ink-2 aria-disabled:hover:bg-home-sunk`;

export function WrenComposer({ onSend, sending = false, name = DEFAULT_PARTNER_NAME, acceptPrefill = false }: WrenComposerProps) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (!acceptPrefill) return;
    return onWrenPrefill((text) => {
      setDraft(text);
      // After the drawer (below `xl`) is shown, so the textarea can take focus.
      window.setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea === null) return;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }, 0);
    });
  }, [acceptPrefill]);

  /** After an accepted send focus stays in the composer, even when Send was pressed. */
  function keepFocusInComposer() {
    const active = document.activeElement;
    const form = textareaRef.current?.form;
    // Only when focus is on the page, or on the composer's own controls: never take it back from elsewhere.
    if (active === null || active === document.body || (form !== null && form !== undefined && form.contains(active))) {
      textareaRef.current?.focus();
    }
  }

  function submit() {
    const text = prepareMessage(draft);
    if (!text || sending || pending.current) return;
    const result = onSend(text);
    if (result === undefined) {
      setDraft("");
      keepFocusInComposer();
      return;
    }
    if (typeof result === "boolean") {
      if (result) setDraft("");
      keepFocusInComposer();
      return;
    }
    pending.current = true;
    void result
      .then((accepted) => accepted, () => false)
      .then((accepted) => {
        pending.current = false;
        // Keep anything the founder typed while the send was pending.
        if (accepted) setDraft((current) => (prepareMessage(current) === text ? "" : current));
        keepFocusInComposer();
      });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      shouldSendOnKeyDown({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
        keyCode: event.keyCode,
      })
    ) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-home-rule px-3.5 py-3">
      <label htmlFor={inputId} className="sr-only">
        {`Message ${name}`}
      </label>
      <textarea
        ref={textareaRef}
        id={inputId}
        rows={1}
        value={draft}
        placeholder={`Message ${name}…`}
        aria-describedby={hintId}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "min-h-10 flex-1 resize-none rounded-lg border border-home-ink-3 bg-home-card px-3 py-2 text-sm text-home-ink placeholder:text-home-ink-3",
          FOCUS,
        )}
      />
      <span id={hintId} className="sr-only">
        Press Enter to send. Press Shift and Enter for a new line.
      </span>
      <button
        type="submit"
        aria-label="Send message"
        aria-disabled={sending || undefined}
        className={SEND_BTN}
      >
        <ArrowUp aria-hidden="true" strokeWidth={2} className="size-4" />
      </button>
    </form>
  );
}
