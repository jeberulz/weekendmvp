"use client";

import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Globe, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { DefaultLink } from "./DefaultLink";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { BTN_APPROVED, BTN_PRIMARY, BTN_SECONDARY, FOCUS, ICON_BTN } from "./styles";
import { ErrorState, LoadingState } from "./states";
import { ROLE_LABELS, type EmployeeIdentity, type LinkComponent } from "./types";

export type WrenThreadStatus = "ready" | "loading" | "error";

export type WrenThreadProps = {
  status?: WrenThreadStatus;
  errorMessage?: string;
  onRetry?: () => void;
  children?: ReactNode;
};

/** The message list. `role="log"` makes new messages announce politely. */
export function WrenThread({
  status = "ready",
  errorMessage = "Wren's messages didn't load.",
  onRetry,
  children,
}: WrenThreadProps) {
  return (
    <div
      role="log"
      aria-label="Messages"
      aria-live="polite"
      aria-busy={status === "loading"}
      className="flex flex-col gap-4"
    >
      {status === "loading" ? <LoadingState label="Loading messages…" /> : null}
      {status === "error" ? (
        <ErrorState message={errorMessage} onRetry={onRetry} retryLabel="Retry loading messages" />
      ) : null}
      {status === "ready" ? children : null}
    </div>
  );
}

export function WrenMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-5 items-center justify-center bg-home-ink font-editorial text-xs italic text-home-card",
        className,
      )}
    >
      W
    </span>
  );
}

export function WrenMessage({ time, children }: { time: string; children: ReactNode }) {
  return (
    <div data-message="wren" className="flex flex-col gap-1.5 text-sm text-home-ink">
      <p className="flex items-center gap-2 text-[13px]">
        <WrenMark />
        <span className="font-medium">Wren</span>
        <span className="font-mono text-[11px] text-home-ink-3">{time}</span>
      </p>
      <div className="flex flex-col gap-2 leading-relaxed">{children}</div>
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

export function FromAttribution({
  from,
  time,
  workstreamHref,
  linkComponent: Link = DefaultLink,
}: {
  from: EmployeeIdentity;
  time: string;
  workstreamHref: string;
  linkComponent?: LinkComponent;
}) {
  const roleLabel = ROLE_LABELS[from.role];
  return (
    <div className="flex items-center gap-2 text-[13px] text-home-ink-2">
      <EmployeeAvatar name={from.name} role={from.role} size="sm" />
      <p>
        <strong className="font-semibold text-home-ink">From {roleLabel}</strong> · {from.name} ·
        routed by Wren · <span className="font-mono text-[11px]">{time}</span>
      </p>
      <Link
        href={workstreamHref}
        className={cn("ml-auto inline-flex min-h-6 items-center underline underline-offset-2", FOCUS)}
      >
        Workstream<span className="sr-only"> · {from.name}, {roleLabel}</span>
      </Link>
    </div>
  );
}

const CARD_SHELL = "flex flex-col gap-2 rounded-xl border border-home-rule bg-home-paper p-3";

export type BrandKitCardState = "pending" | "approved" | "asking";

export type BrandKitCardProps = {
  pieceCount?: number;
  state: BrandKitCardState;
  openHref: string;
  onApprove: () => void;
  onAskChanges: () => void;
  linkComponent?: LinkComponent;
};

export function BrandKitCard({
  pieceCount = 9,
  state,
  openHref,
  onApprove,
  onAskChanges,
  linkComponent: Link = DefaultLink,
}: BrandKitCardProps) {
  return (
    <div data-card="brand-kit" className={CARD_SHELL}>
      <Link
        href={openHref}
        className={cn("grid grid-cols-3 gap-1 rounded-lg", FOCUS)}
      >
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
          onClick={onApprove}
        >
          {state === "approved" ? "✓ " : ""}Looks good
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          aria-pressed={state === "asking"}
          onClick={onAskChanges}
        >
          Ask for changes
        </button>
        <Link
          href={openHref}
          className={cn(BTN_SECONDARY)}
        >
          Open brand kit
        </Link>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
        {state === "approved"
          ? "Approved. Site, emails and Studio now use it."
          : state === "asking"
            ? "Tell me what to change below — I'll rework it right here."
            : ""}
      </p>
    </div>
  );
}

export function MilestoneCard({ title, detail, time }: { title: string; detail: string; time: string }) {
  return (
    <div data-card="milestone" className={CARD_SHELL}>
      <p className="text-[13px] text-home-ink-2">
        Milestone reached: <strong className="font-semibold text-home-ink">{title}</strong>
      </p>
      <div className="flex items-center gap-3 rounded-lg bg-home-sky px-3 py-2 text-home-sky-ink">
        <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-home-card">
          <Globe className="size-4" />
        </span>
        <p className="text-[13px]">
          <span className="block font-semibold">{title}</span>
          <span>
            {detail} · {time}
          </span>
        </p>
      </div>
    </div>
  );
}

export function SiteLiveCard({
  title,
  body,
  url,
  href,
}: {
  title: string;
  body: string;
  url: string;
  href: string;
}) {
  return (
    <div data-card="site-live" className={CARD_SHELL}>
      <p className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-mono text-xs text-home-ink">{url}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bcd0b0] bg-home-sage px-2.5 py-0.5 text-xs font-medium text-home-sage-ink">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          Live
        </span>
      </p>
      <p className="text-sm font-medium text-home-ink">{title}</p>
      <p className="text-[13px] text-home-ink-2">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(BTN_SECONDARY, "self-start")}
      >
        Open site<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

export function BuildPackCard({
  title,
  titleTail,
  body,
  caption,
  openHref,
  linkComponent: Link = DefaultLink,
}: {
  title: string;
  titleTail: string;
  body: string;
  caption: string;
  openHref: string;
  linkComponent?: LinkComponent;
}) {
  return (
    <div data-card="build-pack" className="flex flex-col gap-2 rounded-xl bg-home-panel p-4 text-home-d1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-light">
        Weekend build pack unlocked
      </p>
      <p className="font-editorial text-xl leading-snug">
        {title} <em>{titleTail}</em>
      </p>
      <p className="text-[13px] text-home-d2">{body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={openHref}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full bg-home-card px-4 text-[13px] font-medium text-home-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light",
          )}
        >
          Open build pack
        </Link>
        <span className="text-xs text-home-d2">{caption}</span>
      </div>
    </div>
  );
}

export function LaunchPlanNudgeCard({
  message,
  href,
  linkComponent: Link = DefaultLink,
}: {
  message: string;
  href: string;
  linkComponent?: LinkComponent;
}) {
  return (
    <div data-card="launch-plan-nudge" className={CARD_SHELL}>
      <p className="text-sm text-home-ink">{message}</p>
      <Link href={href} className={cn(BTN_SECONDARY, "self-start")}>
        Open weekend launch plan
      </Link>
    </div>
  );
}

/** Pure draft check: trims, and returns null for an empty message (nothing is sent). */
export function prepareMessage(draft: string): string | null {
  const text = draft.trim();
  return text.length > 0 ? text : null;
}

export type WrenComposerProps = {
  onSend: (text: string) => void;
  /** Disables the send button while a send is in flight. */
  sending?: boolean;
};

export function WrenComposer({ onSend, sending = false }: WrenComposerProps) {
  const [draft, setDraft] = useState("");

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
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-home-rule p-3">
      <label htmlFor="wren-composer" className="sr-only">
        Message Wren
      </label>
      <textarea
        id="wren-composer"
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
      <button type="submit" aria-label="Send message" disabled={sending} className={ICON_BTN}>
        <Send aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
}
