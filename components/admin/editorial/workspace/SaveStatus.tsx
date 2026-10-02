"use client";

import { CheckCircle2, CircleDot, CloudOff, GitCompareArrows, Loader2, Lock, OctagonAlert } from "lucide-react";

import type { SaveControllerState } from "@/lib/editorial/editor/save-controller";
import { formatAbsolute, formatClock } from "@/lib/editorial/presentation/format";
import { cn } from "@/lib/utils";
import { textButtonClass } from "./ui";

type Described = {
  icon: typeof CheckCircle2;
  text: string;
  className: string;
  action: "retry" | "conflict" | null;
};

/** One distinct message per state; "Saved" only after the server acknowledged. */
export function describeSaveState(state: SaveControllerState, metadataInvalid: boolean): Described {
  switch (state.status) {
    case "saved":
      return metadataInvalid
        ? { icon: OctagonAlert, text: "Metadata has errors — not saved", className: "text-(--ed-danger)", action: null }
        : {
            icon: CheckCircle2,
            text: state.lastSavedAt ? `Saved ${formatClock(state.lastSavedAt)}` : "Saved",
            className: "text-(--ed-success)",
            action: null,
          };
    case "dirty":
      return { icon: CircleDot, text: "Unsaved changes", className: "text-(--ed-warning)", action: null };
    case "saving":
      return { icon: Loader2, text: "Saving…", className: "text-(--ed-text-2)", action: null };
    case "offline":
      return { icon: CloudOff, text: "Offline — changes not saved", className: "text-(--ed-danger)", action: "retry" };
    case "error":
      return {
        icon: OctagonAlert,
        text: `Save failed${state.error ? ` — ${state.error.message}` : ""}`,
        className: "text-(--ed-danger)",
        action: "retry",
      };
    case "conflict":
      return { icon: GitCompareArrows, text: "Conflict — review newer revision", className: "text-(--ed-danger)", action: "conflict" };
    case "read_only":
      return { icon: Lock, text: "Read-only", className: "text-(--ed-text-2)", action: null };
  }
}

export function SaveStatus({
  state,
  metadataInvalid,
  onRetry,
  onShowConflict,
}: {
  state: SaveControllerState;
  metadataInvalid: boolean;
  onRetry(): void;
  onShowConflict(): void;
}) {
  const described = describeSaveState(state, metadataInvalid);
  const Icon = described.icon;
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <p
        className={cn("flex items-center gap-1.5 font-medium", described.className)}
        title={state.status === "saved" && state.lastSavedAt ? formatAbsolute(state.lastSavedAt) : undefined}
      >
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", state.status === "saving" && "animate-spin")} />
        <span>{described.text}</span>
      </p>
      {described.action === "retry" ? (
        <button type="button" className={textButtonClass} onClick={onRetry}>
          Retry now
        </button>
      ) : null}
      {described.action === "conflict" ? (
        <button type="button" className={textButtonClass} onClick={onShowConflict}>
          Review conflict
        </button>
      ) : null}
    </div>
  );
}
