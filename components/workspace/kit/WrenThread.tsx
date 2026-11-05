"use client";

import { createContext, useContext, useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { DefaultLink } from "./DefaultLink";
import { BTN_APPROVED, BTN_PRIMARY, BTN_SECONDARY, FOCUS, ICON_BTN } from "./styles";
import { ErrorState, LoadingState } from "./states";
import { CARD_SHELL } from "./WrenCards";
import type { LinkComponent } from "./types";

// Interactive Wren pieces (they take handlers or hold state). The hook-free cards
// live in WrenCards.tsx. `onRetry` and the other callbacks need a client parent.

export type WrenThreadStatus = "ready" | "loading" | "error";

export type WrenThreadProps = {
  status?: WrenThreadStatus;
  errorMessage?: string;
  onRetry?: () => void;
  children?: ReactNode;
};

/** True inside the thread's `role="log"`, which already announces new content. */
const InsideLogContext = createContext(false);

/**
 * Loading and error render outside the log, as their own live regions. The
 * `role="log"` mounts only when there are messages to show (it is implicitly polite).
 */
export function WrenThread({
  status = "ready",
  errorMessage = "Wren's messages didn't load.",
  onRetry,
  children,
}: WrenThreadProps) {
  if (status === "loading") return <LoadingState label="Loading messages…" />;
  if (status === "error") {
    return <ErrorState message={errorMessage} onRetry={onRetry} retryLabel="Retry loading messages" />;
  }
  return (
    <div role="log" aria-label="Messages" className="flex flex-col gap-4">
      <InsideLogContext.Provider value={true}>{children}</InsideLogContext.Provider>
    </div>
  );
}

export type UserMessageProps = {
  children: ReactNode;
  /** The send failed: show a retry control. */
  failed?: boolean;
  onRetry?: () => void;
};

export function UserMessage({ children, failed = false, onRetry }: UserMessageProps) {
  return (
    <div data-message="user" className="flex flex-col items-end gap-1">
      <p className="max-w-[85%] rounded-[10px_10px_2px_10px] bg-home-sunk px-3 py-2 text-sm text-home-ink">
        <span className="sr-only">You: </span>
        {children}
      </p>
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
          {state === "approved" ? "✓ " : ""}Looks good<span className="sr-only"> · brand kit</span>
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
  onSend: (text: string) => void;
  /** A send is in flight: Send stays focusable (`aria-disabled`) and ignores activation. */
  sending?: boolean;
};

export function WrenComposer({ onSend, sending = false }: WrenComposerProps) {
  const [draft, setDraft] = useState("");
  const inputId = useId();

  function submit() {
    const text = prepareMessage(draft);
    if (!text || sending) return;
    onSend(text);
    setDraft("");
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
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-home-rule p-3">
      <label htmlFor={inputId} className="sr-only">
        Message Wren
      </label>
      <textarea
        id={inputId}
        rows={1}
        value={draft}
        placeholder="Message Wren…"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "min-h-10 flex-1 resize-none rounded-lg border border-home-ink-3 bg-home-card px-3 py-2 text-sm text-home-ink placeholder:text-home-ink-3",
          FOCUS,
        )}
      />
      <button
        type="submit"
        aria-label="Send message"
        aria-disabled={sending || undefined}
        className={ICON_BTN}
      >
        <Send aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
}
